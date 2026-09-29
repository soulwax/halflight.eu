import { dirname, resolve } from "node:path";
import {
  createQueueEntries,
  isQueueEntryId,
  rebaseQueue,
  type QueueEntry,
  type QueueCommand,
} from "bragi-audio/player";
import {
  CliError,
  readBounded,
  writeAtomic,
  result,
  clean,
  type Context,
} from "./core.js";
export interface Track {
  id: string;
  source: string;
  title: string;
}
export interface Playlist {
  version: 1;
  entries: QueueEntry<Track>[];
}
export function tracks(
  inputs: string[],
  base = process.cwd(),
): QueueEntry<Track>[] {
  if (inputs.length > 1000)
    throw new CliError("queue_limit", "Queues support at most 1,000 entries.");
  return createQueueEntries(
    inputs.map((input) => {
      if (/^[a-z]+:/i.test(input) && !/^[a-z]:[\\/]/i.test(input))
        throw new CliError(
          "queue_source",
          "Saved queues accept local paths only. Pass remote URLs directly to play or use --url-env.",
        );
      const path = resolve(base, input);
      return {
        id: path,
        source: path,
        title: clean(path.split(/[\\/]/).at(-1) ?? "Audio"),
      };
    }),
  );
}
export async function readQueue(path: string): Promise<Playlist> {
  const bytes = await readBounded(path, 1024 ** 2, AbortSignal.timeout(5000));
  if (bytes.byteLength > 1024 ** 2)
    throw new CliError("queue_limit", "Queue file exceeds 1MiB.");
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new CliError("queue", "Invalid queue JSON.");
  }
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("entries" in value) ||
    !Array.isArray(value.entries) ||
    value.entries.length > 1000
  )
    throw new CliError("queue", "Unsupported queue schema.");
  const entries: QueueEntry<Track>[] = [],
    ids = new Set<string>();
  for (const raw of value.entries as unknown[]) {
    if (
      !raw ||
      typeof raw !== "object" ||
      !("entryId" in raw) ||
      !isQueueEntryId(raw.entryId) ||
      ids.has(raw.entryId) ||
      !("source" in raw) ||
      typeof raw.source !== "string"
    )
      throw new CliError("queue", "Invalid or duplicate queue entry ID.");
    ids.add(raw.entryId);
    const track = tracks([raw.source], dirname(resolve(path)))[0]!;
    entries.push({ ...track, entryId: raw.entryId });
  }
  return { version: 1, entries };
}
export async function queueCommand(
  kind: string,
  path: string,
  inputs: string[],
  ctx: Context,
  index?: number,
  to?: number,
): Promise<void> {
  let playlist: Playlist =
    kind === "create"
      ? { version: 1, entries: tracks(inputs) }
      : await readQueue(path);
  if (kind === "list") {
    result(
      ctx,
      "queue",
      playlist,
      playlist.entries
        .map((entry, n) => `${n + 1}. ${entry.title} (${entry.entryId})`)
        .join("\n") || "Queue is empty.",
    );
    return;
  }
  if (kind !== "create") {
    let command: QueueCommand<Track>;
    if (kind === "add") {
      if (playlist.entries.length + inputs.length > 1000)
        throw new CliError("queue_limit", "Queue exceeds 1,000 entries.");
      command = { type: "append", entries: tracks(inputs) };
    } else {
      if (!Number.isInteger(index) || !playlist.entries[index! - 1])
        throw new CliError(
          "usage",
          "Entry index must be within the queue (starting at 1).",
          2,
        );
      const entryId = playlist.entries[index! - 1]!.entryId;
      if (kind === "remove") command = { type: "remove", entryId };
      else {
        if (!Number.isInteger(to) || !playlist.entries[to! - 1])
          throw new CliError(
            "usage",
            "Destination index must be within the queue.",
            2,
          );
        const remaining = playlist.entries.filter(
          (entry) => entry.entryId !== entryId,
        );
        command = {
          type: "move",
          entryId,
          beforeEntryId: remaining[to! - 1]?.entryId,
        };
      }
    }
    playlist = {
      version: 1,
      entries: rebaseQueue(playlist.entries, [command], 1000),
    };
  }
  await writeAtomic(
    path,
    JSON.stringify(playlist, null, 2) + "\n",
    kind === "create" ? ctx.options.force : true,
  );
  result(ctx, "queue", {
    output: resolve(path),
    count: playlist.entries.length,
  });
}
