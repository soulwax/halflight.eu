import { test, expect } from "@playwright/test";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { encodeWav, decodeWav } from "bragi-audio/audio";
async function launch(
  args: string[],
  dir: string,
): Promise<{ child: ChildProcess; url: string }> {
  const child = spawn(
    process.execPath,
    [resolve("dist/cli.js"), ...args, "--no-open", "--json"],
    {
      cwd: dir,
      env: { ...process.env, BRAGI_CONFIG: join(dir, "config.json") },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const lines = createInterface({ input: child.stdout! });
  let stderr = "";
  child.stderr!.on("data", (chunk) => {
    stderr += String(chunk);
  });
  try {
    const url = await new Promise<string>((resolveUrl, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`CLI did not start: ${stderr}`)),
        10000,
      );
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`CLI exited ${code}: ${stderr}`));
      });
      lines.once("line", (line) => {
        clearTimeout(timer);
        try {
          const result = JSON.parse(line) as { data: { url: string } };
          resolveUrl(result.data.url);
        } catch (error) {
          reject(error);
        }
      });
    });
    return { child, url };
  } catch (error) {
    child.kill();
    throw error;
  } finally {
    lines.close();
  }
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await exited;
}
test("plays, pauses, seeks and advances duplicate tracks in the real companion", async ({
  page,
}) => {
  const dir = await mkdtemp(join(tmpdir(), "bragi-browser-")),
    file = join(dir, "tone.wav");
  const samples = Float32Array.from(
    { length: 48000 * 20 },
    (_, index) => Math.sin(index / 80) * 0.01,
  );
  await writeFile(file, encodeWav({ sampleRate: 48000, channels: [samples] }));
  const { child, url } = await launch(["play", file, file], dir);
  try {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "tone.wav" })).toBeVisible();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#time")).not.toHaveText("0:00 / 0:00");
    await expect
      .poll(() => page.evaluate(() => navigator.mediaSession.metadata?.title))
      .toBe("tone.wav");
    await page.locator("#seek").evaluate((input: HTMLInputElement) => {
      input.value = "5";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(page.locator("#time")).toContainText("0:05");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Play", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator("#queue li").nth(1)).toHaveClass("current");
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(page.locator("#queue li").nth(0)).toHaveClass("current");
    await page.getByRole("button", { name: "Stop session" }).click();
    await expect(page.locator("#status")).toContainText("Session stopped");
  } finally {
    await stop(child);
    await rm(dir, { recursive: true, force: true });
  }
});
test("decodes and saves a browser WAV with the actual output sample rate", async ({
  page,
}) => {
  const dir = await mkdtemp(join(tmpdir(), "bragi-convert-")),
    file = join(dir, "tone.wav"),
    output = join(dir, "converted.wav");
  await writeFile(
    file,
    encodeWav({ sampleRate: 44100, channels: [new Float32Array(4410)] }),
  );
  const { child, url } = await launch(
    ["convert", file, "--backend", "browser", "--output", output],
    dir,
  );
  try {
    await page.goto(url);
    await page.getByRole("button", { name: "Convert to WAV" }).click();
    await expect(page.locator("#status")).toContainText("Saved WAV: 48000 Hz");
    const decoded = decodeWav(await readFile(output));
    expect(decoded.sampleRate).toBe(48000);
    expect(decoded.channels.length).toBe(1);
    expect(decoded.channels[0]!.length).toBeGreaterThan(0);
  } finally {
    await stop(child);
    await rm(dir, { recursive: true, force: true });
  }
});
