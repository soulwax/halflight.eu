import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import {
  defaults,
  size,
  preferences,
  source,
  headers,
  writeAtomic,
  safeFetch,
  type Context,
} from "../src/core.js";
import { bytesToPcm, pcmToBytes } from "../src/wav.js";
import { tracks, readQueue, queueCommand } from "../src/queue.js";
import { runWizard } from "../src/setup.js";
const paths: string[] = [];
afterEach(async () => {
  for (const path of paths.splice(0))
    await rm(path, { recursive: true, force: true });
});
async function temp() {
  const path = await mkdtemp(join(tmpdir(), "bragi-test-"));
  paths.push(path);
  return path;
}
const ctx = (options = {}): Context => ({
  options: { quiet: true, ...options },
  config: { ...defaults },
  signal: new AbortController().signal,
});
describe("limits and preferences", () => {
  it("accepts useful sizes and rejects ambiguous or unsafe values", () => {
    expect(size("128MiB")).toBe(134217728);
    expect(size("2MB")).toBe(2000000);
    for (const value of ["0", "-1", "2TB", "2GiB", "NaN", "1.2B"])
      expect(() => size(value)).toThrow();
  });
  it("rejects unknown config schemas", () => {
    expect(() => preferences({ ...defaults, version: 2 })).toThrow("schema");
    expect(preferences(defaults).maxBytes).toBe(defaults.maxBytes);
  });
  it("keeps credentials in environment references and reserves transport headers", () => {
    process.env.BRAGI_TEST_URL = "https://example.test/track?private=secret";
    process.env.BRAGI_TEST_HEADERS = '{"Authorization":"Bearer secret"}';
    expect(source(undefined, { urlEnv: "BRAGI_TEST_URL" })).toContain(
      "private=secret",
    );
    expect(
      headers({ headersEnv: "BRAGI_TEST_HEADERS" }).get("authorization"),
    ).toBe("Bearer secret");
    process.env.BRAGI_TEST_HEADERS = '{"Range":"bytes=0-"}';
    expect(() => headers({ headersEnv: "BRAGI_TEST_HEADERS" })).toThrow(
      "reserved",
    );
    expect(() => source("https://user:secret@example.test/a", {})).toThrow(
      "credentials",
    );
    delete process.env.BRAGI_TEST_HEADERS;
    delete process.env.BRAGI_TEST_URL;
  });
  it("refuses clobbering and atomically replaces only with force", async () => {
    const path = join(await temp(), "result");
    await writeAtomic(path, "first");
    await expect(writeAtomic(path, "second")).rejects.toThrow("exists");
    expect(await readFile(path, "utf8")).toBe("first");
    await writeAtomic(path, "second", true);
    expect(await readFile(path, "utf8")).toBe("second");
  });
  it("cancelling the wizard leaves preferences untouched", async () => {
    const c = ctx();
    const oldIn = process.stdin.isTTY,
      oldOut = process.stderr.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(process.stderr, "isTTY", {
      configurable: true,
      value: true,
    });
    try {
      expect(
        await runWizard(
          c,
          {},
          {
            async text() {
              return null;
            },
            async select() {
              return null;
            },
            async confirm() {
              return null;
            },
          },
        ),
      ).toBe(false);
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        configurable: true,
        value: oldIn,
      });
      Object.defineProperty(process.stderr, "isTTY", {
        configurable: true,
        value: oldOut,
      });
    }
  });
});
describe("PCM and queues", () => {
  it("round trips interleaved stereo PCM and rejects nonfinite or misaligned input", () => {
    const pcm = {
      sampleRate: 44100,
      channels: [new Float32Array([0.25, -0.5]), new Float32Array([0.75, 0])],
    };
    const bytes = pcmToBytes(pcm, 1024);
    expect(bytesToPcm(bytes, 44100, 2, 1024)).toEqual(pcm);
    expect(() => bytesToPcm(new Uint8Array(3), 44100, 1, 1024)).toThrow(
      "frame",
    );
    const nan = new Uint8Array(4);
    new DataView(nan.buffer).setFloat32(0, NaN, true);
    expect(() => bytesToPcm(nan, 44100, 1, 1024)).toThrow("finite");
    expect(() => pcmToBytes(pcm, 4)).toThrow("max-pcm-bytes");
  });
  it("preserves duplicate recordings with separate occurrence identities", async () => {
    const dir = await temp(),
      file = join(dir, "mix.bragi.json");
    await queueCommand("create", file, ["one.wav", "one.wav"], ctx());
    const initial = await readQueue(file);
    expect(initial.entries[0]!.entryId).not.toBe(initial.entries[1]!.entryId);
    await queueCommand("move", file, [], ctx(), 1, 2);
    expect((await readQueue(file)).entries[1]!.entryId).toBe(
      initial.entries[0]!.entryId,
    );
    await queueCommand("remove", file, [], ctx(), 1);
    expect((await readQueue(file)).entries).toHaveLength(1);
    expect(() => tracks(["https://example.test/a?secret=1"])).toThrow(
      "local paths",
    );
  });
  it("rejects duplicate IDs and resolves imported relative paths beside the playlist", async () => {
    const dir = await temp(),
      file = join(dir, "queue.json");
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        entries: [{ entryId: "one", source: "a.wav" }],
      }),
    );
    expect((await readQueue(file)).entries[0]!.source).toBe(join(dir, "a.wav"));
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        entries: [
          { entryId: "one", source: "a.wav" },
          { entryId: "one", source: "b.wav" },
        ],
      }),
    );
    await expect(readQueue(file)).rejects.toThrow("duplicate");
  });
});
it("does not forward private headers across redirect origins", async () => {
  let received = false;
  const target = createServer((_req, res) => {
    received = true;
    res.end("ok");
  });
  const redirect = createServer((_req, res) => {
    const address = target.address();
    if (!address || typeof address === "string") throw new Error();
    res.writeHead(302, { location: `http://127.0.0.1:${address.port}/` });
    res.end();
  });
  await new Promise<void>((resolve) => target.listen(0, "127.0.0.1", resolve));
  await new Promise<void>((resolve) =>
    redirect.listen(0, "127.0.0.1", resolve),
  );
  const address = redirect.address();
  if (!address || typeof address === "string") throw new Error();
  try {
    await expect(
      safeFetch(`http://127.0.0.1:${address.port}/`, {
        headers: { "X-Private-Key": "secret" },
      }),
    ).rejects.toThrow("private");
    expect(received).toBe(false);
    const publicResponse = await safeFetch(`http://127.0.0.1:${address.port}/`);
    expect(await publicResponse.text()).toBe("ok");
  } finally {
    redirect.closeAllConnections();
    target.closeAllConnections();
    await Promise.all([
      new Promise<void>((resolve) => redirect.close(() => resolve())),
      new Promise<void>((resolve) => target.close(() => resolve())),
    ]);
  }
});
