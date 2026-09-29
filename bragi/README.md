# Bragi CLI

A friendly terminal companion for **bragi-audio**: inspect audio, download permitted HTTP(S)
sources, convert WAV / raw PCM, manage local queues, and listen through a bundled browser player.

Requires Node.js **22.13 or later**. Playback needs a browser with support for your file's codec.
No account, native player, FFmpeg or Syn server is required.

```sh
pnpm add -g bragi-cli
bragi setup
bragi play ./track.flac
```

Both `bragi` and `bragi-cli` run the same command. For a one-off run:

```sh
pnpm dlx bragi-cli --help
```

Run `bragi` in a terminal for first-time setup and an action menu. Explicit commands work
without setup. Redirected/noninteractive bare invocations print help. Every command has `--help`.

## Inspect and diagnose

```sh
bragi doctor
bragi formats
bragi inspect ./track.flac
bragi inspect ./Music --recursive --jsonl
bragi inspect ./track.flac --artwork ./covers
bragi inspect ./renamed.wav --strict
cat ./track.wav | bragi inspect - --json
```

Inspection detects the actual bytes and returns normalized tags, duration, sample rate,
channels, codec and warnings. Local regular files use streaming inspection in a worker;
remote sources and stdin are buffered within the byte limit. The worker is terminated at
its deadline. Directory scans are sorted, skip symlinks and unsupported extensions, and stop
at 1,000 supported files or 10,000 visited entries. Artwork is opt-in, at most four images
and 8MiB combined per file; exports have unique filenames. Strict mode rejects misleading
filename hints. Playback codec support is determined by the browser, not the format registry.

## Download and stream

```sh
bragi download https://example.org/track.flac --output ./track.flac
bragi download --url-env BRAGI_MEDIA_URL --headers-env BRAGI_MEDIA_HEADERS \
  --output ./track.flac --resume
bragi stream https://example.org/track.flac --stdout > ./track.flac
```

Supply only audio you are permitted to access. Bragi doesn't implement provider login,
DRM, HLS or DASH playlists. Use environment references for private URLs and request headers
so they don't appear in command arguments. `BRAGI_MEDIA_HEADERS` is a JSON string map, for
example `{"Authorization":"Bearer …"}`. Values are read only into memory, never saved in
preferences, queues, journals or browser state. Header names controlling transport are reserved;
credential-bearing requests cannot redirect to another origin.

Downloads stream with backpressure to an exclusive `OUTPUT.bragi-part`, protect existing files,
and promote the output only after validation. `--force` explicitly allows replacement.
`--resume` retains a partial file and small journal only with a strong ETag. The journal stores
an opaque source digest, validator and byte count, never a URL or header value. Repeat the same
command with its environment sources supplied again. Only a matching 206 range is appended;
a full 200 restarts from zero. Changed/inconsistent ranges and 416 responses never mark a partial
file complete. A source change requires a new output path or removal of its partial/journal pair.
Transfer limits include existing resumed bytes. Compressed transfer encodings are rejected for
reliable byte accounting. Progress goes to stderr and uses percentages only for known lengths.

Binary stdout requires explicit `--stdout`; terminal output is guarded unless `--force` is used.
Don't combine binary stdout with JSON. Broken output pipes stop the transfer.

## WAV and raw PCM

```sh
bragi wav inspect ./track.wav
bragi wav convert ./track.wav --encoding pcm24 --output ./track-24.wav
bragi wav decode ./track.wav --output ./samples.f32 --metadata ./samples.json
bragi wav encode ./samples.f32 --sample-rate 48000 --channels 2 --output ./track.wav
bragi wav encode ./samples.f32 --sample-rate 48000 --channels 2 --encoding float32 --stdout > ./track.wav
```

Encodings: `pcm16`, `pcm24`, `float32`. WAV operations support mono/stereo PCM, preserve sample
rate and channels, and omit tags, artwork and unknown RIFF chunks. They don't resample or downmix.
Raw PCM is frame-aligned **interleaved float32 little-endian**, with finite samples; encoding
requires explicit sample rate and channel count. The optional sidecar documents this layout.

For a codec supported by your browser:

```sh
bragi convert ./track.mp3 --backend browser --output ./track.wav
```

Open the companion and click **Convert to WAV**. Browser conversion has a maximum input size of
32MiB (or the configured limit if lower), uses an OfflineAudioContext at **48000 Hz**, and reports
the actual output sample rate. It saves mono/stereo WAV through Node's protected output adapter.
Browser decoding may allocate memory before the decoded PCM limit can be checked; byte limits
aren't a process RAM guarantee. This workflow requires a browser click and is unsuitable for
unattended batch jobs. Other backends and compressed encoders aren't included.

## Listen and manage queues

```sh
bragi play ./one.flac ./two.mp3
bragi play ./Music
bragi play --url-env BRAGI_MEDIA_URL --headers-env BRAGI_MEDIA_HEADERS
bragi play ./track.wav --no-open --gain-db -3
bragi queue create ./mix.bragi.json ./one.wav ./two.mp3
bragi queue add ./mix.bragi.json ./another.wav
bragi queue list ./mix.bragi.json
bragi queue move ./mix.bragi.json 3 1
bragi queue remove ./mix.bragi.json 2
bragi play --queue ./mix.bragi.json
```

The bundled companion binds an ephemeral port on **127.0.0.1**. Click **Play** to unlock audio.
Keep the CLI and browser window open. `--no-open` prints the complete link for manual opening.
Remote media stays proxied through Node; browser state contains opaque identifiers and public
metadata, never original remote URLs, request headers or local filesystem paths. Selected files
support GET/HEAD, byte ranges, ETags and conditional requests. Requests are restricted by Host,
Origin and an ephemeral session capability; the companion is intended for local use.

Browser controls include seek, volume, queue navigation and supported OS media keys. Terminal
controls: **Space** pause/play, **N/P** next/previous, **←/→** seek ten seconds, **+/−** volume,
**Q** quit. Ctrl+C cancels work and restores terminal settings. Closing the browser releases its
audio resources; use Q or Ctrl+C to finish the waiting CLI. `--gain-db` applies explicit gain
between −30 and +12 dB; positive gain may clip. Metadata look-ahead caches only metadata.

Queues are local JSON files, at most 1,000 entries; duplicate recordings retain separate
occurrence IDs. Saved queues accept local paths only, resolved beside the queue file when
relative. Live playback has one queue coordinator and no background daemon.

## Preferences and automation

```sh
bragi setup --yes --output-directory ./exports
bragi config show --json
bragi config path
bragi config reset
bragi inspect ./track.wav --max-bytes 64MiB --timeout 10000 --json
```

The wizard reviews non-secret preferences before saving an atomic JSON file in your OS config
directory. `BRAGI_CONFIG` overrides its path. Defaults: 128MiB input/transfer/encoded output,
128MiB decoded PCM, 30s network/inspection deadline, readable output and no automatic overwrites
or artwork extraction. Output directory preferences supply the interactive menu's output prompt;
scripted commands use their explicit `--output` path. Configuration precedence is flags, then
`BRAGI_MAX_BYTES` / `BRAGI_MAX_PCM_BYTES` / `BRAGI_TIMEOUT` / `BRAGI_OUTPUT_DIRECTORY`, then saved
preferences, then defaults. Unknown schemas produce a recoverable error; `config reset` works
with malformed preferences. Noninteractive setup requires `--yes`.

`--json` prints a versioned result (`schemaVersion: 1`, `ok`, `kind`, `data`); `--jsonl` prints
one per inspected input, including individual failures. Long-running playback/conversion emits
one initial companion result with its URL and intended output. Progress, prompts and readable
errors use stderr. Redirected output and `NO_COLOR` remain free of terminal styling. Batch
inspection exits nonzero if any input fails. Error output uses stable codes and sanitized messages.

Exit codes: **0** success, **1** invalid/unsupported input or limits, **2** command usage,
**3** network/transfer failure, **4** filesystem/preferences, **5** unavailable backend,
**130** interrupted. Run `bragi COMMAND --help` for specific flags.

## Development

This directory is an independent pnpm package. Its runtime dependency is the published
`bragi-audio@0.2.2`, not the neighboring source checkout.

```sh
cd bragi
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm check
pnpm pack
```

The build includes the executable entry, metadata worker, browser JavaScript and HTML. Tests use
tiny generated PCM/WAV fixtures and local HTTP servers. CI checks Linux, macOS and Windows on
Node 24, plus the Node 22.13 minimum runtime. The source checkout includes `bragi/PLAN.md` with the design and future adapters.
