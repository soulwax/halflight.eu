FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1 \
	PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Build from the repository root so this copies the vendored upstream source as a
# read-only reference. No source file in external/streamrip is modified.
COPY external/streamrip /reference/streamrip
COPY worker /app/worker
RUN apt-get update \
	&& apt-get install --yes --no-install-recommends ffmpeg \
	&& rm -rf /var/lib/apt/lists/* \
	&& pip install --no-cache-dir /reference/streamrip /app/worker

EXPOSE 8080
CMD ["syn-stream-worker"]
