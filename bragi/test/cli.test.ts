import { afterEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { encodeWav, decodeWav } from "bragi-audio/audio";
const exec = promisify(execFile);
const directories: string[] = [];
afterEach(async () => {
  for (const dir of directories.splice(0))
    await rm(dir, { recursive: true, force: true });
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "bragi-cli-"));
  directories.push(dir);
  const file = join(dir, "tone.wav");
  await writeFile(
    file,
    encodeWav({
      sampleRate: 48000,
      channels: [new Float32Array([0, 0.25, -0.25, 0])],
    }),
  );
  return { dir, file };
}
async function cli(args: string[], dir: string) {
  return exec(process.execPath, [resolve("dist/cli.js"), ...args], {
    cwd: dir,
    env: {
      ...process.env,
      BRAGI_CONFIG: join(dir, "config.json"),
      NO_COLOR: "1",
    },
  });
}
it("provides help, version and format discovery outside the checkout", async () => {
  const { dir } = await fixture();
  expect((await cli([], dir)).stdout).toContain("Usage: bragi");
  expect((await cli(["--version"], dir)).stdout.trim()).toBe("0.1.0");
  const result = JSON.parse((await cli(["formats", "--json"], dir)).stdout) as {
    data: { id: string }[];
  };
  expect(result.data.some((format) => format.id === "wav")).toBe(true);
});
it("inspects bytes in a worker and reports normalized metadata", async () => {
  const { dir, file } = await fixture();
  const output = await cli(["inspect", file, "--json"], dir);
  const parsed = JSON.parse(output.stdout) as {
    schemaVersion: number;
    data: { format: { id: string; sampleRate: number; channels: number } };
  };
  expect(parsed.schemaVersion).toBe(1);
  expect(parsed.data.format).toMatchObject({
    id: "wav",
    sampleRate: 48000,
    channels: 1,
  });
  expect(output.stderr).toBe("");
});
it("scans directories and keeps per-input errors in JSONL", async () => {
  const { dir } = await fixture();
  await writeFile(join(dir, "bad.wav"), "not audio");
  try {
    await cli(["inspect", dir, "--jsonl"], dir);
    throw new Error("Unexpected success");
  } catch (error) {
    const failure = error as { code: number; stdout: string };
    expect(failure.code).toBe(1);
    const lines = failure.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { ok: boolean });
    expect(lines.map((line) => line.ok)).toEqual([false, true]);
  }
});
it("creates preferences offline and can reset malformed preferences", async () => {
  const { dir } = await fixture();
  await cli(
    ["setup", "--yes", "--output-directory", join(dir, "exports"), "--json"],
    dir,
  );
  const prefs = JSON.parse(
    await readFile(join(dir, "config.json"), "utf8"),
  ) as { outputDirectory: string };
  expect(prefs.outputDirectory).toBe(join(dir, "exports"));
  expect((await cli(["doctor", "--json"], dir)).stdout).toContain(
    '"wavSelfTest":true',
  );
  await writeFile(join(dir, "config.json"), '{"version":99}');
  await expect(cli(["config", "show"], dir)).rejects.toMatchObject({ code: 4 });
  await cli(["config", "reset"], dir);
  expect((await cli(["config", "show", "--json"], dir)).stdout).toContain(
    '"version":1',
  );
});
it("round trips WAV to PCM and back while protecting output files", async () => {
  const { dir, file } = await fixture(),
    raw = join(dir, "samples.f32"),
    meta = join(dir, "samples.json"),
    wav = join(dir, "new.wav");
  await cli(["wav", "decode", file, "--output", raw, "--metadata", meta], dir);
  await cli(
    [
      "wav",
      "encode",
      raw,
      "--sample-rate",
      "48000",
      "--channels",
      "1",
      "--encoding",
      "float32",
      "--output",
      wav,
    ],
    dir,
  );
  expect(decodeWav(await readFile(wav)).channels[0]![1]).toBeCloseTo(0.25, 4);
  const original = await readFile(wav);
  await expect(
    cli(["wav", "convert", file, "--output", wav], dir),
  ).rejects.toMatchObject({ code: 4 });
  expect(await readFile(wav)).toEqual(original);
});
it("prints machine errors without raw input or private URLs", async () => {
  const { dir } = await fixture();
  await expect(
    cli(["inspect", "missing.wav", "--json"], dir),
  ).rejects.toMatchObject({
    code: 4,
    stdout: expect.stringContaining('"code":"filesystem"'),
  });
  await expect(
    cli(
      ["download", "https://user:private@example.test/secret", "--json"],
      dir,
    ),
  ).rejects.toMatchObject({
    code: 2,
    stdout: expect.not.stringContaining("user:private"),
  });
});
