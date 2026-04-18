"""
Books app models.
Stores book metadata + AI-generated insights.
"""

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class Book(models.Model):
    """Core book metadata, scraped or manually entered."""

    title = models.CharField(max_length=500, db_index=True)
    author = models.CharField(max_length=300, db_index=True)
    rating = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(5.0)],
    )
    description = models.TextField(blank=True)
    book_url = models.URLField(max_length=1000, unique=True)
    cover_url = models.URLField(max_length=1000, blank=True)
    genres = models.JSONField(default=list, blank=True)    # ['Fiction', 'Mystery']
    pages = models.PositiveIntegerField(null=True, blank=True)
    published_year = models.PositiveIntegerField(null=True, blank=True)

    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Embedding status
    is_embedded = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["author"]),
            models.Index(fields=["rating"]),
        ]

    def __str__(self):
        return f"{self.title} — {self.author}"


class AIInsight(models.Model):
    """Cached AI-generated insights for a book."""

    INSIGHT_TYPES = [
        ("summary", "Summary"),
        ("genre", "Genre Classification"),
        ("sentiment", "Sentiment Analysis"),
        ("keywords", "Key Themes"),
    ]

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="insights")
    insight_type = models.CharField(max_length=50, choices=INSIGHT_TYPES)
    content = models.TextField()
    model_used = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("book", "insight_type")
        ordering = ["insight_type"]

    def __str__(self):
        return f"{self.insight_type} for {self.book.title}"


class ChatSession(models.Model):
    """A user Q&A session with chat history."""

    session_id = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Session {self.session_id}"


class ChatMessage(models.Model):
    """Individual message within a chat session."""

    ROLES = [("user", "User"), ("assistant", "Assistant")]

    session = models.ForeignKey(
        ChatSession, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=20, choices=ROLES)
    content = models.TextField()
    sources = models.JSONField(default=list, blank=True)   # cited book IDs/titles
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.role}] {self.content[:60]}"


class ScrapeJob(models.Model):
    """Tracks bulk scraping jobs (Celery tasks)."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("running", "Running"),
        ("done", "Done"),
        ("failed", "Failed"),
    ]

    task_id = models.CharField(max_length=200, unique=True, blank=True)
    urls = models.JSONField(default=list)            # list of book URLs to scrape
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    books_scraped = models.PositiveIntegerField(default=0)
    books_failed = models.PositiveIntegerField(default=0)
    error_log = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"ScrapeJob {self.id} [{self.status}]"
