"""URL patterns for the Books app."""

from django.urls import path
from . import views

urlpatterns = [
    # Book CRUD
    path("books/", views.book_list, name="book-list"),
    path("books/<int:pk>/", views.book_detail, name="book-detail"),
    path("recommend/<int:pk>/", views.recommend_books, name="book-recommend"),

    # Scraping
    path("upload-book/", views.upload_book, name="upload-book"),
    path("bulk-scrape/", views.bulk_scrape, name="bulk-scrape"),
    path("scrape-status/<int:job_id>/", views.scrape_status, name="scrape-status"),

    # RAG Q&A
    path("ask/", views.ask_question, name="ask"),

    # Chat sessions
    path("sessions/", views.list_sessions, name="session-list"),
    path("sessions/<str:session_id>/", views.session_detail, name="session-detail"),
]
