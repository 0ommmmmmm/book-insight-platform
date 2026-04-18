"""
Celery tasks for async background processing.
- scrape_book_task: scrape + embed a single book
- bulk_scrape_task: process multiple book URLs
- generate_insights_task: generate AI summaries/genres
"""

import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def scrape_book_task(self, url: str, generate_insights: bool = True):
    """
    Async task to:
    1. Scrape book from URL
    2. Save to database
    3. Generate embeddings
    4. Optionally generate AI insights
    """
    from scraper.scraper import scrape_book
    from books.models import Book, AIInsight
    from rag.pipeline import RAGPipeline

    logger.info("[Task] Scraping: %s", url)
    rag = RAGPipeline()

    try:
        scraped = scrape_book(url)

        if scraped is None:
            logger.error("[Task] Scraping failed for: %s", url)
            return {"status": "failed", "url": url, "error": "Could not scrape page"}

        # Save to DB
        book, created = Book.objects.get_or_create(
            book_url=url,
            defaults={
                "title": scraped.title,
                "author": scraped.author,
                "rating": scraped.rating,
                "description": scraped.description,
                "cover_url": scraped.cover_url,
                "genres": scraped.genres,
                "pages": scraped.pages,
                "published_year": scraped.published_year,
            },
        )

        if not created:
            # Update existing entry with fresh data
            for field in ["title", "author", "rating", "description", "cover_url", "genres"]:
                setattr(book, field, getattr(scraped, field))
            book.save()

        logger.info("[Task] Book saved: id=%s title=%s", book.id, book.title)

        # Generate embeddings
        if book.description:
            rag.index_book(book.id, book.title, book.author, book.description)
            book.is_embedded = True
            book.save(update_fields=["is_embedded"])

        # AI insights (optional, costs tokens)
        if generate_insights and book.description:
            generate_insights_task.delay(book.id)

        return {"status": "success", "book_id": book.id, "title": book.title}

    except Exception as exc:
        logger.error("[Task] Error scraping %s: %s", url, exc)
        # Retry with exponential back-off
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2)
def bulk_scrape_task(self, job_id: int, urls: list, generate_insights: bool = True):
    """
    Process a bulk scrape job.
    Updates the ScrapeJob record with progress.
    """
    from books.models import ScrapeJob
    from scraper.scraper import scrape_book
    from books.models import Book
    from rag.pipeline import RAGPipeline

    logger.info("[BulkTask] Starting job %s with %d URLs", job_id, len(urls))
    rag = RAGPipeline()

    try:
        job = ScrapeJob.objects.get(pk=job_id)
        job.status = "running"
        job.save()

        errors = []

        for url in urls:
            try:
                scraped = scrape_book(url)
                if not scraped:
                    job.books_failed += 1
                    errors.append(f"Failed: {url}")
                    continue

                book, _ = Book.objects.get_or_create(
                    book_url=url,
                    defaults={
                        "title": scraped.title,
                        "author": scraped.author,
                        "rating": scraped.rating,
                        "description": scraped.description,
                        "cover_url": scraped.cover_url,
                        "genres": scraped.genres,
                    },
                )

                if book.description:
                    rag.index_book(book.id, book.title, book.author, book.description)
                    book.is_embedded = True
                    book.save(update_fields=["is_embedded"])

                if generate_insights and book.description:
                    generate_insights_task.delay(book.id)

                job.books_scraped += 1
                job.save(update_fields=["books_scraped", "books_failed"])

            except Exception as e:
                job.books_failed += 1
                errors.append(f"{url}: {str(e)}")
                job.save(update_fields=["books_failed"])

        job.status = "done"
        job.error_log = "\n".join(errors)
        job.save()

        logger.info("[BulkTask] Job %s done. OK=%d FAIL=%d", job_id, job.books_scraped, job.books_failed)
        return {"job_id": job_id, "scraped": job.books_scraped, "failed": job.books_failed}

    except Exception as exc:
        try:
            ScrapeJob.objects.filter(pk=job_id).update(status="failed", error_log=str(exc))
        except Exception:
            pass
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def generate_insights_task(self, book_id: int):
    """
    Generate and cache AI insights for a book:
    - Summary
    - Genre classification
    - Sentiment analysis
    Results are stored in AIInsight model to avoid re-generating.
    """
    from books.models import Book, AIInsight
    from rag.pipeline import RAGPipeline

    rag = RAGPipeline()

    try:
        book = Book.objects.get(pk=book_id)

        if not book.description:
            return {"status": "skipped", "reason": "no description"}

        # Generate each insight type (only if not already cached)
        insight_tasks = [
            ("summary", lambda: rag.generate_summary(book.title, book.description)),
            ("genre", lambda: ", ".join(rag.classify_genre(book.title, book.description))),
            ("sentiment", lambda: rag.analyze_sentiment(book.description)),
        ]

        for insight_type, generate_fn in insight_tasks:
            if not AIInsight.objects.filter(book=book, insight_type=insight_type).exists():
                try:
                    content = generate_fn()
                    AIInsight.objects.create(
                        book=book,
                        insight_type=insight_type,
                        content=content,
                        model_used=f"{book_id}_llm",
                    )
                    logger.info("[Insights] Generated %s for book %s", insight_type, book_id)
                except Exception as e:
                    logger.warning("[Insights] Failed %s for book %s: %s", insight_type, book_id, e)

        # Update genres from AI classification
        genre_insight = AIInsight.objects.filter(book=book, insight_type="genre").first()
        if genre_insight and not book.genres:
            book.genres = [g.strip() for g in genre_insight.content.split(",")]
            book.save(update_fields=["genres"])

        return {"status": "success", "book_id": book_id}

    except Book.DoesNotExist:
        return {"status": "failed", "error": f"Book {book_id} not found"}
    except Exception as exc:
        logger.error("[Insights] Error for book %s: %s", book_id, exc)
        raise self.retry(exc=exc)
