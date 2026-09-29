import { parentPort, workerData } from "node:worker_threads";
import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import { analyzeAudio, analyzeWebStream } from "bragi-audio";
import { safeError } from "../core.js";
interface Job {
  input: string;
  bytes?: Uint8Array;
  maxBytes: number;
  artwork: boolean;
  strict: boolean;
}
const job = workerData as Job;
try {
  const options = {
    maxFileBytes: job.maxBytes,
    includeArtwork: job.artwork,
    maxArtworkBytes: 8 * 1024 ** 2,
    maxArtworkCount: 4,
    strictHints: job.strict,
  };
  if (job.bytes)
    parentPort?.postMessage({
      ok: true,
      data: await analyzeAudio(job.bytes, {}, options),
    });
  else {
    const file = await open(job.input, "r");
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size > job.maxBytes)
        throw new Error("Invalid input");
      const stream = Readable.toWeb(
        file.createReadStream({ autoClose: false }),
      ) as ReadableStream<Uint8Array>;
      parentPort?.postMessage({
        ok: true,
        data: await analyzeWebStream(
          stream,
          { size: info.size, fileName: job.input },
          options,
        ),
      });
    } finally {
      await file.close();
    }
  }
} catch (error) {
  const e = safeError(error);
  parentPort?.postMessage({
    ok: false,
    code: e.code,
    message: e.message,
    exit: e.exit,
  });
}
