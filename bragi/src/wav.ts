import { resolve } from "node:path";
import { decodeWav, encodeWav, type PcmAudio } from "bragi-audio/audio";
import {
  CliError,
  assertOutput,
  readBounded,
  deadline,
  binaryOutput,
  result,
  writeAtomic,
  type Context,
} from "./core.js";

export function bitDepth(encoding: string): 16 | 24 | 32 {
  if (encoding === "pcm16") return 16;
  if (encoding === "pcm24") return 24;
  if (encoding === "float32") return 32;
  throw new CliError("usage", "Choose pcm16, pcm24 or float32 encoding.", 2);
}
export function pcmToBytes(
  pcm: PcmAudio,
  max: number,
): Uint8Array<ArrayBuffer> {
  const frames = pcm.channels[0]?.length ?? 0;
  const length = frames * pcm.channels.length * 4;
  if (length > max)
    throw new CliError("size_limit", "Raw PCM output exceeds --max-pcm-bytes.");
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  for (let frame = 0; frame < frames; frame++)
    for (let ch = 0; ch < pcm.channels.length; ch++)
      view.setFloat32(
        (frame * pcm.channels.length + ch) * 4,
        pcm.channels[ch]![frame]!,
        true,
      );
  return bytes;
}
export function bytesToPcm(
  bytes: Uint8Array,
  sampleRate: number,
  channels: number,
  max: number,
): PcmAudio {
  if (channels !== 1 && channels !== 2)
    throw new CliError(
      "unsupported_codec",
      "WAV encoding supports mono or stereo.",
    );
  if (
    !Number.isSafeInteger(sampleRate) ||
    sampleRate < 1 ||
    sampleRate > 384000 ||
    bytes.byteLength === 0 ||
    bytes.byteLength % (channels * 4) !== 0
  )
    throw new CliError(
      "invalid_pcm",
      "Supply a valid sample rate and frame-aligned interleaved float32 little-endian PCM.",
    );
  if (bytes.byteLength > max)
    throw new CliError("size_limit", "PCM input exceeds --max-pcm-bytes.");
  const frames = bytes.byteLength / (channels * 4);
  const result = Array.from(
    { length: channels },
    () => new Float32Array(frames),
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let frame = 0; frame < frames; frame++)
    for (let ch = 0; ch < channels; ch++) {
      const value = view.getFloat32((frame * channels + ch) * 4, true);
      if (!Number.isFinite(value))
        throw new CliError("invalid_pcm", "PCM samples must be finite.");
      result[ch]![frame] = value;
    }
  return { sampleRate, channels: result };
}
export async function wavCommand(
  kind: string,
  input: string,
  ctx: Context,
  extra: {
    encoding?: string;
    sampleRate?: string;
    channels?: string;
    metadata?: string;
  },
): Promise<void> {
  if (kind !== "inspect" && !ctx.options.stdout) {
    if (!ctx.options.output)
      throw new CliError("usage", "Supply --output PATH or --stdout.", 2);
    await assertOutput(ctx.options.output, ctx.options.force);
  }
  if (
    extra.metadata &&
    (resolve(extra.metadata) === resolve(ctx.options.output ?? ".") ||
      resolve(extra.metadata) === resolve(input))
  )
    throw new CliError("usage", "The metadata sidecar needs its own path.", 2);
  const bytes = await readBounded(input, ctx.config.maxBytes, deadline(ctx));
  const options = {
    maxBytes: ctx.config.maxBytes,
    maxPcmBytes: ctx.config.maxPcmBytes,
  };
  if (kind === "encode") {
    const pcm = bytesToPcm(
      bytes,
      Number(extra.sampleRate),
      Number(extra.channels),
      ctx.config.maxPcmBytes,
    );
    await binaryOutput(
      encodeWav(pcm, {
        bitDepth: bitDepth(extra.encoding ?? "pcm16"),
        maxBytes: ctx.config.maxBytes,
      }),
      ctx,
    );
    return;
  }
  const pcm = decodeWav(bytes, options);
  if (kind === "inspect") {
    const data = {
      sampleRate: pcm.sampleRate,
      channels: pcm.channels.length,
      frames: pcm.channels[0]!.length,
      durationSeconds: pcm.channels[0]!.length / pcm.sampleRate,
    };
    result(ctx, "wav", data);
  } else if (kind === "decode") {
    if (extra.metadata)
      await writeAtomic(
        resolve(extra.metadata),
        JSON.stringify(
          {
            schemaVersion: 1,
            encoding: "float32-le",
            layout: "interleaved",
            sampleRate: pcm.sampleRate,
            channels: pcm.channels.length,
            frames: pcm.channels[0]!.length,
          },
          null,
          2,
        ) + "\n",
        ctx.options.force,
      );
    await binaryOutput(pcmToBytes(pcm, ctx.config.maxPcmBytes), ctx);
  } else {
    if (!ctx.options.quiet)
      process.stderr.write(
        "WAV conversion preserves sample rate and channels; tags, artwork and extra RIFF chunks are omitted.\n",
      );
    await binaryOutput(
      encodeWav(pcm, {
        bitDepth: bitDepth(extra.encoding ?? "pcm16"),
        maxBytes: ctx.config.maxBytes,
      }),
      ctx,
    );
  }
}
