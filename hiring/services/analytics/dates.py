from datetime import datetime


def days_between(a, b):
    if not a or not b:
        return None
    try:
        da = a if isinstance(a, datetime) else datetime.strptime(str(a)[:10], "%Y-%m-%d")
        db = b if isinstance(b, datetime) else datetime.strptime(str(b)[:10], "%Y-%m-%d")
        return (db - da).days
    except (ValueError, TypeError):
        return None
