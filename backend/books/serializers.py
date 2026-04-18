"""
Serializers for the Books app.
Convert model instances ↔ JSON for the REST API.
"""

from rest_framework import serializers
from .models import Book, AIInsight, ChatSession, ChatMessage, ScrapeJob


class AIInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIInsight
        fields = ["insight_type", "content", "model_used", "created_at"]


class BookListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views (no heavy insight data)."""

    class Meta:
        model = Book
        fields = [
            "id", "title", "author", "rating", "description",
            "book_url", "cover_url", "genres", "pages",
            "published_year", "is_embedded", "created_at",
        ]


class BookDetailSerializer(serializers.ModelSerializer):
    """Full serializer with nested AI insights."""

    insights = AIInsightSerializer(many=True, read_only=True)

    class Meta:
        model = Book
        fields = "__all__"


class BookCreateSerializer(serializers.ModelSerializer):
    """Used when saving a scraped or manually submitted book."""

    class Meta:
        model = Book
        fields = [
            "title", "author", "rating", "description",
            "book_url", "cover_url", "genres", "pages", "published_year",
        ]

    def validate_rating(self, value):
        if value is not None and not (0 <= value <= 5):
            raise serializers.ValidationError("Rating must be between 0 and 5.")
        return value


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id", "role", "content", "sources", "created_at"]


class ChatSessionSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = ["session_id", "created_at", "updated_at", "messages"]


class AskRequestSerializer(serializers.Serializer):
    """Validates the /ask POST payload."""

    question = serializers.CharField(min_length=3, max_length=1000)
    session_id = serializers.CharField(max_length=64, required=False, allow_blank=True)
    top_k = serializers.IntegerField(min_value=1, max_value=10, default=3)


class UploadBookSerializer(serializers.Serializer):
    """Validates the /upload-book POST payload (single URL)."""

    url = serializers.URLField()
    generate_insights = serializers.BooleanField(default=True)


class BulkScrapeSerializer(serializers.Serializer):
    """Validates the /bulk-scrape POST payload (multiple URLs)."""

    urls = serializers.ListField(
        child=serializers.URLField(),
        min_length=1,
        max_length=50,
    )
    generate_insights = serializers.BooleanField(default=True)


class ScrapeJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScrapeJob
        fields = [
            "id", "task_id", "urls", "status",
            "books_scraped", "books_failed", "error_log",
            "created_at", "updated_at",
        ]
