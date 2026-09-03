from __future__ import annotations

import asyncio
import base64
import json
import tempfile
from collections.abc import AsyncIterator
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

import httpx

from .domain import Job
from .leases import CredentialLease
from .storage import ObjectStore

PLAYBACK_INFO_URL = 'https://api.tidal.com/v1/tracks/{track_id}/playbackinfopostpaywall'


class StreamripAdapterUnavailable(RuntimeError):
	pass


class SourceUnavailableError(RuntimeError):
	pass


class DownloadResult:
	def __init__(self, object_key: str, mime_type: str, size_bytes: int):
		self.object_key = object_key
		self.mime_type = mime_type
		self.size_bytes = size_bytes


def installed_streamrip_version() -> str:
	"""Report the immutable reference package without importing its credentialed clients."""

	try:
		return version('streamrip')
	except PackageNotFoundError:
		return 'not-installed'


def parse_bts_manifest(playback_info: dict[str, object]) -> tuple[str, str]:
	"""Parse the streamrip-documented single-file BTS manifest shape safely."""
	if playback_info.get('manifestMimeType') != 'application/vnd.tidal.bts':
		raise SourceUnavailableError('This media representation is not a single-file stream.')
	try:
		manifest = json.loads(base64.b64decode(str(playback_info['manifest'])))
		url = manifest['urls'][0]
		mime_type = manifest.get('mimeType') or 'audio/flac'
	except (KeyError, IndexError, TypeError, ValueError) as error:
		raise SourceUnavailableError('The playback manifest is invalid.') from error
	if manifest.get('encryptionType') not in (None, 'NONE'):
		raise SourceUnavailableError('Encrypted source media is not supported.')
	if not isinstance(url, str) or not isinstance(mime_type, str):
		raise SourceUnavailableError('The playback manifest is invalid.')
	return url, mime_type


def extension_for(mime_type: str) -> str:
	return {'audio/flac': 'flac', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3'}.get(mime_type, 'bin')


class StreamripAdapter:
	"""A credential-isolated downloader following streamrip's manifest approach.

	The image COPY-installs external/streamrip as a fixed GPL-3.0 reference, but this
	adapter does not import its TIDAL client or use an upstream embedded identifier.
	It receives an in-memory access-token lease from Syn, requests playback metadata,
	and writes the result to S3. Original media never touches the filesystem;
	conversion uses a deleted-after-use `/tmp` directory.
	"""

	def __init__(self, object_store: ObjectStore):
		self._object_store = object_store

	async def _source(self, job: Job, lease: CredentialLease) -> tuple[str, str]:
		if job.provider != 'tidal' or job.resource_type != 'track':
			raise StreamripAdapterUnavailable('Unsupported media source.')
		async with httpx.AsyncClient(timeout=30) as client:
			response = await client.get(
				PLAYBACK_INFO_URL.format(track_id=job.resource_id),
				params={
					'audioquality': job.quality,
					'playbackmode': 'STREAM',
					'assetpresentation': 'FULL'
				},
				headers={'Authorization': f'Bearer {lease.access_token}', 'Accept': 'application/json'}
			)
			if response.status_code in {401, 403}:
				raise SourceUnavailableError('The source authorization was rejected.')
			response.raise_for_status()
			return parse_bts_manifest(response.json())

	async def _stream(self, url: str) -> AsyncIterator[bytes]:
		async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
			async with client.stream('GET', url) as response:
				response.raise_for_status()
				async for chunk in response.aiter_bytes(1024 * 1024):
					yield chunk

	async def _download_to_file(self, url: str, destination: Path) -> None:
		with destination.open('wb') as handle:
			async for chunk in self._stream(url):
				handle.write(chunk)

	async def _convert(self, source: Path, destination: Path, output_format: str) -> None:
		codec = {'flac': 'flac', 'mp3': 'libmp3lame', 'm4a': 'aac'}[output_format]
		process = await asyncio.create_subprocess_exec(
			'ffmpeg', '-y', '-i', str(source), '-vn', '-c:a', codec, str(destination),
			stdout=asyncio.subprocess.DEVNULL,
			stderr=asyncio.subprocess.DEVNULL
		)
		if await process.wait() != 0:
			raise SourceUnavailableError('Audio conversion failed.')

	async def download(self, job: Job, lease: CredentialLease) -> DownloadResult:
		url, source_mime_type = await self._source(job, lease)
		if job.output_format == 'original':
			key = f'media/{job.id}.{extension_for(source_mime_type)}'
			size = await self._object_store.upload_stream(key, self._stream(url), source_mime_type)
			return DownloadResult(key, source_mime_type, size)

		output_mime_type = {'flac': 'audio/flac', 'mp3': 'audio/mpeg', 'm4a': 'audio/mp4'}[
			job.output_format
		]
		with tempfile.TemporaryDirectory(prefix='syn-worker-') as scratch:
			input_path = Path(scratch) / f'input.{extension_for(source_mime_type)}'
			output_path = Path(scratch) / f'output.{job.output_format}'
			await self._download_to_file(url, input_path)
			await self._convert(input_path, output_path, job.output_format)
			key = f'media/{job.id}.{job.output_format}'
			size = await self._object_store.upload_file(key, output_path, output_mime_type)
			return DownloadResult(key, output_mime_type, size)
