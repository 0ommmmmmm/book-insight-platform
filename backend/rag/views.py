"""RAG management endpoints."""

import logging
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from books.models import Book
from .pipeline import RAGPipeline

logger = logging.getLogger(__name__)
rag = RAGPipeline()


@api_view(["POST"])
def embed_book(request, pk):
    """
    POST /embed/{id}
    Manually trigger embedding for a specific book.
    Useful if a book was added without auto-embedding.
    """
    book = get_object_or_404(Book, pk=pk)

    if not book.description:
        return Response(
            {"error": "Book has no description to embed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        rag.index_book(book.id, book.title, book.author, book.description)
        book.is_embedded = True
        book.save(update_fields=["is_embedded"])
        return Response({"message": f"Book '{book.title}' embedded successfully."})
    except Exception as exc:
        logger.error("Embedding failed for book %s: %s", pk, exc)
        return Response(
            {"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
def embed_all_books(request):
    """
    POST /embed-all
    Batch embed all books that haven't been embedded yet.
    """
    books = Book.objects.filter(is_embedded=False, description__gt="")
    count = 0
    errors = []

    for book in books:
        try:
            rag.index_book(book.id, book.title, book.author, book.description)
            book.is_embedded = True
            book.save(update_fields=["is_embedded"])
            count += 1
        except Exception as exc:
            errors.append({"book_id": book.id, "error": str(exc)})

    return Response(
        {
            "embedded": count,
            "failed": len(errors),
            "errors": errors,
        }
    )
