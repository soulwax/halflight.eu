"""Apply the worker's SQL migration using its asyncpg database URL."""

from __future__ import annotations

import asyncio
from os import environ
from pathlib import Path

import asyncpg


async def main() -> None:
	url = environ['SYN_WORKER_DATABASE_URL'].replace('postgresql+asyncpg://', 'postgresql://', 1)
	sql = (Path('/app/worker/migrations/0001_initial.sql')).read_text()
	connection = await asyncpg.connect(url)
	try:
		await connection.execute(sql)
	finally:
		await connection.close()


if __name__ == '__main__':
	asyncio.run(main())
