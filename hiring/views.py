from django.db import connection
from django.http import JsonResponse

def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT extversion FROM pg_extension WHERE extname='vector'")
            row = cursor.fetchone()
            pgvector = row[0] if row else 'not installed'
        db_status = 'ok'
    except Exception as e:
        db_status = f'error: {e}'
        pgvector = 'unknown'

    return JsonResponse({
        'status': 'ok',
        'postgres': db_status,
        'pgvector': pgvector,
    })