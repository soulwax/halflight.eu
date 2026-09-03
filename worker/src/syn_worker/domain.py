from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class JobStatus(StrEnum):
	QUEUED = 'queued'
	RUNNING = 'running'
	COMPLETED = 'completed'
	FAILED = 'failed'


@dataclass(frozen=True, slots=True)
class Job:
	id: UUID
	idempotency_key: str
	provider: str
	resource_type: str
	resource_id: str
	quality: str
	output_format: str
	status: JobStatus
	progress: int
	attempts: int
	object_key: str | None
	media_mime_type: str | None
	media_size_bytes: int | None
	error_code: str | None
	error_message: str | None
	created_at: datetime
	started_at: datetime | None
	finished_at: datetime | None
