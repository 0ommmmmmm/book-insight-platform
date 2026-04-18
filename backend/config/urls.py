"""Root URL configuration for Book Insight Platform."""

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health_check(request):
    """Simple health-check endpoint for load balancers / monitoring."""
    return JsonResponse({"status": "ok", "service": "book-insight-platform"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health_check),
    # All API routes are versioned under /api/v1/
    path("api/v1/", include("books.urls")),
    path("api/v1/", include("rag.urls")),
    path("api/v1/", include("scraper.urls")),
]
