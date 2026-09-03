from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Protocol

import boto3

from .config import Settings


@dataclass(frozen=True, slots=True)
class PlaybackUrl:
	url: str
	expires_at: datetime


class ObjectStore(Protocol):
	async def playback_url(self, object_key: str) -> PlaybackUrl: ...

	async def upload_stream(
		self, object_key: str, body: AsyncIterator[bytes], content_type: str
	) -> int: ...

	async def upload_file(self, object_key: str, path: Path, content_type: str) -> int: ...


class S3ObjectStore:
	"""Issues short-lived object-store URLs; media is never proxied through the API."""

	def __init__(self, settings: Settings):
		self._bucket = settings.s3_bucket
		self._client = boto3.client(
			's3',
			region_name=settings.s3_region,
			endpoint_url=settings.s3_endpoint_url,
			aws_access_key_id=settings.s3_access_key_id,
			aws_secret_access_key=settings.s3_secret_access_key
		)

	async def playback_url(self, object_key: str) -> PlaybackUrl:
		expires_in = 300
		url = await asyncio.to_thread(
			self._client.generate_presigned_url,
			'get_object',
			Params={'Bucket': self._bucket, 'Key': object_key},
			ExpiresIn=expires_in
		)
		return PlaybackUrl(url=url, expires_at=datetime.now(UTC) + timedelta(seconds=expires_in))

	async def upload_stream(
		self, object_key: str, body: AsyncIterator[bytes], content_type: str
	) -> int:
		"""Multipart-upload network bytes directly to S3 without a media file on disk."""
		created = await asyncio.to_thread(
			self._client.create_multipart_upload,
			Bucket=self._bucket,
			Key=object_key,
			ContentType=content_type
		)
		upload_id = created['UploadId']
		parts: list[dict[str, object]] = []
		buffer = bytearray()
		total = 0
		part_number = 1
		minimum_part_size = 8 * 1024 * 1024
		try:
			async for chunk in body:
				buffer.extend(chunk)
				total += len(chunk)
				if len(buffer) >= minimum_part_size:
					part = await asyncio.to_thread(
						self._client.upload_part,
						Bucket=self._bucket,
						Key=object_key,
						UploadId=upload_id,
						PartNumber=part_number,
						Body=bytes(buffer)
					)
					parts.append({'PartNumber': part_number, 'ETag': part['ETag']})
					part_number += 1
					buffer.clear()
			if buffer or not parts:
				part = await asyncio.to_thread(
					self._client.upload_part,
					Bucket=self._bucket,
					Key=object_key,
					UploadId=upload_id,
					PartNumber=part_number,
					Body=bytes(buffer)
				)
				parts.append({'PartNumber': part_number, 'ETag': part['ETag']})
			await asyncio.to_thread(
				self._client.complete_multipart_upload,
				Bucket=self._bucket,
				Key=object_key,
				UploadId=upload_id,
				MultipartUpload={'Parts': parts}
			)
		except Exception:
			await asyncio.to_thread(
				self._client.abort_multipart_upload,
				Bucket=self._bucket,
				Key=object_key,
				UploadId=upload_id
			)
			raise
		return total

	async def upload_file(self, object_key: str, path: Path, content_type: str) -> int:
		size = path.stat().st_size
		await asyncio.to_thread(
			self._client.upload_file,
			str(path),
			self._bucket,
			object_key,
			ExtraArgs={'ContentType': content_type}
		)
		return size
