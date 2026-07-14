import os
import socket
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import dj_database_url

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-secret-key')
DEBUG = os.environ.get('DJANGO_DEBUG', '1') == '1'

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '*').split()

INSTALLED_APPS = [
    'daphne',
    'channels',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'drf_spectacular',
    'corsheaders',
    'cloudinary_storage',
    'cloudinary',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'trike_server.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR.parent / 'build'], 
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'trike_server.wsgi.application'
ASGI_APPLICATION = 'trike_server.asgi.application'

_REDIS_URL = os.environ.get('REDIS_URL', '')
if _REDIS_URL:
    # Production (Railway): Use Redis channel layer so WebSocket broadcasts
    # work correctly across multiple workers/processes.
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [_REDIS_URL],
            },
        },
    }
else:
    # Development: In-memory layer (single process only)
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }

def _is_mysql_available(host, port):
    if host not in ('127.0.0.1', 'localhost'):
        return True
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)
        s.connect((host, int(port)))
        s.close()
        return True
    except Exception:
        return False

mysql_host = os.environ.get('MYSQLHOST', os.environ.get('MYSQL_HOST', '127.0.0.1'))
mysql_port = os.environ.get('MYSQLPORT', os.environ.get('MYSQL_PORT', '3306'))

if os.environ.get('USE_SQLITE') == 'True' or not _is_mysql_available(mysql_host, mysql_port):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': os.environ.get('MYSQLDATABASE', os.environ.get('MYSQL_DATABASE', 'transport')),
            'USER': os.environ.get('MYSQLUSER', os.environ.get('MYSQL_USER', 'root')),
            'PASSWORD': os.environ.get('MYSQLPASSWORD', os.environ.get('MYSQL_PASSWORD', '')),
            'HOST': mysql_host,
            'PORT': mysql_port,
        }
    }

# Production Database Override
if 'MYSQL_URL' in os.environ:
    DATABASES['default'] = dj_database_url.parse(os.environ['MYSQL_URL'], conn_max_age=600)
elif 'DATABASE_URL' in os.environ:
    DATABASES['default'] = dj_database_url.config(conn_max_age=600)

AUTH_USER_MODEL = 'api.User'

AUTHENTICATION_BACKENDS = [
    'api.backends.EmailOrUsernameBackend',
    'django.contrib.auth.backends.ModelBackend',
]


AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Manila'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ── Cloudinary Media Storage (Production) ────────────────────────────────────
# Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
# as Railway environment variables. Falls back to local disk in development.
CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME', '')
CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY', '')
CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET', '')

if CLOUDINARY_CLOUD_NAME:
    import cloudinary
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True
    )
    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ALLOW_ALL_ORIGINS = os.environ.get('CORS_ALLOW_ALL_ORIGINS', 'True') == 'True'

# Provide allowed origins via comma-separated list in env var if CORS_ALLOW_ALL_ORIGINS is False
_cors_allowed = os.environ.get('CORS_ALLOWED_ORIGINS', '')
if _cors_allowed:
    CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _cors_allowed.split(',') if origin.strip()]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'api.auth.JWTDeviceSessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
    # ── Rate Limiting / Throttling ────────────────────────────────────────────
    # Protects public auth endpoints from brute-force and bot spam.
    # Scoped throttles are applied per-view; only the named scopes below are active.
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'login':       '5/minute',    # Max 5 login attempts per IP per minute
        'register':    '3/minute',    # Max 3 registrations per IP per minute
        'check_field': '30/minute',   # Email/username availability checks (form typing)
        'pin':         '5/minute',    # PIN set / update attempts per IP per minute
        'resend_otp':  '3/hour',      # Max 3 resend OTP requests per hour per IP
    },
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}

# ── Email Configuration (Gmail SMTP) ─────────────────────────────────────────
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
# Default to port 587 TLS (more compatible with cloud providers like Railway)
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'False') == 'True'
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')

# Ensure DEFAULT_FROM_EMAIL is a valid non-empty string or fallback
_host_user = os.environ.get('EMAIL_HOST_USER', '').strip()
DEFAULT_FROM_EMAIL = _host_user if _host_user else 'noreply@transmart.com'
ADMIN_NOTIFICATION_EMAIL = os.environ.get('ADMIN_EMAIL', _host_user if _host_user else 'admin@transmart.com')


# ── drf-spectacular / Swagger API Documentation ────────────────────────────────
SPECTACULAR_SETTINGS = {
    'TITLE': 'TrentoSmart API',
    'DESCRIPTION': (
        'Backend REST API for TrentoSmart — a Smart Tricycle Ride-Hailing System '
        'developed for the Municipality of Trento, Agusan del Sur. '
        'Built with Django REST Framework + Django Channels (WebSockets).'
    ),
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'CONTACT': {'name': 'TrentoSmart Dev Team'},
    'LICENSE': {'name': 'MIT'},
    'TAGS': [
        {'name': 'Auth', 'description': 'Registration, login, email verification & password reset'},
        {'name': 'Rides', 'description': 'Ride requests, acceptance, and tracking'},
        {'name': 'Driver', 'description': 'Driver-specific endpoints (analytics, verification)'},
        {'name': 'Wallet', 'description': 'In-app wallet, top-ups, and withdrawals'},
        {'name': 'Admin / Reports', 'description': 'LGU admin analytics and CSV/PDF exports'},
        {'name': 'Safety', 'description': 'Incidents, complaints, and fraud alerts'},
    ],
}

