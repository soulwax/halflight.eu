from __future__ import annotations

from dataclasses import dataclass
from os import environ


@dataclass(frozen=True, slots=True)
class Settings:
	database_url: str
	internal_token: str
	s3_bucket: str
	s3_region: str
	s3_endpoint_url: str | None
	s3_access_key_id: str | None
	s3_secret_access_key: str | None
	syn_origin: str

	@classmethod
	def from_environment(cls) -> 'Settings':
		def required(name: str) -> str:
			value = environ.get(name)
			if not value:
				raise RuntimeError(f'{name} is required')
			return value

		internal_token = required('SYN_WORKER_INTERNAL_TOKEN')
		if len(internal_token) < 32:
			raise RuntimeError('SYN_WORKER_INTERNAL_TOKEN must be at least 32 characters')

		return cls(
			database_url=required('SYN_WORKER_DATABASE_URL'),
			internal_token=internal_token,
			s3_bucket=required('SYN_WORKER_S3_BUCKET'),
			s3_region=environ.get('SYN_WORKER_S3_REGION', 'eu-central-1'),
			s3_endpoint_url=environ.get('SYN_WORKER_S3_ENDPOINT_URL') or None,
			s3_access_key_id=environ.get('SYN_WORKER_S3_ACCESS_KEY_ID') or None,
			s3_secret_access_key=environ.get('SYN_WORKER_S3_SECRET_ACCESS_KEY') or None,
			syn_origin=required('SYN_WORKER_SYN_ORIGIN').rstrip('/')
		)
