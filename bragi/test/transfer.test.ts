import { afterEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transfer } from "../src/transfer.js";
import { defaults, type Context } from "../src/core.js";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
) {
  const dir = await mkdtemp(join(tmpdir(), "bragi-transfer-"));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error();
  const output = join(dir, "audio.bin");
  const ctx: Context = {
    options: { output, quiet: true },
    config: { ...defaults, maxBytes: 2048, timeout: 2000 },
    signal: new AbortController().signal,
  };
  return {
    output,
    ctx,
    url: `http://127.0.0.1:${address.port}/audio?private=secret`,
  };
}
it("streams unknown-length responses and enforces actual bytes", async () => {
  const f = await fixture((_req, res) => {
    res.write(Buffer.alloc(512, 3));
    res.end(Buffer.alloc(512, 4));
  });
  await transfer(f.url, f.ctx);
  expect((await readFile(f.output)).length).toBe(1024);
  const tooSmall = {
    ...f.ctx,
    options: { ...f.ctx.options, output: f.output + "2" },
    config: { ...f.ctx.config, maxBytes: 100 },
  };
  await expect(transfer(f.url, tooSmall)).rejects.toMatchObject({
    code: "size_limit",
  });
  await expect(stat(f.output + "2")).rejects.toMatchObject({ code: "ENOENT" });
});
it("resumes only a matching strong validator and never saves source secrets", async () => {
  const bytes = Buffer.alloc(1000, 7);
  const ranges: (string | undefined)[] = [];
  let count = 0;
  const f = await fixture((req, res) => {
    ranges.push(req.headers.range);
    if (++count === 1) {
      res.writeHead(200, { etag: '"v1"', "content-length": bytes.length });
      res.write(bytes.subarray(0, 200));
      setTimeout(() => res.destroy(), 80);
    } else {
      const start = Number(req.headers.range?.match(/\d+/)?.[0]);
      res.writeHead(206, {
        etag: '"v1"',
        "content-length": bytes.length - start,
        "content-range": `bytes ${start}-${bytes.length - 1}/${bytes.length}`,
      });
      res.end(bytes.subarray(start));
    }
  });
  f.ctx.options.resume = true;
  await expect(transfer(f.url, f.ctx)).rejects.toThrow();
  const journal = await readFile(f.output + ".bragi-part.json", "utf8");
  expect(journal).not.toContain("private");
  expect(journal).not.toContain("127.0.0.1");
  expect((await stat(f.output + ".bragi-part")).size).toBeGreaterThan(0);
  await transfer(f.url, f.ctx);
  expect(ranges[1]).toMatch(/^bytes=\d+-$/);
  expect(await readFile(f.output)).toEqual(bytes);
  await expect(stat(f.output + ".bragi-part.json")).rejects.toMatchObject({
    code: "ENOENT",
  });
});
it("restarts from zero if the server ignores a resume range", async () => {
  const bytes = Buffer.alloc(800, 8);
  let count = 0;
  const f = await fixture((_req, res) => {
    if (++count === 1) {
      res.writeHead(200, { etag: '"old"', "content-length": bytes.length });
      res.write(bytes.subarray(0, 100));
      setTimeout(() => res.destroy(), 80);
    } else {
      res.writeHead(200, { etag: '"new"', "content-length": bytes.length });
      res.end(bytes);
    }
  });
  f.ctx.options.resume = true;
  await expect(transfer(f.url, f.ctx)).rejects.toThrow();
  await transfer(f.url, f.ctx);
  expect(await readFile(f.output)).toEqual(bytes);
});
it("rejects inconsistent resume ranges and cannot treat a 416 as complete", async () => {
  let count = 0;
  const f = await fixture((_req, res) => {
    if (++count === 1) {
      res.writeHead(200, { etag: '"old"', "content-length": 1000 });
      res.write(Buffer.alloc(100));
      setTimeout(() => res.destroy(), 80);
    } else {
      res.writeHead(416, { "content-range": "bytes */100" });
      res.end();
    }
  });
  f.ctx.options.resume = true;
  await expect(transfer(f.url, f.ctx)).rejects.toThrow();
  await expect(transfer(f.url, f.ctx)).rejects.toThrow();
  await expect(stat(f.output)).rejects.toMatchObject({ code: "ENOENT" });
});
it("aborts stalled transfers and removes nonresumable partial files", async () => {
  const f = await fixture((_req, res) => {
    res.writeHead(200);
    res.write(Buffer.alloc(32));
  });
  const controller = new AbortController();
  f.ctx.signal = controller.signal;
  const pending = transfer(f.url, f.ctx);
  setTimeout(() => controller.abort(), 100);
  await expect(pending).rejects.toMatchObject({ code: "aborted", exit: 130 });
  await expect(stat(f.output + ".bragi-part")).rejects.toMatchObject({
    code: "ENOENT",
  });
});

it("does not retain weak-validator partials", async () => {
  const f = await fixture((_req, res) => {
    res.writeHead(200, { etag: 'W/"weak"', "content-length": 1000 });
    res.write(Buffer.alloc(100));
    setTimeout(() => res.destroy(), 80);
  });
  f.ctx.options.resume = true;
  await expect(transfer(f.url, f.ctx)).rejects.toThrow();
  await expect(stat(f.output + ".bragi-part")).rejects.toMatchObject({
    code: "ENOENT",
  });
});
it("rejects a changed validator in a 206 response", async () => {
  let count = 0;
  const f = await fixture((req, res) => {
    if (++count === 1) {
      res.writeHead(200, { etag: '"old"', "content-length": 1000 });
      res.write(Buffer.alloc(100));
      setTimeout(() => res.destroy(), 80);
    } else {
      const start = Number(req.headers.range?.match(/\d+/)?.[0]);
      res.writeHead(206, {
        etag: '"new"',
        "content-length": 1000 - start,
        "content-range": `bytes ${start}-999/1000`,
      });
      res.end(Buffer.alloc(1000 - start));
    }
  });
  f.ctx.options.resume = true;
  await expect(transfer(f.url, f.ctx)).rejects.toThrow();
  await expect(transfer(f.url, f.ctx)).rejects.toMatchObject({
    code: "resume",
  });
  await expect(stat(f.output)).rejects.toMatchObject({ code: "ENOENT" });
  expect((await stat(f.output + ".bragi-part")).size).toBeGreaterThan(0);
});

it("preserves an unrelated file at the reserved journal path", async () => {
  const f = await fixture((_req, res) => res.end("audio"));
  const { writeFile } = await import("node:fs/promises");
  await writeFile(f.output + ".bragi-part.json", "unrelated");
  await expect(transfer(f.url, f.ctx)).rejects.toMatchObject({
    code: "exists",
  });
  expect(await readFile(f.output + ".bragi-part.json", "utf8")).toBe(
    "unrelated",
  );
  f.ctx.options.resume = true;
  await expect(transfer(f.url, f.ctx)).rejects.toMatchObject({
    code: "resume",
  });
  expect(await readFile(f.output + ".bragi-part.json", "utf8")).toBe(
    "unrelated",
  );
});
