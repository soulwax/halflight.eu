import { Worker } from "node:worker_threads";
import { readdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { downloadAudio } from "bragi-audio/delivery";
import {
  AUDIO_FORMATS,
  findAudioFormatByExtension,
  type AudioAnalysis,
} from "bragi-audio";
import {
  CliError,
  safeFetch,
  deadline,
  readBounded,
  headers,
  result,
  label,
  clean,
  writeAtomic,
  type Context,
} from "./core.js";

export async function inspectOne(
  input: string,
  ctx: Context,
): Promise<AudioAnalysis> {
  const signal = deadline(ctx);
  const bytes = /^https?:/.test(input)
    ? await downloadAudio(input, {
        fetchImpl: safeFetch,
        headers: headers(ctx.options),
        signal,
        maxBytes: ctx.config.maxBytes,
      }).catch(() => {
        throw new CliError(
          "network",
          "Unable to read remote audio within the configured limits.",
          3,
        );
      })
    : input === "-"
      ? await readBounded(input, ctx.config.maxBytes, signal)
      : undefined;
  signal.throwIfAborted();
  return new Promise((resolveResult, reject) => {
    const worker = new Worker(
      new URL("./workers/inspect.js", import.meta.url),
      {
        workerData: {
          input,
          bytes,
          maxBytes: ctx.config.maxBytes,
          artwork: Boolean(ctx.options.artwork),
          strict: Boolean(ctx.options.strict),
        },
      },
    );
    let settled = false;
    const finish = (error?: Error, data?: AudioAnalysis) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      void worker.terminate();
      if (error) reject(error);
      else resolveResult(data!);
    };
    const abort = () =>
      finish(
        new CliError(
          "aborted",
          "Inspection interrupted or timed out.",
          ctx.signal.aborted ? 130 : 1,
        ),
      );
    signal.addEventListener("abort", abort, { once: true });
    worker.on(
      "message",
      (message: {
        ok: boolean;
        data?: AudioAnalysis;
        code: string;
        message: string;
        exit: number;
      }) =>
        message.ok
          ? finish(undefined, message.data)
          : finish(new CliError(message.code, message.message, message.exit)),
    );
    worker.on("error", () =>
      finish(new CliError("parser_failure", "Audio metadata worker failed.")),
    );
    worker.on("exit", () => {
      if (!settled)
        finish(
          new CliError(
            "parser_failure",
            "Audio metadata worker stopped unexpectedly.",
          ),
        );
    });
    if (signal.aborted) abort();
  });
}
export async function discover(
  input: string,
  recursive: boolean,
  maximum = 1000,
): Promise<string[]> {
  if (/^https?:/.test(input) || input === "-") return [input];
  if (!(await stat(input)).isDirectory()) return [input];
  const files: string[] = [];
  let visited = 0;
  const walk = async (dir: string) => {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (++visited > 10000)
        throw new CliError(
          "scan_limit",
          "Directory scan exceeds 10,000 entries. Select a smaller directory.",
        );
      const path = join(dir, entry.name);
      if (entry.isDirectory() && recursive) await walk(path);
      else if (entry.isFile() && findAudioFormatByExtension(entry.name)) {
        files.push(path);
        if (files.length > maximum)
          throw new CliError(
            "scan_limit",
            "Select at most 1,000 files per command.",
          );
      }
    }
  };
  await walk(input);
  return files;
}
export async function inspectInputs(
  inputs: string[],
  ctx: Context,
): Promise<void> {
  const files: string[] = [];
  for (const input of inputs)
    files.push(...(await discover(input, Boolean(ctx.options.recursive))));
  if (!files.length)
    throw new CliError("input", "No supported audio files found.");
  if (files.length > 1000)
    throw new CliError("scan_limit", "Select at most 1,000 files per command.");
  if (
    files.length > 1 &&
    (ctx.options.json || ctx.config.display === "json") &&
    !ctx.options.jsonl
  )
    throw new CliError("usage", "Use --jsonl for multiple inputs.", 2);
  let failures = 0;
  for (const input of files) {
    ctx.signal.throwIfAborted();
    try {
      const analysis = await inspectOne(input, ctx);
      const artwork: string[] = [];
      if (ctx.options.artwork)
        for (const picture of analysis.artwork) {
          const extension =
            picture.contentType === "image/png"
              ? "png"
              : picture.contentType === "image/jpeg"
                ? "jpg"
                : "bin";
          const path = resolve(
            ctx.options.artwork,
            `${randomUUID()}.${extension}`,
          );
          await writeAtomic(path, picture.data);
          artwork.push(path);
        }
      result(
        ctx,
        "inspection",
        { input: label(input), ...analysis, artwork },
        `${label(input)}\n${clean(analysis.tags.title ?? "Untitled")} — ${clean(analysis.tags.artists.join(", ") || "Unknown artist")}\n${analysis.format.codec ?? analysis.format.id}; ${analysis.format.sampleRate ?? "?"} Hz; ${analysis.format.channels ?? "?"} channels; ${analysis.format.durationSeconds?.toFixed(2) ?? "?"} seconds\n${analysis.warnings.map((w) => w.message).join("\n")}`.trim(),
      );
    } catch (error) {
      failures++;
      if (files.length === 1) throw error;
      const e =
        error instanceof CliError
          ? error
          : new CliError("inspection_failed", "Unable to inspect this input.");
      if (ctx.options.jsonl)
        process.stdout.write(
          JSON.stringify({
            schemaVersion: 1,
            ok: false,
            kind: "inspection",
            input: label(input),
            error: { code: e.code, message: e.message },
          }) + "\n",
        );
      else process.stderr.write(`${label(input)}: ${e.message}\n`);
    }
  }
  if (failures) process.exitCode = 1;
}
export function formats(ctx: Context): void {
  result(
    ctx,
    "formats",
    AUDIO_FORMATS,
    AUDIO_FORMATS.map(
      (format) =>
        `${format.label.padEnd(8)} ${format.extensions
          .map((extension) => `.${extension}`)
          .join(", ")
          .padEnd(14)} ${format.contentType}`,
    ).join("\n"),
  );
}
