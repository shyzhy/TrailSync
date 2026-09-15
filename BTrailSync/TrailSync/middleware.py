"""Turn an unexpected crash in an API view into a calm JSON 500."""
import logging

from django.http import JsonResponse

logger = logging.getLogger("TrailSync.errors")


class ApiErrorMiddleware:
    """For /api/ paths only, answer an unhandled exception with a generic JSON message; the full error is still logged."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        if not request.path.startswith("/api/"):
            return None  # The admin and friends keep Django's normal handling.
        logger.exception("Unhandled error on %s %s", request.method, request.path)
        return JsonResponse(
            {"code": "server_error", "detail": "Something went wrong on our end. Please try again in a moment."},
            status=500,
        )
