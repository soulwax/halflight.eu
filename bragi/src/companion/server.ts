import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { open, readFile, stat } from "node:fs/promises";
import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { fileURLToPath } from "node:url";
import {
  fetchAudioStream,
  parseByteRange,
  matchesEntityTag,
  rangeIsUsable,
} from "bragi-audio/delivery";
import { findAudioFormatByExtension } from "bragi-audio";
import { encodeWav, decodeWav } from "bragi-audio/audio";
import {
  CliError,
  safeFetch,
  label,
  headers,
  writeAtomic,
  type Context,
} from "../core.js";
import { inspectOne } from "../inspect.js";

export interface PublicTrack {
  id: string;
  entryId: string;
  title: string;
  artists: string[];
  duration?: number;
  codec?: string;
}
export interface CompanionOptions {
  inputs: string[];
  context: Context;
  mode?: "play" | "convert";
  encoding?: 16 | 24 | 32;
  gainDb?: number;
  assets?: URL;
  onState?: (state: Record<string, unknown>) => void;
  onComplete?: (output?: string) => void;
}
export interface Companion {
  url: string;
  origin: string;
  token: string;
  control(action: string, value?: number): void;
  close(): Promise<void>;
}
const assets = new URL("./", import.meta.url);
function equal(a: string, b: string): boolean {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function createCompanion(
  options: CompanionOptions,
): Promise<Companion> {
  const shutdown = new AbortController();
  const ctx = {
    ...options.context,
    signal: AbortSignal.any([options.context.signal, shutdown.signal]),
  };
  let inspectionTail: Promise<void> = Promise.resolve();
  if (!options.inputs.length || options.inputs.length > 1000)
    throw new CliError("usage", "Playback needs 1–1,000 selected sources.", 2);
  for (const input of options.inputs) {
    if (!/^https?:/.test(input)) {
      const info = await stat(input);
      if (!info.isFile())
        throw new CliError(
          "input",
          "Playback inputs must be regular files or HTTP(S) sources.",
        );
      if (info.size > ctx.config.maxBytes)
        throw new CliError(
          "size_limit",
          "Playback source exceeds --max-bytes.",
        );
    }
  }
  const token = randomUUID();
  const cookieName = `bragi_session_${token.slice(0, 8)}`;
  const sources = new Map<string, string>();
  const tracks: PublicTrack[] = options.inputs.map((input) => {
    const id = randomUUID();
    sources.set(id, input);
    return { id, entryId: randomUUID(), title: label(input), artists: [] };
  });
  let index = 0;
  let origin = "";
  let closing = false;
  const clients = new Set<ServerResponse>();
  const operations = new Set<AbortController>();
  const metadata = new Map<string, Promise<PublicTrack>>();
  const digestCache = new Map<string, { stamp: string; tag: string }>();
  function broadcast(command: unknown) {
    for (const client of clients)
      client.write(`data: ${JSON.stringify(command)}\n\n`);
  }
  const state = () => ({ type: "load", index, track: tracks[index] });
  function control(action: string, value?: number) {
    if (action === "next" || action === "previous") {
      const nextIndex = Math.max(
        0,
        Math.min(tracks.length - 1, index + (action === "next" ? 1 : -1)),
      );
      if (nextIndex === index) return;
      index = nextIndex;
      for (const op of operations) op.abort();
      broadcast(state());
    } else if (action === "ended") {
      if (index < tracks.length - 1) control("next");
      else broadcast({ type: "pause" });
    } else if (action === "stop") {
      broadcast({ type: "stop" });
      options.onComplete?.();
    } else if (
      ["toggle", "play", "pause", "seek", "volume", "volume-step"].includes(
        action,
      )
    )
      broadcast({ type: action, value });
  }
  const server = createServer((request, response) => {
    void handle(request, response).catch(() => {
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "operation_failed" }));
      } else response.destroy();
    });
  });
  async function body(request: IncomingMessage, max: number): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of request) {
      const b = Buffer.from(chunk as Uint8Array);
      total += b.length;
      if (total > max)
        throw new CliError("size_limit", "Request exceeds limit.");
      chunks.push(b);
    }
    return Buffer.concat(chunks);
  }
  function json(response: ServerResponse, data: unknown, status = 200) {
    response.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify(data));
  }
  async function localMedia(
    input: string,
    request: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) {
    const file = await open(input, "r");
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size > ctx.config.maxBytes) {
        json(response, { error: "input_limit" }, 413);
        return;
      }
      const stamp = `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
      let cached = digestCache.get(input);
      if (cached?.stamp !== stamp) {
        const hash = createHash("sha256");
        let bytes = 0;
        for await (const chunk of file.createReadStream({
          autoClose: false,
          start: 0,
          signal,
        })) {
          bytes += (chunk as Buffer).length;
          if (bytes > ctx.config.maxBytes)
            throw new CliError("size_limit", "Source exceeds limit.");
          hash.update(chunk as Buffer);
        }
        const after = await file.stat();
        if (
          bytes !== info.size ||
          after.mtimeMs !== info.mtimeMs ||
          after.ctimeMs !== info.ctimeMs
        )
          throw new CliError("changed", "Source changed during inspection.");
        cached = { stamp, tag: `"${hash.digest("hex")}"` };
        digestCache.set(input, cached);
      }
      const tag = cached.tag;
      const type =
        findAudioFormatByExtension(input)?.contentType ??
        "application/octet-stream";
      const common = {
        "content-type": type,
        etag: tag,
        "accept-ranges": "bytes",
        "cache-control": "private, no-cache",
      };
      const notModified = request.headers["if-none-match"];
      if (
        typeof notModified === "string" &&
        matchesEntityTag(notModified.replace(/W\//g, ""), tag)
      ) {
        response.writeHead(304, common);
        response.end();
        return;
      }
      const webRequest = new Request(origin, {
        headers: {
          ...(typeof request.headers.range === "string"
            ? { range: request.headers.range }
            : {}),
          ...(typeof request.headers["if-range"] === "string"
            ? { "if-range": request.headers["if-range"] }
            : {}),
        },
      });
      const header = request.headers.range;
      // Malformed and multipart ranges are ignored; valid but unsatisfiable single ranges return 416.
      const single =
        typeof header === "string" && /^bytes=(?:\d+-\d*|-\d+)$/.test(header);
      const usable = single && rangeIsUsable(webRequest, tag);
      const range = usable ? parseByteRange(header, info.size) : null;
      if (usable && !range) {
        response.writeHead(416, {
          ...common,
          "content-range": `bytes */${info.size}`,
        });
        response.end();
        return;
      }
      const start = range?.start ?? 0,
        end = range?.end ?? info.size - 1;
      response.writeHead(range ? 206 : 200, {
        ...common,
        "content-length": Math.max(0, end - start + 1),
        ...(range
          ? { "content-range": `bytes ${start}-${end}/${info.size}` }
          : {}),
      });
      if (request.method === "HEAD" || info.size === 0) {
        response.end();
        return;
      }
      await pipeline(
        file.createReadStream({ autoClose: false, start, end, signal }),
        response,
        { signal },
      );
    } finally {
      await file.close();
    }
  }
  async function remoteMedia(
    input: string,
    request: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) {
    const h = headers(ctx.options);
    if (
      typeof request.headers.range === "string" &&
      /^bytes=(?:\d+-\d*|-\d+)$/.test(request.headers.range)
    )
      h.set("range", request.headers.range);
    if (typeof request.headers["if-range"] === "string")
      h.set("if-range", request.headers["if-range"]);
    const upstream = await fetchAudioStream(input, {
      fetchImpl: safeFetch,
      headers: h,
      signal,
      maxBytes: ctx.config.maxBytes,
    });
    const encoding = upstream.headers.get("content-encoding");
    if (encoding && encoding !== "identity") {
      await upstream.body?.cancel();
      throw new CliError("encoding", "Unsupported transfer encoding.");
    }
    const values: Record<string, string> = { "cache-control": "no-store" };
    for (const key of [
      "content-type",
      "content-length",
      "content-range",
      "etag",
      "accept-ranges",
    ]) {
      const value = upstream.headers.get(key);
      if (value !== null) values[key] = value;
    }
    if (upstream.status === 206) {
      const r = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
        values["content-range"] ?? "",
      );
      const wanted = r ? parseByteRange(h.get("range"), Number(r[3])) : null;
      if (
        !r ||
        !wanted ||
        wanted.start !== Number(r[1]) ||
        wanted.end !== Number(r[2]) ||
        Number(r[3]) > ctx.config.maxBytes ||
        Number(r[3]) <= Number(r[2])
      ) {
        await upstream.body?.cancel();
        throw new CliError("range", "Invalid remote byte range.");
      }
    }
    response.writeHead(upstream.status, values);
    if (request.method === "HEAD") {
      await upstream.body?.cancel();
      response.end();
    } else
      await pipeline(
        Readable.fromWeb(upstream.body! as NodeReadableStream),
        response,
        { signal },
      );
  }
  async function handle(request: IncomingMessage, response: ServerResponse) {
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("referrer-policy", "no-referrer");
    response.setHeader(
      "content-security-policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    if (
      closing ||
      request.headers.host !== new URL(origin).host ||
      (request.headers.origin && request.headers.origin !== origin) ||
      request.headers["sec-fetch-site"] === "cross-site"
    ) {
      json(response, { error: "forbidden" }, 403);
      return;
    }
    const path = new URL(request.url ?? "/", origin).pathname;
    const supplied = request.headers["x-bragi-session"];
    const cookie =
      request.headers.cookie
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith(`${cookieName}=`))
        ?.slice(cookieName.length + 1) ?? "";
    const authenticated =
      typeof supplied === "string" && equal(supplied, token);
    if (path === "/" || path === "/browser.js") {
      if (request.method !== "GET") {
        json(response, { error: "method" }, 405);
        return;
      }
      response.writeHead(200, {
        "content-type":
          path === "/" ? "text/html; charset=utf-8" : "text/javascript",
        "cache-control": "no-store",
      });
      response.end(
        await readFile(
          new URL(
            path === "/" ? "index.html" : "browser.js",
            options.assets ?? assets,
          ),
        ),
      );
      return;
    }
    if (path.startsWith("/media/")) {
      if (
        !equal(cookie, token) ||
        !["GET", "HEAD"].includes(request.method ?? "")
      ) {
        json(response, { error: "forbidden" }, 403);
        return;
      }
      const input = sources.get(path.slice(7));
      if (!input) {
        json(response, { error: "not_found" }, 404);
        return;
      }
      const controller = new AbortController();
      operations.add(controller);
      const signal = AbortSignal.any([
        controller.signal,
        ctx.signal,
        AbortSignal.timeout(ctx.config.timeout),
      ]);
      const abort = () => controller.abort();
      response.once("close", abort);
      try {
        if (/^https?:/.test(input))
          await remoteMedia(input, request, response, signal);
        else await localMedia(input, request, response, signal);
      } finally {
        response.off("close", abort);
        operations.delete(controller);
      }
      return;
    }
    if (!authenticated) {
      json(response, { error: "forbidden" }, 403);
      return;
    }
    if (path === "/api/session" && request.method === "POST") {
      response.setHeader(
        "set-cookie",
        `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`,
      );
      json(response, {
        schemaVersion: 1,
        mode: options.mode ?? "play",
        tracks,
        index,
        maxBytes: ctx.config.maxBytes,
        maxPcmBytes: ctx.config.maxPcmBytes,
        bitDepth: options.encoding ?? 16,
        gainDb: options.gainDb ?? 0,
      });
      return;
    }
    if (path === "/api/events" && request.method === "GET") {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
      });
      clients.add(response);
      response.write(`data: ${JSON.stringify(state())}\n\n`);
      const timer = setInterval(() => response.write(": keepalive\n\n"), 15000);
      response.on("close", () => {
        clearInterval(timer);
        clients.delete(response);
      });
      return;
    }
    if (path.startsWith("/api/track/") && request.method === "GET") {
      const id = path.slice(11),
        input = sources.get(id),
        track = tracks.find((t) => t.id === id);
      if (!input || !track) {
        json(response, { error: "not_found" }, 404);
        return;
      }
      let pending = metadata.get(id);
      if (!pending) {
        pending = inspectionTail
          .then(() => {
            ctx.signal.throwIfAborted();
            return inspectOne(input, {
              ...ctx,
              options: { ...ctx.options, artwork: undefined },
            });
          })
          .then(
            (analysis) => ({
              ...track,
              title: analysis.tags.title ?? track.title,
              artists: [...analysis.tags.artists],
              duration: analysis.format.durationSeconds,
              codec: analysis.format.codec,
            }),
            () => track,
          );
        inspectionTail = pending.then(() => undefined);
        metadata.set(id, pending);
      }
      json(response, await pending);
      return;
    }
    if (path === "/api/control" && request.method === "POST") {
      const value: unknown = JSON.parse((await body(request, 4096)).toString());
      if (
        !value ||
        typeof value !== "object" ||
        !("action" in value) ||
        typeof value.action !== "string" ||
        ![
          "next",
          "previous",
          "play",
          "pause",
          "toggle",
          "seek",
          "volume",
          "volume-step",
          "stop",
          "ended",
        ].includes(value.action)
      ) {
        json(response, { error: "invalid_control" }, 400);
        return;
      }
      const number = "value" in value ? value.value : undefined;
      if (
        number !== undefined &&
        (typeof number !== "number" ||
          !Number.isFinite(number) ||
          Math.abs(number) > 86400)
      ) {
        json(response, { error: "invalid_value" }, 400);
        return;
      }
      control(value.action, number as number | undefined);
      json(response, { ok: true });
      return;
    }
    if (path === "/api/state" && request.method === "POST") {
      const value: unknown = JSON.parse((await body(request, 4096)).toString());
      if (value && typeof value === "object") {
        const raw = value as Record<string, unknown>;
        const safe: Record<string, unknown> = {};
        for (const key of ["position", "duration", "paused"])
          if (
            typeof raw[key] === "boolean" ||
            (typeof raw[key] === "number" && Number.isFinite(raw[key]))
          )
            safe[key] = raw[key];
        options.onState?.(safe);
      }
      json(response, { ok: true });
      return;
    }
    if (
      path === "/api/output" &&
      request.method === "POST" &&
      options.mode === "convert"
    ) {
      if (!ctx.options.output) {
        json(response, { error: "output_required" }, 400);
        return;
      }
      const bytes = await body(request, ctx.config.maxBytes);
      const pcm = decodeWav(bytes, {
        maxBytes: ctx.config.maxBytes,
        maxPcmBytes: ctx.config.maxPcmBytes,
      });
      const canonical = encodeWav(pcm, {
        bitDepth: options.encoding ?? 16,
        maxBytes: ctx.config.maxBytes,
      });
      await writeAtomic(ctx.options.output, canonical, ctx.options.force);
      json(response, {
        ok: true,
        sampleRate: pcm.sampleRate,
        channels: pcm.channels.length,
      });
      options.onComplete?.(ctx.options.output);
      return;
    }
    json(response, { error: "not_found" }, 404);
  }
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Unable to bind");
  origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    token,
    url: `${origin}/#${token}`,
    control,
    async close() {
      if (closing) return;
      closing = true;
      shutdown.abort();
      for (const operation of operations) operation.abort();
      for (const client of clients) client.end();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
// Installed asset paths always resolve beside this module, never from the user's cwd.
export const companionAssetsDirectory = fileURLToPath(assets);
