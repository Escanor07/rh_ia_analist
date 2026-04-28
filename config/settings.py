import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv('SECRET_KEY')
DEBUG = os.getenv('DJANGO_DEBUG', 'True') == 'True'
ALLOWED_HOSTS = ['*']


CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'hiring-locmem',
    }
}

DASHBOARD_ANALYTICS_CACHE_SECONDS = int(os.getenv('DASHBOARD_ANALYTICS_CACHE_SECONDS', '120'))

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.postgres',
    'hiring',
]

MIDDLEWARE = [
    'config.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }, 'auth_db': {
        "ENGINE": "django.db.backends.mysql",
        "HOST": os.getenv("DB_HOST_ZD", "localhost"),
        "NAME": os.getenv("DB_NAME_ZD", ""),
        "USER": os.getenv("DB_USER_ZD", ""),
        "PASSWORD": os.getenv("DB_PASSWORD_ZD", ""),
        "PORT": os.getenv("DB_PORT_ZD", "3306"),
        'CONN_MAX_AGE': 60,
        "OPTIONS": { "sql_mode": "traditional", },
    }
}

DATABASE_ROUTERS = ['config.routers.AuthRouter']  

TIME_ZONE = 'America/Costa_Rica'
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_EMBEDDING_MODEL = os.getenv('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-large')
OPENAI_EMBEDDING_DIMENSIONS = int(os.getenv('OPENAI_EMBEDDING_DIMENSIONS', '1536'))
OPENAI_LLM_MODEL = os.getenv('OPENAI_LLM_MODEL', 'gpt-4.1-mini')
EMBED_BATCH_SIZE = int(os.getenv('EMBED_BATCH_SIZE', '64'))

CLIENT_MYSQL_HOST = os.getenv('CLIENT_MYSQL_HOST', '')
CLIENT_MYSQL_PORT = int(os.getenv('CLIENT_MYSQL_PORT', '3306'))
CLIENT_MYSQL_DB = os.getenv('CLIENT_MYSQL_DB', '')
CLIENT_MYSQL_USER = os.getenv('CLIENT_MYSQL_USER', '')
CLIENT_MYSQL_PASSWORD = os.getenv('CLIENT_MYSQL_PASSWORD', '')

S3_CV_BUCKET = os.getenv("S3_CV_BUCKET", "")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-2")

DATA_CUTOFF_DATE = os.getenv("DATA_CUTOFF_DATE", "2025-07-01")
