"""Scraper app views — task status polling."""

from celery.result import AsyncResult
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def task_status(request, task_id):
    """
    GET /task-status/{task_id}
    Poll the status of a Celery task (scrape or insights generation).
    """
    result = AsyncResult(task_id)

    response_data = {
        "task_id": task_id,
        "status": result.status,  # PENDING | STARTED | SUCCESS | FAILURE | RETRY
        "result": None,
    }

    if result.ready():
        if result.successful():
            response_data["result"] = result.result
        else:
            response_data["result"] = {"error": str(result.result)}

    return Response(response_data)
