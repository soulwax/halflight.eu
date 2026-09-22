# `syn.js` audio metadata package plan

## Decision

Extract Syn's audio-file identification and metadata reading into the standalone
[`soulwax/syn.js`](https://github.com/soulwax/syn.js) repository, mounted in this repository as the
`./syn.js` Git submodule. The published package name is intended to be `syn.js`; the name is
currently unclaimed in the npm registry, but publishing remains a separate, explicit release step.

The package must answer two different questions without conflating them:

1. **What is this file?** Inspect bytes, identify a supported container, parse embedded tags, and
   return normalized technical metadata.
2. **Can this deployment process it?** Report the formats handled by the built-in parser and, in a
   later optional Node adapter, the capabilities of a configured `ffprobe`/FFmpeg installation.

The first release implements the first question. It does not decode, remux, transcode, upload,
store, fetch, or play audio.

## Why this is a package boundary

Syn currently keeps one format registry in `src/lib/server/private-music.ts`, but upload validation
uses only browser MIME metadata and the filename suffix. The route then buffers the whole file,
stores its declared canonical MIME type, and persists only filename, type, size, and creation time.
This creates three avoidable problems:

- renamed or malformed files can pass validation;
- useful owner-owned tags such as title, artist, album, track number, duration, and codec are lost;
- MIME aliases, signatures, parser support, and application persistence can drift apart.

File inspection and tag normalization are reusable, deterministic work with no dependency on
SvelteKit, TIDAL, authentication, Postgres, or object storage. Storage policy and owner-visible
library behavior remain Syn concerns.

## Scope

### Version 0.1

- Identify MP3, FLAC, raw AAC/ADTS, M4A/MP4, Ogg, WAV, and WebM from magic bytes.
- Keep a single public registry for labels, canonical MIME types, aliases, and extensions.
- Parse technical properties and embedded tags with `music-metadata`.
- Normalize inconsistent container tags into a small stable result contract.
- Preserve declared filename/MIME as hints and report contradictions as structured warnings.
- Offer strict hint validation for upload admission.
- Skip embedded artwork by default and bound it when explicitly requested.
- Accept `Uint8Array`, `ArrayBuffer`, and `Blob` inputs. This matches Syn's current upload path and
  works in modern server runtimes without filesystem access.
- Ship ESM JavaScript and TypeScript declarations for maintained Node releases.
- Remain independent of logging, environment variables, storage, databases, and web frameworks.

### Later slices

- A streaming/tokenizer entry point that can inspect large object-store uploads without a second
  full in-memory copy.
- An optional `syn.js/ffprobe` Node-only adapter that receives an executable path, invokes it with a
  fixed argument array, applies a timeout and output cap, and reports actual host capabilities.
- Optional bounded loudness or waveform workers only after a concrete Syn product need and a
  processing/retention review.
- More containers only when detection, parser behavior, fixtures, MIME mapping, and a real consumer
  are all present.

### Non-goals

- No audio decoding, playback, transcoding, remuxing, DRM handling, or codec implementation.
- No automatic subprocess discovery or bundled FFmpeg binary.
- No network access, URL parser, remote artwork lookup, or metadata enrichment.
- No S3, database, HTTP, UI, authentication, TIDAL, or Syn-specific object identifiers.
- No raw `music-metadata` response in the public contract.
- No claim that metadata parsing means a browser or server decoder can play the file.
- No mutation or rewriting of source files or tags in the first major version.

## Package layout

```text
syn.js/
  src/
    formats.ts       # immutable registry and magic-byte identification
    metadata.ts      # normalized public contracts and tag conversion
    analyze.ts       # bounded orchestration around music-metadata
    errors.ts        # stable machine-readable failures
    index.ts         # public exports only
  test/
    fixtures.ts      # tiny generated/synthetic audio buffers
    formats.test.ts
    analyze.test.ts
    metadata.test.ts
  package.json
  tsconfig.json
  vitest.config.ts
  README.md
  CHANGELOG.md
  LICENSE
  SECURITY.md
```

Keep internal modules private through `package.json#exports`; consumers import from `syn.js`, not
from build paths. If the ffprobe adapter is approved later, expose only the explicit
`syn.js/ffprobe` subpath so browser bundlers cannot accidentally include Node process code.

## Public API

The version 0.1 contract should stay compact:

```ts
type AudioInput = Uint8Array | ArrayBuffer | Blob;

function detectAudioFormat(bytes: Uint8Array): AudioFormat | null;
function findAudioFormatByExtension(name: string): AudioFormat | null;
function findAudioFormatByMimeType(type: string): AudioFormat | null;

async function analyzeAudio(
	input: AudioInput,
	hints?: AudioHints,
	options?: AnalyzeOptions
): Promise<AudioAnalysis>;

const AUDIO_FORMATS: readonly AudioFormat[];
const AUDIO_ACCEPT: string;
```

`AudioHints` contains only caller claims (`fileName`, `mimeType`, and optional `size`). The result
records both the detected format and any hint mismatch; hints never override byte detection.

`AnalyzeOptions` starts with these policy controls:

- `maxFileBytes`, defaulting to 128 MiB;
- `strictHints`, defaulting to `false` in the generic package;
- `includeArtwork`, defaulting to `false`;
- `maxArtworkBytes` and `maxArtworkCount`, enforced when artwork is enabled;
- `duration`, allowing a caller to request the extra parser work needed for exact duration;
- `signal`, checked before and after parsing and passed through wherever the parser supports it.

Syn will call it with `strictHints: true`, its existing 128 MiB ceiling, artwork disabled, and exact
duration enabled. Package defaults are not application authorization policy.

## Normalized result

The public result is JSON-safe except for explicitly requested artwork bytes:

```ts
interface AudioAnalysis {
	format: {
		id: 'mp3' | 'flac' | 'aac' | 'm4a' | 'ogg' | 'wav' | 'webm';
		contentType: string;
		container?: string;
		codec?: string;
		durationSeconds?: number;
		bitrate?: number;
		sampleRate?: number;
		channels?: number;
		bitsPerSample?: number;
		lossless?: boolean;
	};
	tags: {
		title?: string;
		artists: string[];
		album?: string;
		albumArtists: string[];
		track?: { number?: number; total?: number };
		disc?: { number?: number; total?: number };
		date?: string;
		year?: number;
		genres: string[];
		composers: string[];
		isrc?: string;
		copyright?: string;
	};
	artwork: AudioArtwork[];
	warnings: AudioWarning[];
}
```

Normalization rules:

- trim text, remove control characters, collapse empty values to absence, and enforce length caps;
- preserve Unicode and array ordering while removing exact duplicate names;
- keep unknown values absent, never convert them to zero or an empty invented label;
- accept only finite, non-negative technical numbers within defensible ranges;
- distinguish track/disc number from total;
- expose no library-specific tag IDs or native parser objects;
- copy artwork bytes only when requested and within both per-image and aggregate limits;
- identify lossless status from the parsed codec/container result, not a filename.

Warnings use stable codes such as `mime_mismatch`, `extension_mismatch`, `artwork_omitted`,
`artwork_limit`, and `partial_metadata`. Human wording belongs in each consumer.

## Failure contract

Throw one exported `AudioMetadataError` with a stable `code` union:

- `empty_input`
- `file_too_large`
- `unsupported_format`
- `hint_mismatch`
- `malformed_audio`
- `aborted`
- `parser_failure`

Errors may contain safe format/hint facts but never source bytes, embedded artwork, full parser
objects, filesystem paths, environment values, or subprocess output. Preserve the original error
only as `cause`; callers decide whether and where to log it.

## Format matrix

| ID     | Accepted container/signature       | Typical codecs/tags                 | Canonical MIME |
| ------ | ---------------------------------- | ----------------------------------- | -------------- |
| `mp3`  | ID3 or valid MPEG audio frame sync | MPEG Layer III, ID3v1/ID3v2, APE    | `audio/mpeg`   |
| `flac` | `fLaC`                             | FLAC, Vorbis comments               | `audio/flac`   |
| `aac`  | ADTS sync                          | AAC-LC/HE-AAC, limited raw metadata | `audio/aac`    |
| `m4a`  | ISO BMFF `ftyp`                    | AAC/ALAC and MP4 atoms              | `audio/mp4`    |
| `ogg`  | `OggS`                             | Vorbis, Opus, FLAC comments         | `audio/ogg`    |
| `wav`  | RIFF/RF64 + WAVE                   | PCM/float and RIFF INFO             | `audio/wav`    |
| `webm` | EBML header                        | Opus/Vorbis and Matroska tags       | `audio/webm`   |

This table describes inspection support, not guaranteed decode support. In particular, MP4 and
WebM are containers and may contain codecs outside a consumer's playback stack. The analysis result
must retain both container and codec so Syn can make a separate playback decision.

## Security and resource limits

- Inspect bytes before trusting a suffix or browser MIME value.
- Reject unknown signatures and contradictory trusted hints in strict mode.
- Cap source size before parsing; never silently raise the caller's limit.
- Disable cover extraction by default. Bound cover count, individual bytes, aggregate bytes,
  description length, and MIME length when enabled.
- Never fetch linked artwork or resolve external references.
- Keep all parsing in-process for v0.1 and expose cancellation honestly; do not promise a hard CPU
  timeout that JavaScript cannot enforce.
- Treat parsers as untrusted-input surfaces. Pin dependency ranges, run dependency review on
  release, and fuzz/truncate fixtures around each signature.
- If ffprobe is introduced, do not use `fluent-ffmpeg` or shell command strings. Require an explicit
  executable path, pass fixed argv, close stdin, cap stdout/stderr, kill on abort/timeout, and keep
  it in a separately importable Node-only module.

## Test strategy

Use generated or public-domain tiny fixtures only; never copy owner uploads, TIDAL payloads, or
commercial recordings into either repository.

### Unit and fixture matrix

For every format:

- valid signature and canonical detection;
- empty, truncated, and malformed data;
- blank, aliased, matching, and contradictory MIME hints;
- upper/lowercase and multiple-dot filename extensions;
- no tags and representative Unicode tags;
- multivalue artist/genre tags and duplicate normalization;
- duration, sample rate, channels, bitrate, bit depth, codec, and lossless mapping where available;
- oversized source and artwork limits;
- no artwork returned by default;
- abort before work and abort observed before result delivery.

Cross-format cases include a renamed file, a valid container with an unsupported codec, variable
bitrate MP3, AAC in ADTS versus AAC in MP4, Ogg Opus versus Ogg Vorbis, RF64, malformed metadata
sizes, long strings, and unknown tags.

### Compatibility and release gates

- Test the oldest supported Node release plus current active LTS and current Node on Linux.
- Run TypeScript with strict settings, formatting, lint, unit tests, build, package-content
  inspection, and an install smoke test against the packed tarball.
- Verify ESM import and generated declarations from a clean consumer project.
- Track branch coverage for format/error branches; do not chase meaningless 100% line coverage.
- Run a small fuzz/property suite over prefixes and truncated buffers with bounded execution.
- Audit the tarball: no fixtures, source maps containing machine paths, secrets, or unrelated Syn
  application code.

## Repository and npm release policy

- `main` is protected by green checks; releases are tagged `vX.Y.Z` from a clean commit.
- Use SemVer and Keep a Changelog. Result-shape or error-code removals are breaking changes.
- Publish with npm trusted publishing/provenance once the package owner configures it; do not store
  an npm token in either repository.
- Publish public access, include `LICENSE`, `README.md`, `CHANGELOG.md`, and `SECURITY.md`, and set
  `files` so only `dist`, declarations, and documentation enter the tarball.
- Start with a `0.1.0` prerelease/canary after Syn integration tests pass. Promote the identical
  commit to `0.1.0`; do not publish straight from an unreviewed workstation state.
- Before first publish, recheck package-name ownership. If `syn.js` is unavailable or ambiguous,
  use an owner-controlled npm scope without changing the GitHub repository or API design.

## Syn integration

The submodule is a development and release boundary, not Syn's production dependency mechanism.
Published Syn builds should consume a pinned npm version and lockfile integrity; they must not
depend on Git being available during deployment.

### Current prerelease integration

Phase B currently uses the checked `file:./syn.js` submodule dependency so the upload route can be
verified before the first npm publication. The submodule commits its checked `dist/` output, and the
root lockfile pins the Gitlink-visible package contents. A fresh checkout must initialize submodules
before `pnpm install`. Before a production release, publish an immutable package version and replace
the `file:` specifier with that npm version; do not leave deployment correctness dependent on an
uninitialized Git submodule.

### Data ownership

The package returns facts; Syn decides what to retain. A later Syn migration may add bounded,
owner-owned columns or a versioned JSON object for normalized title, artist names, album, track/disc,
duration, codec, container, sample rate, channels, bit depth, bitrate, and analysis version. Do not
persist artwork by default. Keep bytes in the private bucket and authorization in existing routes.

### Upload flow

```text
authenticated multipart upload
  -> existing byte/total quota checks
  -> analyze bytes with strict hints and artwork disabled
  -> reject safely or use detected canonical MIME
  -> store private bytes
  -> persist Syn-owned metadata and analysis version
  -> return client-safe library model
```

Storage and database failure compensation stays in Syn. The package must not know object keys,
user IDs, bucket URLs, or transactions. Once a streaming package API exists, Syn can replace its
current full `File.arrayBuffer()` copy with a bounded staged flow; that is a separate performance
change with adapter-specific tests.

### Migration sequence

1. Characterize the current seven-format registry and upload errors with tests.
2. Build and release the standalone parser package from `./syn.js`.
3. Add a temporary workspace or packed-tarball integration test without changing production.
4. Replace Syn's duplicate format registry with package exports.
5. Analyze uploads before bucket persistence and use the detected canonical MIME.
6. Add a Drizzle migration for selected normalized fields and an `analysisVersion`.
7. Update API models, Paraglide messages, library UI, manifests, and tests.
8. Publish a pinned npm release, switch Syn from local package linkage to that version, and verify
   both Node and Vercel builds.
9. Remove the old MIME/extension parser only after malformed, mismatch, quota, rollback, download,
   and export tests are green.

Rollback is straightforward through step 8: restore the existing local registry and stop writing
new metadata fields while leaving nullable migrated columns intact. Existing private files remain
downloadable because their object keys and stored bytes do not change.

## Delivery phases and gates

### Implementation status — 2026-09-22

Phase A is implemented in the `./syn.js` submodule and pushed to the package repository's `main`
branch. The package currently has 22 passing tests, passes strict TypeScript and ESLint checks,
builds declarations and ESM output, passes a dry-run package audit, and imports successfully from
its packed tarball in a clean consumer. It has not been published to npm. Phases B through D remain
planned work and must retain their separate migration and release gates.

### Phase A — bootstrap `syn.js`

- Create the standalone repository, TypeScript build, immutable format registry, magic-byte
  detector, normalized contracts, bounded analyzer, generated fixtures, and documentation.
- Add it to this repository as `./syn.js` with a relative path and GitHub URL in `.gitmodules`.

**Gate:** package checks, tests, build, `pnpm pack --dry-run`, and clean-consumer import pass; the
parent repository records one submodule commit and `NPMJS.md` matches the implemented API.

### Phase B — integrate upload admission

- Add the package as a pinned dependency.
- Analyze before bucket write, reject malformed/mismatched files, and store the detected MIME.
- Preserve current quota and cleanup semantics.

**Current status:** Syn now derives its format menu from `syn.js`, reads the upload bytes once after
the quota check, validates container and audio properties with strict filename/MIME hints, and sends
only the detected canonical MIME type to bucket and database writes. Generic
`application/octet-stream` remains a permitted browser hint. Normalized title/artist/album metadata
is intentionally not persisted yet; that is Phase C's explicit schema migration.

**Gate:** all seven formats have route fixtures; renamed/corrupt files never reach the bucket;
parser failures return safe 4xx errors while storage failures remain 5xx; no bytes or parser internals
reach logs or responses.

### Phase C — persist and display metadata

- Add the minimal schema, backfill only on owner request or lazy access, and display normalized tags.
- Keep filename as a fallback and show unknown fields honestly.

**Gate:** old rows still load, exports remain safe, Unicode/long metadata cannot break layout, and
deleting a file removes the same owned state as before.

### Phase D — streaming and runtime capabilities

- Prove a memory problem before adding stream inspection.
- Add ffprobe only for a concrete unsupported technical-property or capability requirement.

**Gate:** a 128 MiB upload stays within a measured memory ceiling; subprocess tests cover timeout,
abort, output overflow, missing executable, malformed JSON, and hostile hint values without invoking
a shell.

## Phase A acceptance checklist

- [x] `syn.js` is an actual Git submodule with an independently buildable repository.
- [x] Byte signatures, not suffixes, select the canonical format.
- [x] MP3, FLAC, AAC, M4A/MP4, Ogg, WAV, and WebM are represented by one registry.
- [x] Metadata normalization does not expose parser-specific objects.
- [x] Default analysis returns no artwork bytes.
- [x] Inputs, strings, arrays, and artwork are bounded.
- [x] Errors and warnings use stable codes.
- [x] Synthetic fixture tests cover success, mismatch, truncation, and limits.
- [x] The package has no framework, storage, network, database, or TIDAL dependency.
- [x] Build output and packed contents are reproducible and minimal.
- [x] No npm publication occurs until the separate release gate is approved.
