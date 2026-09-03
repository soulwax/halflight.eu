from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from .domain import Job, JobStatus
from .models import MediaJobModel

JobFactory = Callable[[], Awaitable[Job]]


def model_values(job: Job) -> dict[str, object]:
	return {
		'id': job.id,
		'idempotency_key': job.idempotency_key,
		'provider': job.provider,
		'resource_type': job.resource_type,
		'resource_id': job.resource_id,
		'quality': job.quality,
		'output_format': job.output_format,
		'status': str(job.status),
		'progress': job.progress,
		'attempts': job.attempts,
		'object_key': job.object_key,
		'media_mime_type': job.media_mime_type,
		'media_size_bytes': job.media_size_bytes,
		'error_code': job.error_code,
		'error_message': job.error_message,
		'created_at': job.created_at,
		'started_at': job.started_at,
		'finished_at': job.finished_at
	}


def to_job(model: MediaJobModel) -> Job:
	return Job(
		id=model.id,
		idempotency_key=model.idempotency_key,
		provider=model.provider,
		resource_type=model.resource_type,
		resource_id=model.resource_id,
		quality=model.quality,
		output_format=model.output_format,
		status=JobStatus(model.status),
		progress=model.progress,
		attempts=model.attempts,
		object_key=model.object_key,
		media_mime_type=model.media_mime_type,
		media_size_bytes=model.media_size_bytes,
		error_code=model.error_code,
		error_message=model.error_message,
		created_at=model.created_at,
		started_at=model.started_at,
		finished_at=model.finished_at
	)


class JobRepository:
	"""PostgreSQL job state. No tokens, grants, media bytes, or local paths are stored here."""

	def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
		self._session_factory = session_factory

	async def health(self) -> None:
		async with self._session_factory() as session:
			await session.execute(text('SELECT 1'))

	async def get(self, job_id: str) -> Job | None:
		async with self._session_factory() as session:
			model = await session.get(MediaJobModel, job_id)
			return to_job(model) if model else None

	async def get_or_create(self, idempotency_key: str, create: JobFactory) -> Job:
		async with self._session_factory() as session:
			existing = await session.scalar(
				select(MediaJobModel).where(MediaJobModel.idempotency_key == idempotency_key)
			)
			if existing:
				return to_job(existing)
			job = await create()
			model = MediaJobModel(**model_values(job))
			session.add(model)
			try:
				await session.commit()
			except IntegrityError:
				await session.rollback()
				winner = await session.scalar(
					select(MediaJobModel).where(MediaJobModel.idempotency_key == idempotency_key)
				)
				if winner:
					return to_job(winner)
				raise
			await session.refresh(model)
			return to_job(model)

	async def claim_next(self) -> Job | None:
		"""Atomically lease one queued job; safe for several runner processes."""
		async with self._session_factory() as session:
			async with session.begin():
				model = await session.scalar(
					select(MediaJobModel)
					.where(MediaJobModel.status == JobStatus.QUEUED.value)
					.order_by(MediaJobModel.created_at)
					.limit(1)
					.with_for_update(skip_locked=True)
				)
				if model is None:
					return None
				model.status = JobStatus.RUNNING.value
				model.started_at = datetime.now(UTC)
				model.attempts += 1
			return to_job(model)

	async def complete(
		self, job_id: str, *, object_key: str, mime_type: str, size_bytes: int
	) -> None:
		async with self._session_factory() as session:
			model = await session.get(MediaJobModel, job_id, with_for_update=True)
			if model is None:
				return
			model.status = JobStatus.COMPLETED.value
			model.progress = 100
			model.object_key = object_key
			model.media_mime_type = mime_type
			model.media_size_bytes = size_bytes
			model.finished_at = datetime.now(UTC)
			await session.commit()

	async def fail(self, job_id: str, *, code: str, message: str) -> None:
		async with self._session_factory() as session:
			model = await session.get(MediaJobModel, job_id, with_for_update=True)
			if model is None:
				return
			model.status = JobStatus.FAILED.value
			model.error_code = code
			model.error_message = message[:500]
			model.finished_at = datetime.now(UTC)
			await session.commit()


def create_repository(database_url: str) -> tuple[JobRepository, AsyncEngine]:
	engine = create_async_engine(database_url, pool_pre_ping=True)
	return JobRepository(async_sessionmaker(engine, expire_on_commit=False)), engine
