import { open, mkdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { once } from "node:events";
import { fetchAudioStream, DeliveryError } from "bragi-audio/delivery";
import {
  CliError,
  safeFetch,
  readBounded,
  assertOutput,
  finishOutput,
  writeAtomic,
  headers,
  deadline,
  result,
  clean,
  type Context,
} from "./core.js";

interface Journal {
  version: 1;
  sourceId: string;
  etag: string;
  total: number | null;
}
function strongTag(value: string | null): value is string {
  return value !== null && /^"[^"\r\n]*"$/.test(value);
}
export async function transfer(input: string, ctx: Context): Promise<void> {
  if (!/^https?:/.test(input))
    throw new CliError(
      "usage",
      "Downloads and streams require an HTTP(S) audio source.",
      2,
    );
  if (
    ctx.options.stdout &&
    (ctx.options.resume ||
      ctx.options.json ||
      ctx.options.jsonl ||
      (process.stdout.isTTY && !ctx.options.force))
  )
    throw new CliError(
      "usage",
      "Binary stdout requires a pipe and cannot use resume or JSON.",
      2,
    );
  if (!ctx.options.stdout && !ctx.options.output)
    throw new CliError("usage", "Supply --output PATH or --stdout.", 2);
  const h = headers(ctx.options),
    signal = deadline(ctx);
  const sourceId = createHash("sha256")
    .update(input)
    .update(JSON.stringify([...h.entries()]))
    .digest("hex");
  const output = resolve(ctx.options.output ?? ".");
  const part = output + ".bragi-part",
    journalPath = part + ".json";
  let journal: Journal | undefined;
  let offset = 0;
  let file: Awaited<ReturnType<typeof open>> | undefined;
  let owned = false;
  let keep = false;
  let journalOwned = false;
  if (!ctx.options.stdout) {
    await assertOutput(output, ctx.options.force);
    await mkdir(dirname(output), { recursive: true });
    if (!ctx.options.resume) await assertOutput(journalPath);
    if (ctx.options.resume) {
      try {
        const raw: unknown = JSON.parse(
          new TextDecoder().decode(
            await readBounded(journalPath, 64 * 1024, signal),
          ),
        );
        if (raw && typeof raw === "object") {
          const j = raw as Journal;
          if (
            j.version === 1 &&
            j.sourceId === sourceId &&
            strongTag(j.etag) &&
            (j.total === null ||
              (Number.isSafeInteger(j.total) && j.total >= 0))
          )
            journal = j;
        }
        if (!journal)
          throw new CliError(
            "resume",
            "The resume journal does not match this source.",
            4,
          );
        journalOwned = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
          throw new CliError(
            "resume",
            "Invalid resume journal. Remove the .bragi-part files or use another output.",
            4,
          );
      }
      if (journal) {
        file = await open(part, constants.O_RDWR | constants.O_NOFOLLOW);
        const info = await file.stat();
        if (
          !info.isFile() ||
          info.nlink !== 1 ||
          info.size > ctx.config.maxBytes ||
          (journal.total !== null && info.size > journal.total)
        ) {
          await file.close();
          throw new CliError(
            "resume",
            "Unsafe or oversized partial file. Choose another output.",
            4,
          );
        }
        offset = info.size;
        owned = true;
        keep = true;
        if (offset > 0) {
          h.set("range", `bytes=${offset}-`);
          h.set("if-range", journal.etag);
        }
      }
    }
    if (!file) {
      file = await open(
        part,
        constants.O_RDWR |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600,
      );
      owned = true;
    }
  }
  const started = Date.now();
  let count: number;
  let expected: number | null;
  let lastProgress = 0;
  try {
    let response: Response;
    try {
      response = await fetchAudioStream(input, {
        fetchImpl: safeFetch,
        headers: h,
        signal,
        maxBytes: ctx.config.maxBytes,
      });
    } catch {
      throw new CliError(
        signal.aborted ? "aborted" : "network",
        signal.aborted
          ? "Download interrupted or timed out."
          : "Audio request failed. Check access, connection and byte limits; partial data is not treated as complete.",
        ctx.signal.aborted ? 130 : 3,
      );
    }
    const cancel = async () => {
      await response.body?.cancel().catch(() => undefined);
    };
    const encoding = response.headers.get("content-encoding");
    if (encoding && encoding !== "identity") {
      await cancel();
      throw new CliError(
        "network",
        "Audio server ignored identity encoding; safe byte accounting requires an uncompressed transfer.",
        3,
      );
    }
    const etag = response.headers.get("etag");
    const contentLength = response.headers.get("content-length");
    const declared = contentLength !== null ? Number(contentLength) : null;
    if (response.status === 206) {
      const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
        response.headers.get("content-range") ?? "",
      );
      if (
        !journal ||
        offset === 0 ||
        !range ||
        Number(range[1]) !== offset ||
        Number(range[2]) < offset ||
        Number(range[3]) <= Number(range[2]) ||
        Number(range[2]) !== Number(range[3]) - 1 ||
        etag !== journal.etag ||
        (journal.total !== null && journal.total !== Number(range[3])) ||
        (declared !== null && declared !== Number(range[2]) - offset + 1)
      ) {
        await cancel();
        throw new CliError(
          "resume",
          "Server returned an inconsistent range or validator. Retry with a new output.",
          3,
        );
      }
      expected = Number(range[3]);
      count = offset;
    } else if (response.status === 200) {
      offset = 0;
      count = 0;
      await file?.truncate(0);
      expected = declared;
    } else {
      await cancel();
      throw new CliError("network", "Unsupported audio response status.", 3);
    }
    if (
      expected !== null &&
      (!Number.isSafeInteger(expected) || expected > ctx.config.maxBytes)
    ) {
      await cancel();
      throw new CliError("size_limit", "Transfer exceeds --max-bytes.");
    }
    keep = Boolean(ctx.options.resume && strongTag(etag));
    if (keep && strongTag(etag))
      await writeAtomic(
        journalPath,
        JSON.stringify({
          version: 1,
          sourceId,
          etag,
          total: expected,
        } satisfies Journal) + "\n",
        journalOwned,
      );
    if (keep) journalOwned = true;
    const reader = response.body!.getReader();
    try {
      for (;;) {
        signal.throwIfAborted();
        const chunk = await reader.read();
        if (chunk.done) break;
        if (
          count + chunk.value.byteLength > ctx.config.maxBytes ||
          (expected !== null && count + chunk.value.byteLength > expected)
        )
          throw new CliError(
            "size_limit",
            "Transfer exceeds its declared or configured byte limit.",
          );
        if (file) {
          let written = 0;
          while (written < chunk.value.byteLength) {
            const write = await file.write(
              chunk.value,
              written,
              chunk.value.byteLength - written,
              count + written,
            );
            if (!write.bytesWritten)
              throw new CliError("filesystem", "Unable to write output.", 4);
            written += write.bytesWritten;
          }
        } else if (!process.stdout.write(chunk.value))
          await once(process.stdout, "drain");
        count += chunk.value.byteLength;
        if (
          !ctx.options.quiet &&
          process.stderr.isTTY &&
          Date.now() - lastProgress > 200
        ) {
          lastProgress = Date.now();
          process.stderr.write(
            `\r${count.toLocaleString()} bytes${expected ? ` (${Math.floor((count / expected) * 100)}%)` : ""}; ${((Date.now() - started) / 1000).toFixed(1)}s`,
          );
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
      if (!ctx.options.quiet && process.stderr.isTTY)
        process.stderr.write("\n");
    }
    if (expected !== null && count !== expected)
      throw new CliError(
        "truncated",
        "Audio transfer ended before its declared length.",
        3,
      );
    if (file) {
      await file.sync();
      await file.close();
      file = undefined;
      await finishOutput(part, output, Boolean(ctx.options.force));
      if (journalOwned) await rm(journalPath, { force: true });
      result(
        ctx,
        "download",
        { output, bytes: count, resumedBytes: offset },
        `Saved ${clean(output)} (${count} bytes)`,
      );
    }
  } catch (error) {
    if (error instanceof CliError) throw error;
    if (error instanceof DeliveryError && error.message.includes("byte limit"))
      throw new CliError("size_limit", "Transfer exceeds --max-bytes.");
    if (signal.aborted)
      throw new CliError(
        "aborted",
        "Download interrupted or timed out.",
        ctx.signal.aborted ? 130 : 3,
      );
    throw new CliError(
      "transfer_failed",
      "Transfer failed; check connection, limits and writable disk space.",
      3,
    );
  } finally {
    await file?.close().catch(() => undefined);
    if (owned && !keep) {
      await rm(part, { force: true });
      if (journalOwned) await rm(journalPath, { force: true });
    }
  }
}
