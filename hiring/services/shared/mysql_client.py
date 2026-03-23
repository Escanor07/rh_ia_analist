from contextlib import contextmanager
from django.conf import settings
import MySQLdb


class MySQLClient:
    def __init__(self):
        self.config = {
            "host": settings.CLIENT_MYSQL_HOST,
            "port": settings.CLIENT_MYSQL_PORT,
            "db": settings.CLIENT_MYSQL_DB,
            "user": settings.CLIENT_MYSQL_USER,
            "passwd": settings.CLIENT_MYSQL_PASSWORD,
            "charset": "utf8mb4",
            "connect_timeout": 10,
        }

    def _get_connection(self):
        return MySQLdb.connect(**self.config)

    def fetch_all(self, query: str, params: tuple = ()) -> list[dict]:
        conn = self._get_connection()
        try:
            cursor = conn.cursor(MySQLdb.cursors.DictCursor)
            try:
                cursor.execute(query, params)
                return cursor.fetchall()
            finally:
                cursor.close()
        finally:
            conn.close()

    def fetch_one(self, query: str, params: tuple = ()) -> dict | None:
        rows = self.fetch_all(query, params)
        return rows[0] if rows else None

    @contextmanager
    def scoped_queries(self):
        """A connection and cursor for multiple queries."""
        conn = self._get_connection()
        cur = conn.cursor(MySQLdb.cursors.DictCursor)
        try:

            class _Session:
                def fetch_all(self, query: str, params: tuple = ()) -> list[dict]:
                    cur.execute(query, params)
                    return cur.fetchall()

                def fetch_one(self, query: str, params: tuple = ()) -> dict | None:
                    cur.execute(query, params)
                    row = cur.fetchone()
                    return row

            yield _Session()
        finally:
            cur.close()
            conn.close()
