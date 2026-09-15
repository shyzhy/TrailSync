"""WSGI entry point for the BTrailSync project."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'BTrailSync.settings')

application = get_wsgi_application()
