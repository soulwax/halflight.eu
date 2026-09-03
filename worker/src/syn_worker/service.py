from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from .domain import Job, JobStatus
from .repository import JobRepository
from .schemas import CreateJobRequest


class JobNotFoundError(LookupError):
	pass


def output_format(format_name: str | None) -> str:
	return {
		None: 'original',
		'FLAC': 'flac',
		'ALAC': 'm4a',
		'MP3': 'mp3',
		'AAC': 'm4a',
		'OPUS': 'opus'
	}[format_name]


def job_for(
	*, job_id: str | None, resource: str, quality: str, format_name: str | None, status: JobStatus
) -> Job:
	now = datetime.now(UTC)
	return Job(
	id=uuid4() if job_id is None else UUID(job_id),
		idempotency_key=f'worker:{job_id or uuid4()}',
		provider='tidal',
		resource_type='track',
		resource_id=resource,
		quality=quality,
		output_format=output_format(format_name),
		status=status,
		progress=0,
		attempts=0,
		object_key=None,
		media_mime_type=None,
		media_size_bytes=None,
		error_code=None,
		error_message=None,
		created_at=now,
		started_at=now if status is JobStatus.RUNNING else None,
		finished_at=None
	)


class JobService:
	def __init__(self, repository: JobRepository):
		self._repository = repository

	async def submit(self, request: CreateJobRequest) -> Job:
		job = job_for(
			job_id=str(request.job_id) if request.job_id else None,
			resource=request.resource,
			quality=request.quality,
			format_name=request.format,
			status=JobStatus.QUEUED
		)
		return await self._repository.get_or_create(job.idempotency_key, lambda: _ready(job))

	async def get(self, job_id: str) -> Job:
		job = await self._repository.get(job_id)
		if job is None:
			raise JobNotFoundError(job_id)
		return job


async def _ready(job: Job) -> Job:
	return job
