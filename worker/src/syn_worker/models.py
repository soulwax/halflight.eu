from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
	pass


class MediaJobModel(Base):
	__tablename__ = 'media_jobs'

	id: Mapped[UUID] = mapped_column(primary_key=True)
	idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
	provider: Mapped[str] = mapped_column(String(32))
	resource_type: Mapped[str] = mapped_column(String(32))
	resource_id: Mapped[str] = mapped_column(String(128))
	quality: Mapped[str] = mapped_column(String(32))
	output_format: Mapped[str] = mapped_column(String(16))
	status: Mapped[str] = mapped_column(String(16), index=True)
	progress: Mapped[int] = mapped_column(Integer, default=0)
	attempts: Mapped[int] = mapped_column(Integer, default=0)
	object_key: Mapped[str | None] = mapped_column(Text, nullable=True)
	media_mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
	media_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
	error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
	error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
	started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
	finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
	)
