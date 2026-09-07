# Track won't play, or the embed badge appears

The TIDAL embed iframe is the player's universal fallback. Almost every failure ends
here, which is why the badge alone tells you nothing. Your job is to find out _which_
of the four assignments fired.

## The four ways `playbackMode` becomes `'embed'`

All in `src/lib/player/player.svelte.ts`:

| Line   | Trigger                                       | What it means                                                                                          |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `:289` | `<audio>` `error` event                       | The **byte leg** failed after a good `src`. `/audio` returned an error, or the bytes were undecodable. |
| `:748` | `audio.play()` rejected after metadata loaded | Usually autoplay policy (no user gesture) or an immediately-broken source.                             |
| `:761` | `data` was null — no metadata at all          | The **metadata leg** failed. `playbackReason` is set.                                                  |
| `:785` | `play()` rejected in `togglePlayPause`        | Same as `:748`, on a later press.                                                                      |

`:761` is the only one that leaves a `playbackReason`. That is the whole diagnostic
split: **a null `playbackReason` with an embed badge means the metadata leg was fine.**

## Metadata leg failed (`playbackReason` is set)

`GET /api/tracks/[id]/stream` returns a typed JSON error. Map it:

| `playbackReason` | HTTP | Cause                                                               | Where to look                                                                                                                                                      |
| ---------------- | ---- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `not_linked`     | 403  | `status.hasPlayback` is false — no device (playback) token stored   | `/app/settings/tidal`, then `/api/tidal/device-auth` + `/poll`                                                                                                     |
| `http_403`       | 403  | `playback_unauthorized` (token rejected) or `plan_no_streaming`     | `getPlaybackToken` in `client.ts`; `TidalQualityDeniedError` in `stream.ts`                                                                                        |
| `http_404`       | 404  | `track_unavailable` or `stream_unavailable`                         | `isTrackUnavailableForPlayback` — TIDAL returns a **401 with "asset is not ready for playback"** for a delisted track; that is asset-specific, not an auth problem |
| `http_503`       | 503  | `not_connected` — `status.configured` false, no browse token at all | `/tidal/connect`                                                                                                                                                   |
| `network_error`  | —    | `fetch` threw                                                       | Offline, dev server down, or the route crashed before responding                                                                                                   |

The 401-means-unavailable case is the one people get wrong. `isTrackUnavailableForPlayback`
exists precisely so a delisted track is not presented as "reconnect your account". If you
see users being told to re-link over a single bad track, that predicate is where to look.

Distinguish "no streaming plan" from "this track is denied": `TidalQualityDeniedError`
is thrown only when **every** tier on the ladder came back with `subStatus 5003`. One
tier failing is normal and gets walked past.

## Byte leg failed (`playbackReason` is null)

Nothing recorded why. Get the `/audio` response:

- **Network tab** — status and body text. The route uses SvelteKit `error()` with plain
  strings: `503 TIDAL not connected` · `403 Full playback is not linked…` ·
  `404 Track unavailable from TIDAL` · `403 The requested playback quality is unavailable…` ·
  `404 Stream unavailable` · `502 CDN unreachable` / `502 CDN unavailable`.
- **PM2/dev log** — a 502 always has a matching `log.error('audio proxy: …')` line with
  `trackId`, `cdnHost`, and either `status` or the error's class name.

A 502 means Syn reached the route but the CDN leg failed. Two distinct causes:

1. **`CDN fetch threw`** — network/DNS, or the request carried context the CDN rejects.
   Verify the call still uses the **global `fetch`**. `event.fetch` forwards cookies and
   referer, and the media CDN 403s a signed URL that carries them. This is the single
   most common self-inflicted 502 in this codebase.
2. **`CDN returned an error`** — the signed URL expired or was refused. Stream URLs are
   short-lived; a long pause between `/stream` and `/audio` can outlive one.

If `/audio` returned **200 with bytes** and playback still died, it's a decode problem —
go to `references/stalls-and-seeking.md` and check `MediaError.code`.

## Auth and entitlement checks

Two independent tokens, and playback needs the _second_ one:

- `secret` — authorization-code + PKCE, for JSON:API v2 browse. Connected at
  `/tidal/connect`. Sufficient for search and browse; **useless for playback**.
- `playback_secret` — TIDAL Link device authorization (`r_usr`). Connected via
  `/api/tidal/device-auth`. This is what `getPlaybackToken` reads.

So "search works but nothing plays" is the classic signature of a missing or expired
`playback_secret`. `getConnectionStatus()` reports `configured` / `connected` /
`hasPlayback` — `hasPlayback: false` confirms it immediately.

Both tokens refresh pre-expiry (`EXPIRY_SKEW_MS = 60_000`) with rotation, behind a
module-level single-flight guard. If you suspect a refresh race, note that the guard is
per-process: under PM2 there is one instance (`exec_mode: 'fork'`, `instances: 1`), so a
cross-instance race is not possible here — look at the DB row instead.

## Reproduce cheaply

```sh
pnpm exec vitest run --project server src/lib/server/tidal/client.spec.ts
pnpm exec vitest run --project server src/lib/server/tidal/stream.spec.ts
pnpm exec vitest run --project server "src/routes/api/tracks/[id]/stream/+server.spec.ts"
```

Each server module takes an injectable store, so token-state scenarios (expired,
rotated, missing) are testable with no database.
