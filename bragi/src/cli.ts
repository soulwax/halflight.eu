#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  configPath,
  context,
  source,
  safeError,
  CliError,
  defaults,
  type Context,
  type Options,
} from "./core.js";
import { inspectInputs, formats, discover } from "./inspect.js";
import { transfer } from "./transfer.js";
import { wavCommand } from "./wav.js";
import { queueCommand, readQueue } from "./queue.js";
import { doctor, runWizard, configCommand, terminalPrompts } from "./setup.js";
import { play } from "./play.js";
const lifetime = new AbortController();
process.on("SIGINT", () => lifetime.abort());
process.on("SIGTERM", () => lifetime.abort());
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") {
    lifetime.abort();
    process.exitCode = 0;
  }
});
const program = new Command()
  .name("bragi")
  .description(
    "Inspect, download, convert and play your audio with bragi-audio.",
  )
  .version("0.1.0")
  .option("--json", "Print one versioned JSON result")
  .option("--jsonl", "Print one versioned result per inspected input")
  .option("--quiet", "Suppress summaries and progress")
  .option("--no-interactive", "Disable prompts and terminal controls")
  .option(
    "--max-bytes <size>",
    "Input, transfer and encoded output limit (default 128MiB)",
  )
  .option("--max-pcm-bytes <size>", "Decoded PCM limit (default 128MiB)")
  .option(
    "--timeout <milliseconds>",
    "Network and inspection deadline (default 30000)",
  )
  .option(
    "--force",
    "Replace an existing output or allow binary terminal output",
  )
  .configureOutput({ writeErr: () => undefined })
  .exitOverride()
  .addHelpText(
    "after",
    "\nExamples:\n  bragi setup\n  bragi inspect ./Music --recursive --jsonl\n  bragi play ./track.flac\n  bragi download --url-env BRAGI_MEDIA_URL --output track.flac --resume\n  bragi wav convert track.wav --encoding pcm24 --output converted.wav\n\nPrivate URLs: use --url-env NAME. Headers: --headers-env NAME (JSON string map).\nNo account or native player is required. Downloads accept permitted HTTP(S) sources.",
  );
function opts(command: Command): Options {
  const v = command.optsWithGlobals();
  if (v.json && v.jsonl)
    throw new CliError("usage", "Use either --json or --jsonl.", 2);
  return { ...v, noInteractive: v.interactive === false } as Options;
}
async function ctx(command: Command): Promise<Context> {
  return context(opts(command), lifetime.signal);
}
function remote(command: Command): Command {
  return command
    .option(
      "--url-env <name>",
      "Read a private HTTP(S) URL from this environment variable",
    )
    .option(
      "--headers-env <name>",
      "Read request headers from this JSON environment variable",
    );
}
function output(command: Command): Command {
  return command
    .option("--output <path>", "Save to this path (existing files protected)")
    .option("--stdout", "Write binary bytes to stdout");
}
program
  .command("setup")
  .description("Configure Bragi with a friendly setup wizard")
  .option("--yes", "Save defaults without prompts")
  .option(
    "--output-directory <path>",
    "Default directory for interactive output prompts",
  )
  .action(async (_options, command: Command) => {
    const c = await ctx(command);
    await runWizard(c, command.opts());
  });
program
  .command("doctor")
  .description("Check configuration, runtime and the WAV codec offline")
  .action(async (_options, command: Command) => doctor(await ctx(command)));
program
  .command("formats")
  .description("List audio formats recognized by bragi-audio")
  .action(async (_options, command: Command) => formats(await ctx(command)));
remote(
  program
    .command("inspect [inputs...]")
    .description(
      "Inspect audio bytes, tags and technical metadata (use - for stdin)",
    )
    .option("--recursive", "Scan subdirectories, up to 1,000 supported files")
    .option("--strict", "Reject filename / detected format mismatches")
    .option(
      "--artwork <directory>",
      "Export bounded artwork (up to 4 items, 8MiB total per file)",
    ),
).action(async (inputs: string[], _options, command: Command) => {
  const c = await ctx(command);
  const selected = c.options.urlEnv
    ? [source(undefined, c.options)]
    : inputs.map((input) => source(input, {}));
  if (!selected.length)
    throw new CliError("usage", "Supply an input or --url-env NAME.", 2);
  await inspectInputs(selected, c);
});
for (const kind of ["download", "stream"])
  remote(
    output(
      program
        .command(`${kind} [url]`)
        .description(
          kind === "download"
            ? "Download bounded audio with safe optional resume"
            : "Stream bounded audio to a file or explicit binary stdout",
        )
        .option("--resume", "Resume a .bragi-part with a matching strong ETag"),
    ),
  ).action(async (url: string | undefined, _options, command: Command) => {
    const c = await ctx(command);
    await transfer(source(url, c.options), c);
  });
const wav = program
  .command("wav")
  .description("Inspect, decode, encode and convert mono/stereo WAV / raw PCM");
for (const kind of ["inspect", "convert", "decode", "encode"]) {
  const cmd = wav.command(`${kind} <input>`).description(
    {
      inspect: "Validate WAV and show PCM properties",
      convert: "Change WAV bit depth without resampling or preserving tags",
      decode: "Export interleaved float32 little-endian raw PCM",
      encode: "Encode interleaved float32 little-endian PCM to WAV",
    }[kind]!,
  );
  if (kind !== "inspect") output(cmd);
  if (kind === "convert" || kind === "encode")
    cmd.option("--encoding <encoding>", "pcm16, pcm24 or float32", "pcm16");
  if (kind === "decode")
    cmd.option(
      "--metadata <path>",
      "Write a sidecar with PCM layout, sample rate and channels",
    );
  if (kind === "encode")
    cmd
      .requiredOption("--sample-rate <hz>", "PCM sample rate")
      .requiredOption("--channels <count>", "PCM channel count, 1 or 2");
  cmd.action(async (input: string, _options, command: Command) => {
    const c = await ctx(command);
    await wavCommand(kind, source(input, {}), c, command.opts());
  });
}
const queue = program
  .command("queue")
  .description("Create and edit local playlists; indexes start at 1");
for (const kind of ["create", "add", "list", "remove", "move"]) {
  const args =
    kind === "create" || kind === "add"
      ? "<file> [inputs...]"
      : kind === "list"
        ? "<file>"
        : kind === "remove"
          ? "<file> <index>"
          : "<file> <index> <destination>";
  queue
    .command(`${kind} ${args}`)
    .description(`${kind[0]!.toUpperCase()}${kind.slice(1)} queue entries`)
    .action(async (...args: unknown[]) => {
      const command = args.at(-1) as Command;
      const c = await ctx(command);
      await queueCommand(
        kind,
        String(args[0]),
        Array.isArray(args[1]) ? (args[1] as string[]) : [],
        c,
        Number(args[1]),
        Number(args[2]),
      );
    });
}
const config = program
  .command("config")
  .description("Show, locate or reset non-secret preferences");
for (const kind of ["show", "path", "reset"])
  config.command(kind).action(async (_options, command: Command) =>
    configCommand(
      kind,
      kind === "reset"
        ? {
            options: opts(command),
            config: { ...defaults },
            signal: lifetime.signal,
          }
        : await ctx(command),
    ),
  );
remote(
  program
    .command("play [inputs...]")
    .description("Play selected sources through the bundled browser companion")
    .option("--queue <path>", "Load a saved local queue")
    .option("--no-open", "Print the companion link without launching a browser")
    .option("--backend <backend>", "Playback backend (browser)", "browser")
    .option(
      "--gain-db <number>",
      "Explicit gain in dB (-30 to 12); positive gain can clip",
      "0",
    ),
).action(async (inputs: string[], _options, command: Command) => {
  const c = await ctx(command),
    extra = command.opts();
  let selected = inputs.map((input) => source(input, {}));
  if (extra.queue) {
    if (selected.length || c.options.urlEnv)
      throw new CliError(
        "usage",
        "Use either a saved queue or positional / environment sources.",
        2,
      );
    selected = (await readQueue(String(extra.queue))).entries.map(
      (entry) => entry.source,
    );
  } else if (c.options.urlEnv) selected.push(source(undefined, c.options));
  const expanded: string[] = [];
  for (const input of selected) expanded.push(...(await discover(input, true)));
  await play(expanded, c, extra);
});
remote(
  program
    .command("convert [input]")
    .description(
      "Decode a browser-supported codec into WAV using the companion",
    )
    .requiredOption("--output <path>", "Output WAV path")
    .requiredOption(
      "--backend <backend>",
      "Explicit decoding backend (browser)",
    )
    .option("--encoding <encoding>", "pcm16, pcm24 or float32", "pcm16")
    .option("--no-open", "Print the link without launching a browser"),
).action(async (input: string | undefined, _options, command: Command) => {
  const c = await ctx(command);
  await play([source(input, c.options)], c, {
    ...command.opts(),
    convert: true,
  });
});
program.action(async (_options, command: Command) => {
  if (
    !process.stdin.isTTY ||
    !process.stderr.isTTY ||
    command.opts().interactive === false
  ) {
    program.outputHelp();
    return;
  }
  let c = await ctx(command);
  const configured = await stat(configPath()).then(
    () => true,
    () => false,
  );
  if (!configured) {
    if (!(await runWizard(c, {}))) return;
    c = await ctx(command);
  }
  const action = await terminalPrompts.select("What would you like to do?", [
    { value: "play", label: "Listen to audio" },
    { value: "inspect", label: "Inspect a file or directory" },
    { value: "download", label: "Download a public HTTP(S) audio file" },
    { value: "wav", label: "Convert WAV bit depth" },
    { value: "setup", label: "Change preferences" },
    { value: "doctor", label: "Run diagnostics" },
  ]);
  if (action === null) return;
  if (action === "setup") {
    await runWizard(c, {});
    return;
  }
  if (action === "doctor") {
    await doctor(c);
    return;
  }
  const input = await terminalPrompts.text(
    action === "download"
      ? "Public audio URL (private sources: use download --url-env NAME)"
      : "Audio file or directory",
    "",
  );
  if (input === null) return;
  const selected = source(input, {});
  if (action === "play") await play(await discover(selected, true), c, {});
  else if (action === "inspect") await inspectInputs([selected], c);
  else {
    const path = await terminalPrompts.text(
      "Output path",
      resolve(
        c.config.outputDirectory,
        action === "wav" ? "converted.wav" : "download.audio",
      ),
    );
    if (path === null) return;
    const outputCtx = { ...c, options: { ...c.options, output: path } };
    if (action === "download") await transfer(selected, outputCtx);
    else {
      const encoding = await terminalPrompts.select("WAV encoding", [
        { value: "pcm16", label: "16-bit PCM" },
        { value: "pcm24", label: "24-bit PCM" },
        { value: "float32", label: "32-bit float" },
      ]);
      if (encoding !== null)
        await wavCommand("convert", selected, outputCtx, { encoding });
    }
  }
});
try {
  await program.parseAsync();
} catch (error) {
  if (
    error instanceof CommanderError &&
    (error.code === "commander.helpDisplayed" ||
      error.code === "commander.version")
  )
    process.exitCode = 0;
  else {
    const e =
      error instanceof CommanderError
        ? new CliError(
            "usage",
            "Invalid command. Run bragi --help for usage.",
            2,
          )
        : safeError(error);
    if (program.opts().json || program.opts().jsonl)
      process.stdout.write(
        JSON.stringify({
          schemaVersion: 1,
          ok: false,
          error: { code: e.code, message: e.message },
        }) + "\n",
      );
    else process.stderr.write(`bragi: ${e.message}\n`);
    process.exitCode = e.exit;
  }
}
