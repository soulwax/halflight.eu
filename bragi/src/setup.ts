import * as clack from "@clack/prompts";
import { access, stat, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { encodeWav, decodeWav } from "bragi-audio/audio";
import {
  configPath,
  loadPreferences,
  preferences,
  writeAtomic,
  result,
  CliError,
  clean,
  type Context,
  type Preferences,
} from "./core.js";

export interface WizardPrompts {
  text(message: string, initial: string): Promise<string | null>;
  select(
    message: string,
    options: { value: string; label: string }[],
  ): Promise<string | null>;
  confirm(message: string, initial?: boolean): Promise<boolean | null>;
}
export const terminalPrompts: WizardPrompts = {
  async text(message, initial) {
    const v = await clack.text({
      message,
      initialValue: initial,
      output: process.stderr,
    });
    return clack.isCancel(v) ? null : v;
  },
  async select(message, options) {
    const v = await clack.select({ message, options, output: process.stderr });
    return clack.isCancel(v) ? null : v;
  },
  async confirm(message, initial = true) {
    const v = await clack.confirm({
      message,
      initialValue: initial,
      output: process.stderr,
    });
    return clack.isCancel(v) ? null : v;
  },
};
async function writableDirectory(path: string): Promise<void> {
  let parent = resolve(path);
  for (;;) {
    try {
      const info = await stat(parent);
      if (!info.isDirectory())
        throw new CliError("output", "Output location must be a directory.", 4);
      await access(parent, constants.W_OK);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const next = dirname(parent);
      if (next === parent) throw error;
      parent = next;
    }
  }
}
export async function runWizard(
  ctx: Context,
  options: { yes?: boolean; outputDirectory?: string },
  prompts = terminalPrompts,
): Promise<boolean> {
  let next: Preferences = {
    ...ctx.config,
    outputDirectory: resolve(
      options.outputDirectory ?? ctx.config.outputDirectory,
    ),
  };
  if (!options.yes) {
    if (
      !process.stdin.isTTY ||
      !process.stderr.isTTY ||
      ctx.options.noInteractive
    )
      throw new CliError(
        "usage",
        "Interactive setup needs a terminal. Use setup --yes with optional --output-directory PATH.",
        2,
      );
    const purpose = await prompts.select("What would you like to do?", [
      { value: "both", label: "Listen, inspect and convert" },
      { value: "listen", label: "Listen" },
      { value: "tools", label: "Inspect and convert" },
    ]);
    if (purpose === null) return false;
    process.stderr.write(
      "Playback uses the bundled browser companion. A browser Play click unlocks audio; no native tools or account are required.\n",
    );
    const directory = await prompts.text(
      "Default output directory",
      next.outputDirectory,
    );
    if (directory === null) return false;
    const max = await prompts.text(
      "Input / transfer / encoded output limit (for example 128MiB)",
      `${next.maxBytes}B`,
    );
    if (max === null) return false;
    const pcm = await prompts.text(
      "Decoded PCM limit (buffers can use additional memory)",
      `${next.maxPcmBytes}B`,
    );
    if (pcm === null) return false;
    const timeout = await prompts.text(
      "Network and inspection timeout in milliseconds",
      String(next.timeout),
    );
    if (timeout === null) return false;
    const display = await prompts.select("Default output", [
      { value: "human", label: "Readable summaries" },
      { value: "json", label: "Versioned JSON" },
    ]);
    if (display === null) return false;
    const { size, positive } = await import("./core.js");
    next = preferences({
      ...next,
      outputDirectory: directory,
      maxBytes: size(max),
      maxPcmBytes: size(pcm),
      timeout: positive(timeout),
      display,
    });
    await writableDirectory(next.outputDirectory);
    process.stderr.write(
      `Save preferences to ${clean(configPath())}\n${JSON.stringify(next, null, 2)}\nNo credentials or source URLs are saved. Existing output files require --force.\n`,
    );
    if ((await prompts.confirm("Save these preferences?")) !== true)
      return false;
  }
  await writableDirectory(next.outputDirectory);
  await writeAtomic(configPath(), JSON.stringify(next, null, 2) + "\n", true);
  result(
    ctx,
    "setup",
    { path: configPath(), preferences: next },
    `Ready. Run bragi play FILE, bragi inspect FILE or bragi --help.\nPreferences: ${clean(configPath())}`,
  );
  return true;
}
export async function doctor(ctx: Context): Promise<void> {
  const pcm = {
    sampleRate: 48000,
    channels: [new Float32Array([0, 0.25, -0.25, 0])],
  };
  const decoded = decodeWav(encodeWav(pcm));
  const data = {
    node: process.versions.node,
    library: "bragi-audio@0.2.2",
    config: configPath(),
    configured: await stat(configPath()).then(
      () => true,
      () => false,
    ),
    wavSelfTest:
      decoded.channels[0]!.length === 4 && decoded.sampleRate === 48000,
    playback:
      "Bundled browser companion; codec support and audible output are checked in the browser.",
    nativeToolsRequired: false,
  };
  result(ctx, "doctor", data);
}
export async function configCommand(kind: string, ctx: Context): Promise<void> {
  if (kind === "reset") {
    await rm(configPath(), { force: true });
    result(ctx, "config", { reset: true });
  } else if (kind === "path")
    result(ctx, "config", { path: configPath() }, clean(configPath()));
  else result(ctx, "config", await loadPreferences());
}
