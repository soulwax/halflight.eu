# `syn.js` audio package plan

## Decision

Extract Syn's audio-file identification and metadata reading into the standalone
[`soulwax/syn.js`](https://github.com/soulwax/syn.js) repository, mounted in this repository as the
`./syn.js` Git submodule. The public npm package is
[`bragi-audio`](https://www.npmjs.com/package/bragi-audio), released as `0.2.1`. Syn keeps its existing
`syn.js` imports through a pinned npm dependency alias; the GitHub repository name is unchanged.

The package must answer two different questions without conflating them:

1. **What is this file?** Inspect bytes, identify a supported container, parse embedded tags, and
   return normalized technical metadata.
2. **Can this deployment process it?** Report the formats handled by the built-in parser and, in a
   later optional Node adapter, the capabilities of a configured `ffprobe`/FFmpeg installation.

The root metadata entry implements the first question. Version 0.2.1 adds independent browser
playback, Web Fetch streaming/downloads, and explicit PCM/WAV encoding/decoding entries. Provider
authentication, DRM, manifest resolution, remuxing and compressed audio encoding remain outside
the package.

## Why this is a package boundary

Before extraction, Syn kept its format registry in `src/lib/server/private-music.ts`, and upload
validation trusted browser MIME metadata and filename suffixes. The route buffered the file and
stored the declared MIME type. That created three problems the shared package boundary addresses:

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

- An optional `syn.js/ffprobe` Node-only adapter that receives an executable path, invokes it with a
  fixed argument array, applies a timeout and output cap, and reports actual host capabilities.
- Optional bounded loudness or waveform workers only after a concrete Syn product need and a
  processing/retention review.
- More containers only when detection, parser behavior, fixtures, MIME mapping, and a real consumer
  are all present.

### Non-goals

- No compressed audio encoding, remuxing or DRM handling. The separate `syn.js/audio` entry provides
  bounded PCM/WAV codecs and delegates complete-file decoding to a supplied browser audio context.
- No automatic subprocess discovery or bundled FFmpeg binary.
- No network access from the metadata root; explicit Web Fetch streaming/download APIs live in
  `syn.js/delivery`. No remote artwork lookup or metadata enrichment.
- No S3, database, UI, authentication, TIDAL, or Syn-specific object identifiers.
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
- Release the exact checked tarball after Syn integration tests pass and a clean consumer verifies
  its runtime exports and TypeScript declarations.
- The owner selected the unscoped `bragi-audio` npm name. Recheck ownership before any future rename.

## Syn integration

The submodule is a development and release boundary, not Syn's production dependency mechanism.
Published Syn builds should consume a pinned npm version and lockfile integrity; they must not
depend on Git being available during deployment.

### Current release integration

Syn installs `"syn.js": "npm:bragi-audio@0.2.1"`; the lockfile records the registry artifact and its
integrity. Existing `syn.js`, `syn.js/player`, `syn.js/delivery`, and `syn.js/audio` imports resolve
to that release. The source submodule remains available for package development, but deployment
installation no longer requires its files or Git. Package changes need a new publication and an
explicit dependency/lockfile update before Syn consumes them.

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

### Implementation status — 2026-09-28

Phases A and B are implemented. `bragi-audio@0.2.1` is published, with 100 passing package tests,
strict TypeScript and ESLint checks, ESM/declaration builds, a tarball audit, and clean-consumer
runtime/type checks. GitHub CI passes on Node 20, 22, and 24. Browser playback, bounded delivery,
and PCM/WAV codecs are separate public entries. Phases C and D retain their separate migration
and release gates.

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

- `syn.js` now exposes `analyzeWebStream` for bounded Web-stream analysis. It requires trusted
  size metadata, reads until it has a 4 KiB detection prefix, and replays pulled chunks to the
  parser instead of materializing a second full-file buffer. Wire it into Syn only after an
  adapter-specific upload-flow memory measurement and cancellation test.
- Add ffprobe only for a concrete unsupported technical-property or capability requirement.

**Gate:** a 128 MiB upload stays within a measured memory ceiling; subprocess tests cover timeout,
abort, output overflow, missing executable, malformed JSON, and hostile hint values without invoking
a shell.

## Browser playback entry (`syn.js/player`)

### Decision — 2026-09-28

Export the framework-agnostic half of Syn's audio engine as a second, dependency-free entry point,
`syn.js/player`, next to the unchanged server-side root. Separate entry points keep `music-metadata`
out of browser bundles and DOM code out of server bundles; a package test fails if any
`src/player/` module imports anything but its siblings.

### What moved, and what stays in Syn

| Layer                                                                                                   | Where                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AudioEngine`: one `<audio>` element, event forwarding, buffered %, de-clicked Web Audio headroom stage | `syn.js/player`. Mobile keeps `allowWebAudio` false (iOS suspends Web Audio on lock).                                                                              |
| Queue identity, `QueueCommand`, `rebaseQueue`                                                           | `syn.js/player`, generic over `{ id: string }`; `#lib/player/queue-entry.ts` / `playback-reconciliation.ts` fix it to `TrackSummary`.                              |
| `assessPlayback`                                                                                        | `syn.js/player` returns issue codes and ranks tiers only when given `qualityRank`; `#lib/player/playback-assessment.ts` supplies TIDAL's ranks and Paraglide text. |
| `StreamPreloader`                                                                                       | `syn.js/player` with an injected `load`; `#lib/player/stream-preloader.ts` supplies the `/api/tracks/[id]/stream` loader.                                          |
| Media Session helpers                                                                                   | `syn.js/player`; Syn supplies the localised unknown-artist fallback.                                                                                               |
| `PlayerState` (runes, prefs, Last.fm, lyrics, embed fallback) and `PlaybackSessionCoordinator`          | **Stay in Syn.** The coordinator is Syn's own `/api/playback-state` protocol; export it only when a second consumer exists.                                        |
| TIDAL stream resolution, quality ladder, sealed manifest cache, S3 segment cache, tokens                | **Never exported.**                                                                                                                                                |

### Delivery entry — 2026-09-28

Version 0.2.1 includes original Web Fetch streaming/download helpers, generic byte ranges,
conditional HTTP helpers and transient retries. Every media request is explicit, injectable, bounded
and cancellable. It needs no Syn state, framework, filesystem, credentials, or environment variables.

### Remaining slice — DASH assembly

A future Web-Fetch-only server entry for the remaining generic half of `/api/tracks/[id]/audio`: the
DASH `SegmentTemplate` parser and an
instance-scoped `createSegmentAssembler({ maxEntries, maxBytes, ttlMs, concurrency,
persistentCache })` replacing `segmented.ts`'s module-level LRU. It must throw package-owned errors
(Syn maps them to `TidalError`) and contain nothing TIDAL-named.

**Gate before publishing derived DASH code:** check the licences of `oskvr37/tiddl` and `Dniel97/OrpheusDL-TIDAL`,
which the application references, before re-releasing derived code under MIT. tiddl's Apache-2.0
license was verified from its upstream repository on 2026-09-28; the referenced OrpheusDL-TIDAL
repository/license could not be retrieved. Its parser and the existing segment assembly remain in
Syn and are excluded from the npm release. Sources: [tiddl license](https://github.com/oskvr37/tiddl/blob/main/LICENSE),
[referenced OrpheusDL repository](https://github.com/Dniel97/OrpheusDL-TIDAL).

## Phase A acceptance checklist

- [x] `syn.js` is an actual Git submodule with an independently buildable repository.
- [x] Byte signatures, not suffixes, select the canonical format.
- [x] MP3, FLAC, AAC, M4A/MP4, Ogg, WAV, and WebM are represented by one registry.
- [x] Metadata normalization does not expose parser-specific objects.
- [x] Default analysis returns no artwork bytes.
- [x] Inputs, strings, arrays, and artwork are bounded.
- [x] Errors and warnings use stable codes.
- [x] Synthetic fixture tests cover success, mismatch, truncation, and limits.
- [x] The metadata root has no framework, storage, network, database, or TIDAL dependency.
- [x] Delivery uses only explicit Web Fetch APIs; browser entries have no runtime dependencies.
- [x] Build output and packed contents are reproducible and minimal.
- [x] Owner explicitly authorized npm publication; checks and clean-consumer validation are required.
