from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from .domain import Job

AudioQuality = Literal['LOW', 'HIGH', 'LOSSLESS', 'HI_RES_LOSSLESS']
DownloadFormat = Literal['FLAC', 'ALAC', 'MP3', 'AAC', 'OPUS']


class CreateJobRequest(BaseModel):
	"""Syn's persistent-download wire contract. It must contain no OAuth material."""

	job_id: UUID | None = Field(default=None, validation_alias='jobId', serialization_alias='jobId')
	resource: str = Field(min_length=1, max_length=128, pattern=r'^[A-Za-z0-9_-]+$')
	quality: AudioQuality
	format: DownloadFormat | None = None


class JobResponse(BaseModel):
	id: UUID
	state: Literal['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']
	resource: str
	quality: AudioQuality
	format: DownloadFormat | None = None
	progress: dict[str, int] | None = None
	failure_code: str | None = Field(serialization_alias='failureCode')
	created_at: datetime = Field(serialization_alias='createdAt')
	updated_at: datetime = Field(serialization_alias='updatedAt')

	@classmethod
	def from_job(cls, job: Job) -> 'JobResponse':
		format_by_output = {'flac': 'FLAC', 'm4a': 'AAC', 'mp3': 'MP3', 'opus': 'OPUS'}
		state_by_status = {
			'queued': 'QUEUED',
			'running': 'RUNNING',
			'completed': 'COMPLETED',
			'failed': 'FAILED'
		}
		return cls(
			id=job.id,
			state=state_by_status[job.status],
			resource=job.resource_id,
			quality=job.quality,
			format=format_by_output.get(job.output_format),
			progress={'completed': job.progress, 'total': 100},
			failure_code=job.error_code,
			created_at=job.created_at,
			updated_at=job.finished_at or job.started_at or job.created_at
		)


class CreatePlaybackSessionRequest(BaseModel):
	job_id: UUID = Field(validation_alias='jobId', serialization_alias='jobId')
	track_id: str = Field(
		validation_alias='trackId', serialization_alias='trackId', min_length=1, max_length=128
	)
	quality: AudioQuality
	loudness_normalization: bool = Field(
		validation_alias='loudnessNormalization', serialization_alias='loudnessNormalization'
	)


class PlaybackTicket(BaseModel):
	id: UUID
	playback_url: str = Field(serialization_alias='playbackUrl')
	expires_at: datetime = Field(serialization_alias='expiresAt')
	mime_type: str | None = Field(default=None, serialization_alias='mimeType')
	file_extension: str | None = Field(default=None, serialization_alias='fileExtension')
	audio_quality: AudioQuality | None = Field(default=None, serialization_alias='audioQuality')


class HealthResponse(BaseModel):
	status: Literal['ok']
	version: str
