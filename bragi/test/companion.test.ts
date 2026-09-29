import { afterEach, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get } from "node:http";
import { encodeWav } from "bragi-audio/audio";
import { createCompanion, type Companion } from "../src/companion/server.js";
import { defaults } from "../src/core.js";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "bragi-companion-"));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "tone.wav");
  const bytes = encodeWav({
    sampleRate: 48000,
    channels: [new Float32Array(4800)],
  });
  await writeFile(file, bytes);
  const server = await createCompanion({
    inputs: [file, file],
    context: {
      config: { ...defaults },
      options: {},
      signal: new AbortController().signal,
    },
    assets: new URL("../dist/companion/", import.meta.url),
  });
  cleanups.push(() => server.close());
  return { server, bytes, file };
}
async function session(server: Companion) {
  const response = await fetch(server.origin + "/api/session", {
    method: "POST",
    headers: { "x-bragi-session": server.token, origin: server.origin },
  });
  const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
  const data = (await response.json()) as {
    tracks: { id: string; entryId: string }[];
  };
  return { cookie, data };
}
it("requires a session capability and blocks foreign Host, Origin and cross-site requests", async () => {
  const { server } = await fixture();
  expect(
    (await fetch(server.origin + "/api/session", { method: "POST" })).status,
  ).toBe(403);
  const foreignHost = await new Promise<number>((resolve) => {
    get(server.origin, { headers: { host: "evil.test" } }, (res) => {
      res.resume();
      resolve(res.statusCode!);
    });
  });
  expect(foreignHost).toBe(403);
  expect(
    (
      await fetch(server.origin + "/api/session", {
        method: "POST",
        headers: {
          "x-bragi-session": server.token,
          origin: "https://evil.test",
        },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await fetch(server.origin + "/", {
        headers: { "sec-fetch-site": "cross-site" },
      })
    ).status,
  ).toBe(403);
  expect((await fetch(server.origin + "/media/unknown")).status).toBe(403);
});
it("serves installed assets and opaque selected sources only", async () => {
  const { server, file } = await fixture();
  const response = await fetch(server.origin + "/");
  expect(await response.text()).toContain("Bragi");
  const bundle = await fetch(server.origin + "/browser.js");
  expect(bundle.headers.get("content-type")).toContain("javascript");
  const { cookie, data } = await session(server);
  expect(JSON.stringify(data)).not.toContain(file);
  expect(data.tracks[0]!.entryId).not.toBe(data.tracks[1]!.entryId);
  expect(
    (
      await fetch(server.origin + "/media/../../etc/passwd", {
        headers: { cookie },
      })
    ).status,
  ).toBe(403);
  expect(
    (await fetch(server.origin + "/media/unknown", { headers: { cookie } }))
      .status,
  ).toBe(404);
});
it("supports GET, HEAD, suffix ranges, 304 and unsatisfiable 416", async () => {
  const { server, bytes } = await fixture();
  const { cookie, data } = await session(server);
  const url = server.origin + "/media/" + data.tracks[0]!.id;
  const full = await fetch(url, { headers: { cookie } });
  const etag = full.headers.get("etag")!;
  expect(new Uint8Array(await full.arrayBuffer())).toEqual(bytes);
  expect(etag).toMatch(/^"[a-f\d]{64}"$/);
  const head = await fetch(url, { method: "HEAD", headers: { cookie } });
  expect(head.headers.get("content-length")).toBe(String(bytes.length));
  expect((await head.arrayBuffer()).byteLength).toBe(0);
  const part = await fetch(url, { headers: { cookie, range: "bytes=-12" } });
  expect(part.status).toBe(206);
  expect(new Uint8Array(await part.arrayBuffer())).toEqual(bytes.slice(-12));
  const invalid = await fetch(url, {
    headers: { cookie, range: `bytes=${bytes.length}-` },
  });
  expect(invalid.status).toBe(416);
  expect(invalid.headers.get("content-range")).toBe(`bytes */${bytes.length}`);
  expect(
    (await fetch(url, { headers: { cookie, "if-none-match": `W/${etag}` } }))
      .status,
  ).toBe(304);
});
it("ignores multipart / weak If-Range and changes ETag when bytes change", async () => {
  const { server, file } = await fixture();
  const { cookie, data } = await session(server);
  const url = server.origin + "/media/" + data.tracks[0]!.id;
  const initial = await fetch(url, { headers: { cookie } });
  const etag = initial.headers.get("etag")!;
  await initial.arrayBuffer();
  const multipart = await fetch(url, {
    headers: { cookie, range: "bytes=0-3,8-9" },
  });
  expect(multipart.status).toBe(200);
  await multipart.arrayBuffer();
  const weak = await fetch(url, {
    headers: { cookie, range: "bytes=0-3", "if-range": `W/${etag}` },
  });
  expect(weak.status).toBe(200);
  await weak.arrayBuffer();
  await writeFile(
    file,
    encodeWav({ sampleRate: 48000, channels: [new Float32Array([0.25, 0])] }),
  );
  const changed = await fetch(url, { headers: { cookie } });
  expect(changed.headers.get("etag")).not.toBe(etag);
  await changed.arrayBuffer();
});
it("closes all sockets and the listening port", async () => {
  const { server } = await fixture();
  await session(server);
  await server.close();
  await expect(fetch(server.origin)).rejects.toThrow();
});
