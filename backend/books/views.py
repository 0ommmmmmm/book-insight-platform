"""
Books API views.
Endpoints: /books, /books/{id}, /recommend/{id}, /upload-book,
           /bulk-scrape, /scrape-status/{job_id}, /ask, /sessions, /sessions/{id}
"""

import uuid
import logging
from django.core.cache import cache
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from .models import Book, ChatSession, ChatMessage, ScrapeJob
from .serializers import (
    BookListSerializer,
    BookDetailSerializer,
    AskRequestSerializer,
    UploadBookSerializer,
    BulkScrapeSerializer,
    ScrapeJobSerializer,
    ChatSessionSerializer,
    ChatMessageSerializer,
)
from rag.pipeline import RAGPipeline
from scraper.tasks import scrape_book_task, bulk_scrape_task

logger = logging.getLogger(__name__)
rag = RAGPipeline()


# ── Pagination ────────────────────────────────────────────────────────────────

class BookPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 50


# ── Book Endpoints ────────────────────────────────────────────────────────────

@api_view(["GET"])
def book_list(request):
    """
    GET /books
    Returns paginated list of all books.
    Supports ?search=, ?author=, ?min_rating= query params.
    """
    queryset = Book.objects.all()

    # Filtering
    search = request.query_params.get("search", "").strip()
    if search:
        queryset = queryset.filter(title__icontains=search) | queryset.filter(
            author__icontains=search
        )

    author = request.query_params.get("author", "").strip()
    if author:
        queryset = queryset.filter(author__icontains=author)

    min_rating = request.query_params.get("min_rating")
    if min_rating:
        try:
            queryset = queryset.filter(rating__gte=float(min_rating))
        except ValueError:
            pass

    paginator = BookPagination()
    page = paginator.paginate_queryset(queryset, request)
    serializer = BookListSerializer(page, many=True)
    return paginator.get_paginated_response(serializer.data)


@api_view(["GET"])
def book_detail(request, pk):
    """
    GET /books/{id}
    Returns full book details including AI insights.
    """
    book = get_object_or_404(Book, pk=pk)
    serializer = BookDetailSerializer(book)
    return Response(serializer.data)


@api_view(["GET"])
def recommend_books(request, pk):
    """
    GET /recommend/{id}
    Returns semantically similar books using the RAG vector store.
    Results are cached for 1 hour.
    """
    cache_key = f"recommend_{pk}"
    cached = cache.get(cache_key)
    if cached:
        logger.info("Cache hit for recommendations, book_id=%s", pk)
        return Response(cached)

    book = get_object_or_404(Book, pk=pk)
    top_k = int(request.query_params.get("top_k", 5))

    # Build query from book description + genres
    query_text = f"{book.title} {book.author}. {book.description[:300]}"
    similar_ids = rag.find_similar_books(query_text, exclude_id=str(pk), top_k=top_k)

    similar_books = Book.objects.filter(id__in=similar_ids)
    serializer = BookListSerializer(similar_books, many=True)
    result = serializer.data

    cache.set(cache_key, result, timeout=3600)
    return Response(result)


# ── Upload / Scrape Endpoints ─────────────────────────────────────────────────

@api_view(["POST"])
def upload_book(request):
    """
    POST /upload-book
    Triggers async Celery task to scrape + embed a single book URL.
    Body: { "url": "https://...", "generate_insights": true }
    """
    serializer = UploadBookSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    url = serializer.validated_data["url"]
    generate_insights = serializer.validated_data["generate_insights"]

    # Check if URL already scraped
    if Book.objects.filter(book_url=url).exists():
        book = Book.objects.get(book_url=url)
        return Response(
            {"message": "Book already exists.", "book_id": book.id},
            status=status.HTTP_200_OK,
        )

    # Dispatch Celery task
    task = scrape_book_task.delay(url, generate_insights)

    return Response(
        {"message": "Scraping started.", "task_id": task.id},
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["POST"])
def bulk_scrape(request):
    """
    POST /bulk-scrape
    Bulk-scrape multiple book URLs in the background.
    Body: { "urls": ["https://...", ...], "generate_insights": true }
    """
    serializer = BulkScrapeSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    urls = serializer.validated_data["urls"]
    generate_insights = serializer.validated_data["generate_insights"]

    # Create a ScrapeJob record
    job = ScrapeJob.objects.create(urls=urls)
    task = bulk_scrape_task.delay(job.id, urls, generate_insights)

    job.task_id = task.id
    job.status = "running"
    job.save()

    return Response(
        {"message": f"Bulk scrape started for {len(urls)} URLs.", "job_id": job.id},
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["GET"])
def scrape_status(request, job_id):
    """
    GET /scrape-status/{job_id}
    Check the status of a bulk scrape job.
    """
    job = get_object_or_404(ScrapeJob, pk=job_id)
    serializer = ScrapeJobSerializer(job)
    return Response(serializer.data)


# ── RAG Q&A Endpoint ──────────────────────────────────────────────────────────

@api_view(["POST"])
def ask_question(request):
    """
    POST /ask
    RAG-powered Q&A with chat history support.
    Body: { "question": "...", "session_id": "...", "top_k": 3 }
    Returns answer + cited source books.
    """
    serializer = AskRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    question = serializer.validated_data["question"]
    session_id = serializer.validated_data.get("session_id") or str(uuid.uuid4())
    top_k = serializer.validated_data["top_k"]

    # Get or create chat session
    session, _ = ChatSession.objects.get_or_create(session_id=session_id)

    # Fetch recent history (last 6 messages for context window)
    history = list(
        session.messages.order_by("-created_at")[:6]
    )[::-1]  # reverse to chronological

    history_text = "\n".join(
        f"{m.role.upper()}: {m.content}" for m in history
    )

    try:
        answer, sources = rag.answer_question(question, history_text, top_k=top_k)
    except Exception as exc:
        logger.error("RAG pipeline error: %s", exc)
        return Response(
            {"error": "AI service temporarily unavailable. Please try again."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # Persist messages
    ChatMessage.objects.create(session=session, role="user", content=question)
    ChatMessage.objects.create(
        session=session, role="assistant", content=answer, sources=sources
    )

    return Response(
        {
            "session_id": session_id,
            "answer": answer,
            "sources": sources,
        }
    )


# ── Chat History Endpoints ─────────────────────────────────────────────────────

@api_view(["GET"])
def list_sessions(request):
    """GET /sessions — List all chat sessions."""
    sessions = ChatSession.objects.order_by("-updated_at")[:20]
    serializer = ChatSessionSerializer(sessions, many=True)
    return Response(serializer.data)


@api_view(["GET", "DELETE"])
def session_detail(request, session_id):
    """
    GET  /sessions/{session_id} — Retrieve full chat history.
    DELETE /sessions/{session_id} — Delete a session.
    """
    session = get_object_or_404(ChatSession, session_id=session_id)
    if request.method == "DELETE":
        session.delete()
        return Response({"message": "Session deleted."}, status=status.HTTP_204_NO_CONTENT)
    serializer = ChatSessionSerializer(session)
    return Response(serializer.data)
