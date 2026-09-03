-- This schema is owned by the self-hosted worker, not Syn/Drizzle.
-- Run with: psql "$SYN_WORKER_DATABASE_URL" -f migrations/0001_initial.sql

CREATE TABLE IF NOT EXISTS media_jobs (
	id UUID PRIMARY KEY,
	idempotency_key VARCHAR(128) NOT NULL UNIQUE,
	provider VARCHAR(32) NOT NULL,
	resource_type VARCHAR(32) NOT NULL,
	resource_id VARCHAR(128) NOT NULL,
	quality VARCHAR(32) NOT NULL,
	output_format VARCHAR(16) NOT NULL,
	status VARCHAR(16) NOT NULL,
	progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
	attempts INTEGER NOT NULL DEFAULT 0,
	object_key TEXT,
	media_mime_type VARCHAR(128),
	media_size_bytes BIGINT,
	error_code VARCHAR(64),
	error_message TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	started_at TIMESTAMPTZ,
	finished_at TIMESTAMPTZ,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	CHECK (status IN ('queued', 'running', 'completed', 'failed')),
	CHECK ((status = 'completed') = (object_key IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS media_jobs_claim_idx ON media_jobs (status, created_at)
WHERE status = 'queued';
