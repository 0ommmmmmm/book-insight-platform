"""URL patterns for the Scraper app (task status endpoints)."""

from django.urls import path
from . import views

urlpatterns = [
    path("task-status/<str:task_id>/", views.task_status, name="task-status"),
]
