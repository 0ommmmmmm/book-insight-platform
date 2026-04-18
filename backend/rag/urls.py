"""URL patterns for the RAG app."""

from django.urls import path
from . import views

urlpatterns = [
    path("embed/<int:pk>/", views.embed_book, name="embed-book"),
    path("embed-all/", views.embed_all_books, name="embed-all"),
]
