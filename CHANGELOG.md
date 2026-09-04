# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Property-based generator tests that protect candidate eligibility, cooldown, deduplication, and input-immutability invariants.

## [0.0.1] - 2026-09-02

### Added

- Initial release of Syn music application with TIDAL integration.
- Responsive app shell with side navigation, mobile navigation, mini player, and queue drawer.
- Global 10-pixel footer with version number, copyright notice, and legal attribution.
- Full song native playback engine translating core streaming manifest parser and TIDAL API resolution from `oskvr37/tiddl`.
- TIDAL Device Authorization flow (`https://link.tidal.com`) with `r_usr` streaming playback scopes.
- High-fidelity stream metadata and telemetry badges (`FLAC LOSSLESS`, `AAC 320k`) in the audio player.
- Real-time synchronized lyrics engine (`parseLrc`) with karaoke-style line tracking, auto-scrolling, and interactive seeking in the player and track view.
- Official editorial album reviews and critiques with legacy WiMP link sanitization on album pages.
- Standard Extended M3U8 playlist exporter (`#EXTM3U` format) for custom playlists, TIDAL playlists, albums, and tracks.
- Loudness normalization (ReplayGain telemetry) integration in the audio engine.
- Direct Server-Side Audio Streaming Proxy (`/api/tracks/[id]/audio`) with HTTP Range support to bypass TIDAL CDN CORS restrictions on HTML5 `<audio>`.
- Graceful preview fallback (`previewUrl`) in the streaming endpoint with clear UI prompts for Device Authorization.
- Two-way TIDAL playlist synchronization engine (`/api/playlists/sync`, `/api/playlists/import`) with change detection (`diffPlaylistItems`), pull/push, and batch operations.
- TIDAL write operations in `api.ts`: `updatePlaylist`, `deletePlaylistRemote`, `removePlaylistItems`, `replacePlaylistItems` with automatic 50-track chunking and `playlists.write` OAuth scope detection.
- Database schema migration for `user_playlist` with sync tracking columns (`source`, `sync_status`, `last_synced_at`, `remote_etag`, `sync_error`).
- Interactive Playlist Import Modal (`PlaylistImportModal.svelte`) to selectively import remote TIDAL playlists.
- Unified playlist page with dual-resolution (local vs remote), inline title/description editing, sync status pills, and deletion confirmation with TIDAL remote cleanup option.
