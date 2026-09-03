from __future__ import annotations

import secrets
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, status

from .config import Settings
from .domain import JobStatus
from .leases import LeaseClient
from .repository import JobRepository, create_repository
from .schemas import CreateJobRequest, CreatePlaybackSessionRequest, HealthResponse, JobResponse, PlaybackTicket
from .service import JobNotFoundError, JobService, job_for
from .storage import ObjectStore, S3ObjectStore
from .streamrip_adapter import StreamripAdapter, extension_for, installed_streamrip_version


def require_internal_token(request: Request, authorization: str | None = Header(default=None)) -> None:
	settings: Settings = request.app.state.settings
	prefix = 'Bearer '
	supplied = authorization[len(prefix) :] if authorization and authorization.startswith(prefix) else ''
	if not supplied or not secrets.compare_digest(supplied, settings.internal_token):
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')


def service_for(request: Request) -> JobService:
	return request.app.state.service


def create_app(settings: Settings, repository: JobRepository | None = None, object_store: ObjectStore | None = None) -> FastAPI:
	engine = None
	if repository is None:
		repository, engine = create_repository(settings.database_url)
	if object_store is None:
		object_store = S3ObjectStore(settings)

	@asynccontextmanager
	async def lifespan(_: FastAPI) -> AsyncIterator[None]:
		try:
			yield
		finally:
			if engine is not None:
				await engine.dispose()

	app = FastAPI(title='Syn stream worker', version='0.1.0', lifespan=lifespan, docs_url=None, redoc_url=None)
	app.state.settings = settings
	app.state.repository = repository
	app.state.service = JobService(repository)
	app.state.leases = LeaseClient(settings)
	app.state.adapter = StreamripAdapter(object_store)
	app.state.object_store = object_store

	@app.get('/v1/health', response_model=HealthResponse)
	async def health(response: Response) -> HealthResponse:
		try:
			await repository.health()
		except Exception:
			response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
			raise HTTPException(status_code=503, detail='Database unavailable') from None
		return HealthResponse(status='ok', version=installed_streamrip_version())

	@app.post('/v1/jobs', response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(require_internal_token)])
	async def create_job(body: CreateJobRequest, service: JobService = Depends(service_for)) -> JobResponse:
		return JobResponse.from_job(await service.submit(body))

	@app.get('/v1/jobs/{job_id}', response_model=JobResponse, dependencies=[Depends(require_internal_token)])
	async def get_job(job_id: str, service: JobService = Depends(service_for)) -> JobResponse:
		try:
			return JobResponse.from_job(await service.get(job_id))
		except JobNotFoundError:
			raise HTTPException(status_code=404, detail='Job not found') from None

	@app.post('/v1/playback/sessions', response_model=PlaybackTicket, dependencies=[Depends(require_internal_token)])
	async def create_playback_session(body: CreatePlaybackSessionRequest) -> PlaybackTicket:
		job = job_for(
			job_id=str(body.job_id),
			resource=body.track_id,
			quality=body.quality,
			format_name=None,
			status=JobStatus.QUEUED
		)
		job = await repository.get_or_create(job.idempotency_key, lambda: _ready(job))
		try:
			if job.status.value == 'queued':
				lease = await app.state.leases.acquire(job)
				result = await app.state.adapter.download(job, lease)
				await repository.complete(str(job.id), object_key=result.object_key, mime_type=result.mime_type, size_bytes=result.size_bytes)
				job = await repository.get(str(job.id))
			if job is None or not job.object_key or job.status.value != 'completed':
				raise RuntimeError('Playback object is not ready')
			url = await app.state.object_store.playback_url(job.object_key)
			return PlaybackTicket(
				id=job.id,
				playback_url=url.url,
				expires_at=url.expires_at,
				mime_type=job.media_mime_type,
				file_extension=f'.{extension_for(job.media_mime_type or "application/octet-stream")}',
				audio_quality=job.quality
			)
		except Exception:
			# Never expose provider, object-store, or credential details over this boundary.
			raise HTTPException(status_code=503, detail='Playback preparation failed') from None

	return app


async def _ready(job):
	return job
