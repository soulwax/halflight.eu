# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Publish the standalone source, CI workflow and release at `github.com/soulwax/bragi-cli`.
- Update npm package links to the standalone repository.

## [0.1.0] - 2026-09-29

### Added

- Standalone npm CLI with `bragi` and `bragi-cli` executables, setup wizard and action menu.
- Format discovery, offline diagnostics, worker-based audio inspection and bounded artwork exports.
- Bounded downloads, explicit binary streaming, protected output and strong-ETag resume journals.
- Mono/stereo WAV inspection, bit-depth conversion and float32 little-endian raw PCM tools.
- Local playlists with distinct duplicate occurrence IDs and queue editing commands.
- Bundled loopback browser playback with seeking, volume, explicit gain, terminal controls,
  metadata look-ahead, duration assessment and Media Session support.
- Explicit browser decoding to 48000 Hz WAV with bounded input, PCM and output validation.
- Versioned JSON/JSONL, sanitized error codes, cancellation and independent package tooling.
