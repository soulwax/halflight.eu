import openBrowser from "open";
import { createCompanion } from "./companion/server.js";
import { assertOutput, CliError, clean, result, type Context } from "./core.js";
import { bitDepth } from "./wav.js";
export async function play(
  inputs: string[],
  ctx: Context,
  options: {
    open?: boolean;
    gainDb?: string;
    convert?: boolean;
    encoding?: string;
    backend?: string;
  },
): Promise<void> {
  if (options.backend && options.backend !== "browser")
    throw new CliError(
      "backend_unavailable",
      "The available backend is browser. Native adapters are not installed.",
      5,
    );
  const gainDb = Number(options.gainDb ?? 0);
  if (!Number.isFinite(gainDb) || gainDb < -30 || gainDb > 12)
    throw new CliError("usage", "Gain must be between -30 and 12 dB.", 2);
  if (options.convert) {
    if (!ctx.options.output || inputs.length !== 1)
      throw new CliError(
        "usage",
        "Browser conversion requires one input and --output PATH.",
        2,
      );
    await assertOutput(ctx.options.output, ctx.options.force);
  }
  let complete: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => {
    complete = resolve;
  });
  let conversionOutput: string | undefined;
  const boundedContext = options.convert
    ? {
        ...ctx,
        config: {
          ...ctx.config,
          maxBytes: Math.min(ctx.config.maxBytes, 32 * 1024 ** 2),
        },
      }
    : ctx;
  const companion = await createCompanion({
    inputs,
    context: boundedContext,
    mode: options.convert ? "convert" : "play",
    encoding: bitDepth(options.encoding ?? "pcm16"),
    gainDb,
    onComplete(output) {
      conversionOutput = output;
      complete();
    },
  });
  const abort = () => complete();
  ctx.signal.addEventListener("abort", abort, { once: true });
  const keyboard = (data: Buffer) => {
    const key = data.toString().toLowerCase();
    if (key === "q" || key === "\u0003") complete();
    else if (key === " ") companion.control("toggle");
    else if (key === "n") companion.control("next");
    else if (key === "p") companion.control("previous");
    else if (key === "\u001b[C") companion.control("seek", 10);
    else if (key === "\u001b[D") companion.control("seek", -10);
    else if (key === "+" || key === "=") companion.control("volume-step", 0.05);
    else if (key === "-") companion.control("volume-step", -0.05);
  };
  const raw = Boolean(
    process.stdin.isTTY && process.stderr.isTTY && !ctx.options.noInteractive,
  );
  const previousRaw = process.stdin.isRaw;
  try {
    // The fragment is an ephemeral local session capability, never a provider credential.
    result(
      ctx,
      "companion",
      {
        url: companion.url,
        mode: options.convert ? "convert" : "play",
        ...(options.convert ? { output: ctx.options.output } : {}),
      },
      `Open ${companion.url}\n${options.convert ? "Click Convert to WAV." : "Click Play to unlock audio. Space play/pause · N/P tracks · arrows seek · +/− volume · Q quit."}`,
    );
    if (options.open !== false)
      await openBrowser(companion.url).catch(() =>
        process.stderr.write(
          "Browser launch failed. Open the printed link manually.\n",
        ),
      );
    if (raw) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on("data", keyboard);
    }
    if (ctx.signal.aborted) complete();
    await finished;
    if (
      options.convert &&
      conversionOutput &&
      !ctx.options.json &&
      !ctx.options.jsonl &&
      ctx.config.display !== "json"
    )
      result(
        ctx,
        "output",
        { output: conversionOutput },
        `Saved ${clean(conversionOutput)}`,
      );
  } finally {
    ctx.signal.removeEventListener("abort", abort);
    if (raw) {
      process.stdin.off("data", keyboard);
      process.stdin.setRawMode(previousRaw ?? false);
      process.stdin.pause();
    }
    await companion.close();
  }
  if (ctx.signal.aborted)
    throw new CliError("aborted", "Session interrupted.", 130);
}
