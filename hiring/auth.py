import json
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.db import connections
from django.http import JsonResponse
from django.views.decorators.http import require_POST

_TOKEN_LIFETIME_HOURS = 8
_GENERIC_AUTH_ERROR = "Credenciales incorrectas"


def _fetch_user(username: str) -> dict | None:
    sql = (
        "SELECT id, username, password, is_active, email, first_name, last_name "
        "FROM auth_user WHERE username = %s LIMIT 1"
    )
    with connections["auth_db"].cursor() as cursor:
        cursor.execute(sql, [username])
        columns = [col[0] for col in cursor.description]
        row = cursor.fetchone()
    if row is None:
        return None
    return dict(zip(columns, row))


def _issue_token(user: dict) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        "user_id": user["id"],
        "username": user["username"],
        "iat": now,
        "exp": now + timedelta(hours=_TOKEN_LIFETIME_HOURS),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def jwt_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        if not token:
            return JsonResponse({"error": "Token de autenticación requerido"}, status=401)
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            request.user_payload = payload
        except jwt.ExpiredSignatureError:
            return JsonResponse({"error": "Token expirado"}, status=401)
        except jwt.InvalidTokenError:
            return JsonResponse({"error": "Token inválido"}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper


@require_POST
def login(request):
    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON inválido"}, status=400)

    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    if not username or not password:
        return JsonResponse({"error": "username y password son requeridos"}, status=400)

    user = _fetch_user(username)
    # Dummy hash evita timing attack cuando el usuario no existe
    stored_hash = user["password"] if user else "pbkdf2_sha256$1$aaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaa="
    password_ok = check_password(password, stored_hash)

    if user is None or not password_ok or not user["is_active"]:
        return JsonResponse({"error": _GENERIC_AUTH_ERROR}, status=401)

    token = _issue_token(user)
    return JsonResponse({
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
        },
    })
