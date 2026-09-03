# Syn media worker

This is the self-hosted media boundary for Syn. It uses the untouched
`external/streamrip` checkout as an immutable GPL-3.0 reference, while Syn
keeps its own OAuth configuration and gives the worker a short-lived playback
credential only when a job runs. Neither the worker database nor its object
store receives a TIDAL token.

The worker owns media retrieval, optional ffmpeg conversion, and S3-compatible
object storage. Syn/Vercel only creates durable job records and returns the
worker's expiring, presigned media URL to the browser.

## Local Docker workflow

Copy `worker/.env.example` to the gitignored `worker/.env`, then fill in the
PostgreSQL, S3, Syn origin, and shared worker token values.

```sh
cp worker/.env.example worker/.env
pnpm worker:build
pnpm worker:migrate
pnpm worker:up
```

The API is then available at `http://localhost:8080` by default. Use these
commands for normal operations:

```sh
pnpm worker:logs
pnpm worker:down
```

`pnpm worker:migrate` reads the async SQLAlchemy URL directly, so no separate
`psql` URL conversion is needed. Run it before the first `worker:up` and after
any future worker migration.

Set the values from [`worker/.env.example`](.env.example) on the worker and set
these matching values in Syn/Vercel:

```text
STREAMRIP_WORKER_URL=https://worker.example.com
STREAMRIP_WORKER_TOKEN=<same value as SYN_WORKER_INTERNAL_TOKEN>
```

Run two processes from the image: `syn-stream-worker` serves the authenticated
API, and `syn-stream-worker-runner` claims queued conversion/download jobs.
Expose only HTTPS to the browser; allow the Syn origin in the object-store CORS
policy for `GET`, `HEAD`, and the `Range` request header. The object store must
allow range responses for seeking.

`/v1/health` is safe for private liveness probes. All `/v1/*` media/job APIs
require Syn's shared bearer credential. The worker calls Syn's private
`/api/internal/streamrip/jobs/{jobId}/credential` endpoint with the same secret
to obtain an in-memory, no-store playback lease.

The worker image includes GPL-3.0 streamrip as a separate reference dependency.
Keep its license and source available with any distributed worker image.
