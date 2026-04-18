"""
Celery application entry point.
Handles async background jobs: scraping, embedding, AI calls.
"""

import os
from celery import Celery

# Tell Celery where Django settings live
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("book_insight")

# Read config from Django settings, namespace=CELERY
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Celery health-check task."""
    print(f"Request: {self.request!r}")
