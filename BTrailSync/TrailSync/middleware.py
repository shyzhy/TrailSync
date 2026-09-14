"""Turn an unexpected crash in an API view into a calm JSON 500."""
import logging

from django.http import JsonResponse

logger = logging.getLogger("TrailSync.errors")


class ApiErrorMiddleware:
    """For /api/ paths only, answer an unhandled exception with JSON.

    Without this, a bug in a view returns Django's HTML error page - or, with
    DEBUG on, the full traceback - which the React app can neither read nor
    should ever show. The error is still logged in full on the server, where
    it belongs; the browser only gets the generic sentence. Exceptions DRF
    already handles (validation, permissions, 404s) never reach here.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        if not request.path.startswith("/api/"):
            return None  # the admin and friends keep Django's normal handling
        logger.exception("Unhandled error on %s %s", request.method, request.path)
        return JsonResponse(
            {"code": "server_error", "detail": "Something went wrong on our end. Please try again in a moment."},
            status=500,
        )
