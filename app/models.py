from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Visitor(Base):
    __tablename__ = "visitors"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100), index=True)
    phone: Mapped[str] = mapped_column(String(10), index=True)
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    organization: Mapped[str | None] = mapped_column(String(100), nullable=True)
    purpose: Mapped[str] = mapped_column(String(200))
    host_name: Mapped[str] = mapped_column(String(100), index=True)
    id_proof_type: Mapped[str] = mapped_column(String(40))
    id_proof_number: Mapped[str] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), index=True, default="checked_in")
    check_in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    check_out_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
