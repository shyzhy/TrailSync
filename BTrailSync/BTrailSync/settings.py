"""Django settings for the BTrailSync project."""

from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=False, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='', cast=Csv())


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    'TrailSync'
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # Last, so it sees any exception the views above didn't handle.
    'TrailSync.middleware.ApiErrorMiddleware',
]

ROOT_URLCONF = 'BTrailSync.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'BTrailSync.wsgi.application'


DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}



AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

AUTH_USER_MODEL = "TrailSync.User"

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'TrailSync.authentication.StatusAwareJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # Only views that opt in with ScopedRateThrottle are limited. Counts live in the cache, so production needs a shared cache (e.g. Redis).
    'DEFAULT_THROTTLE_RATES': {
        'register': '10/hour',
        'activation_resend': '5/hour',
        'activation': '30/hour',
        'password_reset': '5/hour',
        'password_reset_confirm': '20/hour',
        'account_setup': '20/hour',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
    # Refresh is refused for suspended accounts too, not only for deleted or inactive ones.
    'USER_AUTHENTICATION_RULE': 'TrailSync.authentication.active_account_rule',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# CORS (django-cors-headers): list the frontend's origin per deployment.
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='', cast=Csv())

LANGUAGE_CODE = 'en-us'

# Asia/Manila so printed timestamps and "today" counts match the service window; USE_TZ keeps the database in UTC.
TIME_ZONE = 'Asia/Manila'

USE_I18N = True

USE_TZ = True


STATIC_URL = 'static/'

# Uploads are served by urls.py in DEBUG only; a real deployment needs a proper file store.
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Email settings come from .env; with EMAIL_BACKEND unset, messages print to the runserver log instead.
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='localhost')
EMAIL_PORT = config('EMAIL_PORT', default=25, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=False, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
# Gmail rewrites any From address that isn't the authenticated account, so this must match EMAIL_HOST_USER.
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='TrailSync Registrar <no-reply@trailsync.local>')
# Fail a stuck SMTP connection instead of hanging the request.
EMAIL_TIMEOUT = 20

# Emailed links point at the React app, which renders the page and calls the API itself.
FRONTEND_BASE_URL = config('FRONTEND_BASE_URL', default='http://localhost:5173')

# Absolute media URLs for the browser: the frontend is another origin, where "/media/..." would hit the Vite server.
BACKEND_BASE_URL = config('BACKEND_BASE_URL', default='http://127.0.0.1:8000')
