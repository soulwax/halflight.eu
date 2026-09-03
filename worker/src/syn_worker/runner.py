from __future__ import annotations

import asyncio
import logging

from .config import Settings
from .leases import LeaseClient
from .repository import JobRepository, create_repository
from .storage import S3ObjectStore
from .streamrip_adapter import StreamripAdapter, StreamripAdapterUnavailable

logger = logging.getLogger(__name__)


class JobRunner:
	"""Claims durable queue rows; source leases exist only during `download` execution."""

	def __init__(self, repository: JobRepository, leases: LeaseClient, adapter: StreamripAdapter):
		self._repository = repository
		self._leases = leases
		self._adapter = adapter

	async def run_once(self) -> bool:
		job = await self._repository.claim_next()
		if job is None:
			return False
		try:
			lease = await self._leases.acquire(job)
			result = await self._adapter.download(job, lease)
			await self._repository.complete(
				str(job.id),
				object_key=result.object_key,
				mime_type=result.mime_type,
				size_bytes=result.size_bytes
			)
		except StreamripAdapterUnavailable:
			await self._repository.fail(
				str(job.id), code='adapter_unavailable', message='The media adapter is not configured.'
			)
		except Exception:
			# Deliberately omit exception text: providers may include sensitive lease data.
			logger.exception('Media job failed: %s', job.id)
			await self._repository.fail(str(job.id), code='source_unavailable', message='Source unavailable.')
		return True


async def run_forever() -> None:
	settings = Settings.from_environment()
	repository, engine = create_repository(settings.database_url)
	runner = JobRunner(repository, LeaseClient(settings), StreamripAdapter(S3ObjectStore(settings)))
	try:
		while True:
			worked = await runner.run_once()
			if not worked:
				await asyncio.sleep(1)
	finally:
		await engine.dispose()


def run() -> None:
	logging.basicConfig(level=logging.INFO)
	asyncio.run(run_forever())
