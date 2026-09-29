import { constants } from "node:fs";
import { mkdir, open, link, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import envPaths from "env-paths";
import { once } from "node:events";
import { AudioCodecError } from "bragi-audio/audio";
import { AudioMetadataError } from "bragi-audio";

export class CliError extends Error {
  constructor(
    public code: string,
    message: string,
    public exit = 1,
  ) {
    super(message);
  }
}
export function safeError(error: unknown): CliError {
  if (error instanceof CliError) return error;
  if (error instanceof AudioCodecError || error instanceof AudioMetadataError)
    return new CliError(
      error.code,
      `Audio operation failed (${error.code}). Check the format and byte limits.`,
    );
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  )
    return new CliError(
      "aborted",
      "Operation interrupted or timed out.",
      error.name === "AbortError" ? 130 : 3,
    );
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (["EACCES", "EPERM", "ENOENT", "EISDIR", "ENOSPC", "ELOOP"].includes(code))
    return new CliError(
      "filesystem",
      `File operation failed (${code}). Check paths, permissions and available space.`,
      4,
    );
  if (code === "EEXIST")
    return new CliError(
      "exists",
      "Output already exists. Choose another path or use --force.",
      4,
    );
  return new CliError(
    "operation_failed",
    "Operation failed. Check the input, connection and configured limits.",
  );
}
export function size(value: string | number): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
    return value;
  const match = /^(\d+(?:\.\d+)?)\s*(B|KiB|MiB|GiB|KB|MB|GB)?$/i.exec(
    String(value),
  );
  const factors: Record<string, number> = {
    b: 1,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    kb: 1000,
    mb: 1000 ** 2,
    gb: 1000 ** 3,
  };
  const bytes = match
    ? Number(match[1]) * factors[(match[2] ?? "B").toLowerCase()]!
    : NaN;
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 1024 ** 3)
    throw new CliError(
      "usage",
      "Byte limits must be positive and at most 1GiB; for example 128MiB.",
      2,
    );
  return bytes;
}
export function positive(value: string | number): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new CliError("usage", "Expected a positive integer.", 2);
  return n;
}
export interface Preferences {
  version: 1;
  backend: "browser";
  outputDirectory: string;
  maxBytes: number;
  maxPcmBytes: number;
  timeout: number;
  display: "human" | "json";
}
export const defaults: Preferences = {
  version: 1,
  backend: "browser",
  outputDirectory: resolve("."),
  maxBytes: 128 * 1024 ** 2,
  maxPcmBytes: 128 * 1024 ** 2,
  timeout: 30000,
  display: "human",
};
export function configPath(): string {
  return (
    process.env.BRAGI_CONFIG ??
    resolve(envPaths("bragi", { suffix: "" }).config, "config.json")
  );
}
export function preferences(value: unknown): Preferences {
  if (!value || typeof value !== "object")
    throw new CliError(
      "config",
      "Invalid preferences. Run bragi config reset, then bragi setup.",
      4,
    );
  const v = value as Record<string, unknown>;
  if (
    v.version !== 1 ||
    v.backend !== "browser" ||
    typeof v.outputDirectory !== "string" ||
    !["human", "json"].includes(String(v.display))
  )
    throw new CliError(
      "config",
      "Unsupported preferences schema. Run bragi config reset, then bragi setup.",
      4,
    );
  return {
    version: 1,
    backend: "browser",
    outputDirectory: resolve(v.outputDirectory),
    display: v.display as Preferences["display"],
    maxBytes: size(String(v.maxBytes)),
    maxPcmBytes: size(String(v.maxPcmBytes)),
    timeout: positive(String(v.timeout)),
  };
}
export async function loadPreferences(): Promise<Preferences> {
  try {
    return preferences(
      JSON.parse(
        new TextDecoder().decode(
          await readBounded(configPath(), 64 * 1024, AbortSignal.timeout(5000)),
        ),
      ) as unknown,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { ...defaults };
    throw safeError(error);
  }
}
export interface Options {
  json?: boolean;
  jsonl?: boolean;
  quiet?: boolean;
  force?: boolean;
  maxBytes?: string | number;
  maxPcmBytes?: string | number;
  timeout?: string | number;
  output?: string;
  urlEnv?: string;
  headersEnv?: string;
  recursive?: boolean;
  artwork?: string;
  strict?: boolean;
  stdout?: boolean;
  resume?: boolean;
  noInteractive?: boolean;
}
export interface Context {
  options: Options;
  config: Preferences;
  signal: AbortSignal;
}
export async function context(
  options: Options,
  signal: AbortSignal,
): Promise<Context> {
  const prefs = await loadPreferences();
  return {
    options,
    signal,
    config: {
      ...prefs,
      maxBytes: size(
        options.maxBytes ?? process.env.BRAGI_MAX_BYTES ?? prefs.maxBytes,
      ),
      maxPcmBytes: size(
        options.maxPcmBytes ??
          process.env.BRAGI_MAX_PCM_BYTES ??
          prefs.maxPcmBytes,
      ),
      timeout: positive(
        options.timeout ?? process.env.BRAGI_TIMEOUT ?? prefs.timeout,
      ),
      outputDirectory: resolve(
        process.env.BRAGI_OUTPUT_DIRECTORY ?? prefs.outputDirectory,
      ),
    },
  };
}
export function deadline(ctx: Context): AbortSignal {
  return AbortSignal.any([ctx.signal, AbortSignal.timeout(ctx.config.timeout)]);
}
export function result(
  ctx: Context,
  kind: string,
  data: unknown,
  human?: string,
): void {
  if (ctx.options.json || ctx.options.jsonl || ctx.config.display === "json")
    process.stdout.write(
      JSON.stringify({ schemaVersion: 1, ok: true, kind, data }) + "\n",
    );
  else if (!ctx.options.quiet)
    process.stdout.write((human ?? JSON.stringify(data, null, 2)) + "\n");
}
export function clean(value: string): string {
  return value.replace(/[\p{Cc}\p{Cf}]/gu, " ").slice(0, 1024);
}
export function label(input: string): string {
  return /^https?:/i.test(input) ? "Remote audio" : clean(basename(input));
}
export function source(input: string | undefined, options: Options): string {
  const value = options.urlEnv ? process.env[options.urlEnv] : input;
  if (!value)
    throw new CliError("usage", "Supply an input or --url-env NAME.", 2);
  if (/^https?:/i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new CliError("usage", "Invalid HTTP audio URL.", 2);
    }
    if (url.username || url.password)
      throw new CliError(
        "usage",
        "Use --headers-env for credentials, not URL user information.",
        2,
      );
    return url.href;
  }
  if (options.urlEnv)
    throw new CliError(
      "usage",
      "The URL environment variable must contain an HTTP(S) URL.",
      2,
    );
  return value === "-" ? value : resolve(value);
}
export function headers(options: Options): Headers {
  const h = new Headers();
  if (options.headersEnv) {
    try {
      const value: unknown = JSON.parse(process.env[options.headersEnv] ?? "");
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error();
      for (const [key, item] of Object.entries(value)) {
        if (
          typeof item !== "string" ||
          /^(range|if-range|host|connection|content-length|accept-encoding)$/i.test(
            key,
          )
        )
          throw new Error();
        h.set(key, item);
      }
    } catch {
      throw new CliError(
        "usage",
        "Header environment variable must contain a JSON object of strings; transport headers are reserved.",
        2,
      );
    }
  }
  h.set("accept-encoding", "identity");
  return h;
}
export async function readBounded(
  input: string,
  max: number,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  if (input === "-") {
    if (process.stdin.isTTY)
      throw new CliError(
        "usage",
        "Pipe binary input to stdin or supply a file.",
        2,
      );
    const chunks: Buffer[] = [];
    let count = 0;
    const abort = () =>
      process.stdin.destroy(new CliError("aborted", "Input interrupted.", 130));
    signal.addEventListener("abort", abort, { once: true });
    try {
      signal.throwIfAborted();
      for await (const chunk of process.stdin) {
        const b = Buffer.from(chunk as Uint8Array);
        count += b.length;
        if (count > max)
          throw new CliError("size_limit", "Input exceeds --max-bytes.");
        chunks.push(b);
      }
      return new Uint8Array(Buffer.concat(chunks));
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }
  const file = await open(input, "r");
  try {
    const info = await file.stat();
    if (!info.isFile())
      throw new CliError("input", "Input must be a regular file.");
    if (info.size > max)
      throw new CliError("size_limit", "Input exceeds --max-bytes.");
    const chunks: Buffer[] = [];
    let count = 0;
    for await (const chunk of file.createReadStream({
      autoClose: false,
      signal,
    })) {
      const b = Buffer.from(chunk as Uint8Array);
      count += b.length;
      if (count > max)
        throw new CliError("size_limit", "Input exceeds --max-bytes.");
      chunks.push(b);
    }
    return new Uint8Array(Buffer.concat(chunks));
  } finally {
    await file.close();
  }
}
export async function assertOutput(path: string, force = false): Promise<void> {
  if (force) return;
  try {
    await stat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new CliError(
    "exists",
    "Output already exists. Use --force to replace it.",
    4,
  );
}
export async function finishOutput(
  part: string,
  path: string,
  force: boolean,
): Promise<void> {
  if (force) await rename(part, path);
  else {
    await link(part, path);
    await rm(part);
  }
}
export async function writeAtomic(
  path: string,
  bytes: Uint8Array | string,
  force = false,
): Promise<void> {
  path = resolve(path);
  await assertOutput(path, force);
  await mkdir(dirname(path), { recursive: true });
  const part = `${path}.${randomUUID()}.part`;
  const file = await open(
    part,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
    0o600,
  );
  try {
    await file.writeFile(bytes);
    await file.sync();
    await file.close();
    await finishOutput(part, path, force);
  } finally {
    await file.close().catch(() => undefined);
    await rm(part, { force: true });
  }
}
export async function binaryOutput(
  bytes: Uint8Array,
  ctx: Context,
): Promise<void> {
  if (ctx.options.stdout) {
    if (
      ctx.options.json ||
      ctx.options.jsonl ||
      (process.stdout.isTTY && !ctx.options.force)
    )
      throw new CliError(
        "usage",
        "Binary stdout needs a pipe and cannot be combined with JSON; use --force to override the terminal guard.",
        2,
      );
    if (!process.stdout.write(bytes)) await once(process.stdout, "drain");
  } else {
    if (!ctx.options.output)
      throw new CliError("usage", "Supply --output PATH or --stdout.", 2);
    await writeAtomic(ctx.options.output, bytes, ctx.options.force);
    result(
      ctx,
      "output",
      { output: resolve(ctx.options.output), bytes: bytes.byteLength },
      `Saved ${clean(resolve(ctx.options.output))} (${bytes.byteLength} bytes)`,
    );
  }
}
/** Follow bounded redirects without forwarding private headers to another origin. */
export const safeFetch: typeof fetch = async (input, init) => {
  let url = new URL(input instanceof Request ? input.url : String(input));
  for (let hop = 0; hop <= 5; hop++) {
    const response = await fetch(url, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location || hop === 5)
      throw new CliError(
        "redirect",
        "Audio redirect limit exceeded or redirect is invalid.",
        3,
      );
    const next = new URL(location, url);
    const h = new Headers(init?.headers);
    if (
      !["http:", "https:"].includes(next.protocol) ||
      next.username ||
      next.password ||
      (next.origin !== url.origin &&
        [...h.keys()].some(
          (key) => !["accept-encoding", "range", "if-range"].includes(key),
        ))
    )
      throw new CliError(
        "redirect",
        "A private audio request cannot redirect to another origin.",
        3,
      );
    url = next;
  }
  throw new CliError("redirect", "Audio redirect limit exceeded.", 3);
};
