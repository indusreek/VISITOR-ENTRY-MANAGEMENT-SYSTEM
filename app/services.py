from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models import Visitor

try:
    LOCAL_TZ = datetime.now().astimezone().tzinfo or ZoneInfo("Asia/Kolkata")
except Exception:
    LOCAL_TZ = ZoneInfo("Asia/Kolkata")


def ensure_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def local_day_bounds_utc(day: datetime | None = None) -> tuple[datetime, datetime]:
    if day is None:
        local_now = datetime.now(LOCAL_TZ)
    else:
        local_now = day.astimezone(LOCAL_TZ) if day.tzinfo else day.replace(tzinfo=LOCAL_TZ)
    start = datetime.combine(local_now.date(), time.min, tzinfo=LOCAL_TZ)
    end = datetime.combine(local_now.date(), time.max, tzinfo=LOCAL_TZ)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def date_range_bounds_utc(date_from: str, date_to: str) -> tuple[datetime, datetime]:
    start_local = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=LOCAL_TZ)
    end_local = datetime.combine(
        datetime.strptime(date_to, "%Y-%m-%d").date(),
        time.max,
        tzinfo=LOCAL_TZ,
    )
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def search_visitors(db: Session, q: str | None, status: str | None) -> list[Visitor]:
    query = db.query(Visitor)
    if status:
        query = query.filter(Visitor.status == status)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Visitor.full_name.ilike(term),
                Visitor.phone.ilike(term),
                Visitor.host_name.ilike(term),
                Visitor.purpose.ilike(term),
                Visitor.organization.ilike(term),
            )
        )
    return query.order_by(Visitor.check_in_time.desc()).all()


def open_visit_for_phone(db: Session, phone: str, exclude_id: int | None = None) -> Visitor | None:
    query = db.query(Visitor).filter(Visitor.phone == phone, Visitor.status == "checked_in")
    if exclude_id is not None:
        query = query.filter(Visitor.id != exclude_id)
    return query.first()


def count_today(db: Session, field, extra_status: str | None = None) -> int:
    start, end = local_day_bounds_utc()
    query = db.query(func.count(Visitor.id)).filter(field >= start, field <= end)
    if extra_status:
        query = query.filter(Visitor.status == extra_status)
    return int(query.scalar() or 0)
