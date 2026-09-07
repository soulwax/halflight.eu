# Wrong quality tier, or a preview served as a full track

These are the failures the player is actually _designed_ to notice: `assessPlayback`
compares what the catalogue promised and what was requested against what arrived, and
surfaces a warning badge. So unlike the other families, you usually start with a verdict
rather than a silence. The work is deciding whether the verdict is right.

## Where the requested tier comes from

`getRequestedStreamQuality(url, userId)` (`src/lib/server/tidal/playback.ts`), used by
**both** `/stream` and `/audio` so they can't disagree:

1. `?quality=` on the request, uppercased, if it is one of
   `LOW` | `HIGH` | `LOSSLESS` | `HI_RES_LOSSLESS`.
2. Otherwise the owner's persisted `preferredQuality` (default `HIGH`).
3. `undefined` if there's no user — which makes `resolveTrackStream` start at the top of
   the ladder.

If the delivered tier surprises you, check the persisted setting first
(`/app/settings/tidal`, `streaming_settings` table). A stale preference explains most
"why is this only HIGH" reports.

## How the ladder actually walks

```ts
const ladder = options.quality
	? [options.quality, ...QUALITY_LADDER.filter((q) => q !== options.quality)]
	: QUALITY_LADDER; // HI_RES_LOSSLESS, LOSSLESS, HIGH, LOW
```

It advances to the next tier **only** on `subStatus 5003` ("not allowed in your plan").
Every other error is rethrown immediately. When every tier returns 5003, it throws
`TidalQualityDeniedError` → `403 plan_no_streaming`.

Two consequences that surprise people:

- With an explicit request, the remaining ladder is the **full** list with the requested
  tier removed — so a `LOW` request whose first attempt 5003s tries `HI_RES_LOSSLESS`
  next, i.e. _upward_. This contradicts the function's own docstring at `stream.ts:6-14`,
  which promises it walks **down**. Treat it as a real defect, not a curiosity: besides
  possibly answering a low-tier request with a higher one, a denied request issues its
  `playbackinfopostpaywall` calls in the wrong order and can make up to three upstream
  calls where one was intended. The fix is to slice the ladder from the requested tier
  downward instead of reordering the whole list.
- A single tier failing is normal and invisible. Only total denial is reported. If you
  need to know which tiers were tried, `TidalQualityDeniedError` carries `triedQualities`,
  but nothing on the success path records the walk. Instrument `resolveTrackStream`
  temporarily if you need it.

## Reading the assessment verdict

`src/lib/player/playback-assessment.ts` — pure, no browser, no network. Thresholds:

| Constant              | Value  | Meaning                                   |
| --------------------- | ------ | ----------------------------------------- |
| `SHORT_RATIO`         | `0.9`  | below this ratio → `length: 'short'`      |
| `LONG_RATIO`          | `1.15` | above → `length: 'long'`                  |
| `PREVIEW_RATIO`       | `0.6`  | preview requires ratio below this **and** |
| `PREVIEW_MAX_SECONDS` | `45`   | actual duration at or under 45 s          |

`downgraded` compares `QUALITY_RANK`: `LOW 0 · HIGH 1 · LOSSLESS 2 · HI_RES 3 ·
HI_RES_LOSSLESS 3`. Note `HI_RES` and `HI_RES_LOSSLESS` share rank 3, so a swap between
them is deliberately not a downgrade. `lossless` is `codecs === 'flac'` exactly — a
HiRes fMP4 track is lossless in fact but reports `lossless: false` from this field.
That's a known sharp edge; check `delivery.lossless` from `describePlaybackDelivery`
instead if you need truth rather than the badge's notion.

In `mode: 'embed'` all issue detection is skipped — the iframe is a black box, so a
missing warning during embed playback is correct behaviour, not a gap.

Inputs come from two different places, and mixing them up is the usual root cause:
`expectedSeconds` is the **catalogue** duration (`track.duration`, set in
`switchToTrack`), `actualSeconds` is `HTMLAudioElement.duration` once metadata loads
(`hasMediaMetadata`). If the catalogue duration is wrong or zero, every verdict derived
from it is garbage — verify that before suspecting the stream.

## Genuine preview served as full track

`/stream` hardcodes `isPreview: false` and requests
`assetpresentation=FULL&playbackmode=STREAM`. So Syn never _knowingly_ serves a preview;
the assessment exists to catch TIDAL returning a 30-second asset anyway. A true positive
here means the upstream response was a preview despite the FULL request — check the
`assetPresentation` field on the raw `TrackStreamResponse`, which Syn types as `'FULL'`
but does not verify.

That unverified assumption is a legitimate thing to tighten if you're already in there.

## Reproduce

Everything above except the upstream call is pure:

```sh
pnpm exec vitest run --project server src/lib/player/playback-assessment.spec.ts
pnpm exec vitest run --project server src/lib/server/tidal/stream.spec.ts
pnpm exec vitest run --project server src/lib/server/tidal/playback.spec.ts
```

`playback.spec.ts` injects a settings reader, so preference-resolution cases need no
database.
