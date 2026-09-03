from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import httpx

from .config import Settings
from .domain import Job


@dataclass(frozen=True, slots=True)
class CredentialLease:
	"""In-memory only. Never attach this object to a database model or log it."""

	access_token: str
	expires_at: datetime


class LeaseClient:
	"""Redeems the worker's private identity for a one-job, short-lived source grant."""

	def __init__(self, settings: Settings):
		self._syn_origin = settings.syn_origin
		self._internal_token = settings.internal_token

	async def acquire(self, job: Job) -> CredentialLease:
		async with httpx.AsyncClient(timeout=15) as client:
			response = await client.post(
				f'{self._syn_origin}/api/internal/streamrip/jobs/{job.id}/credential',
				headers={'X-Syn-Worker-Token': self._internal_token}
			)
			response.raise_for_status()
			body = response.json()
		# Syn intentionally returns no expiry. This object remains scoped to this method call.
		return CredentialLease(access_token=body['accessToken'], expires_at=datetime.now())
