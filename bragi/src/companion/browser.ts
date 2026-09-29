import {
  AudioEngine,
  StreamLoader,
  StreamPreloader,
  setupMediaSessionHandlers,
  updateMediaMetadata,
  updatePlaybackState,
  updatePositionState,
  assessPlayback,
  replayGainToLinear,
} from "bragi-audio/player";
import { decodeAudio, encodeWav } from "bragi-audio/audio";
interface Track {
  id: string;
  entryId: string;
  title: string;
  artists: string[];
  duration?: number;
  codec?: string;
}
interface Session {
  tracks: Track[];
  index: number;
  mode: string;
  maxBytes: number;
  maxPcmBytes: number;
  bitDepth: 16 | 24 | 32;
  gainDb: number;
}
function element<T extends HTMLElement>(id: string): T {
  const item = document.getElementById(id);
  if (!item) throw new Error("Missing control");
  return item as T;
}
const status = element("status");
const playButton = element<HTMLButtonElement>("play");
const seek = element<HTMLInputElement>("seek");
const volume = element<HTMLInputElement>("volume");
const token = location.hash.slice(1);
history.replaceState(null, "", "/");
const lifetime = new AbortController();
let pending = new AbortController();
let engine: AudioEngine | undefined;
let session: Session;
let current: Track | undefined;
let index = 0;
let generation = 0;
let unlocked = false;
let closed = false;
let timer: ReturnType<typeof setInterval> | undefined;
function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-bragi-session", token);
  return fetch(path, {
    ...init,
    headers,
    signal: init.signal ?? lifetime.signal,
  });
}
async function command(action: string, value?: number): Promise<void> {
  const response = await api("/api/control", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, value }),
  });
  if (!response.ok) throw new Error("Control rejected");
}
function guard(operation: Promise<unknown>): void {
  void operation.catch(() => {
    if (!closed)
      status.textContent =
        "Connection or audio operation failed. Check the terminal and retry.";
  });
}
function parseTrack(value: unknown): Track | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== "string" ||
    !/^[a-f\d-]{36}$/.test(v.id) ||
    typeof v.entryId !== "string" ||
    typeof v.title !== "string" ||
    !Array.isArray(v.artists) ||
    !v.artists.every((a) => typeof a === "string")
  )
    return null;
  return {
    id: v.id,
    entryId: v.entryId,
    title: v.title,
    artists: v.artists as string[],
    duration:
      typeof v.duration === "number" && Number.isFinite(v.duration)
        ? v.duration
        : undefined,
    codec: typeof v.codec === "string" ? v.codec : undefined,
  };
}
const loader = new StreamLoader<Track>({
  url: (id) => `/api/track/${id}`,
  parse: parseTrack,
  fetch: (url, init) => api(String(url), init),
});
const preloader = new StreamPreloader<Track>({
  maxEntries: 2,
  load: async (id) => {
    const result = await loader.load(id, lifetime.signal);
    return result.ok ? result.data : null;
  },
});
function time(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
function renderPosition() {
  if (!engine) return;
  element("time").textContent =
    `${time(engine.currentTime)} / ${time(engine.duration)}`;
  seek.max = String(
    Number.isFinite(engine.duration) && engine.duration > 0
      ? engine.duration
      : 1,
  );
  seek.value = String(engine.currentTime);
  updatePositionState({
    duration: engine.duration,
    position: engine.currentTime,
  });
}
function applyVolume() {
  engine?.applyVolume({
    level: Number(volume.value) * replayGainToLinear(session.gainDb),
    muted: false,
    allowWebAudio: unlocked,
  });
}
async function load(next: number) {
  const track = session.tracks[next];
  if (!track || (current?.entryId === track.entryId && index === next)) return;
  index = next;
  const version = ++generation;
  pending.abort();
  pending = new AbortController();
  engine?.unload();
  current = track;
  element("title").textContent = track.title;
  element("artist").textContent = "";
  status.textContent = unlocked ? "Loading…" : "Click Play to start audio.";
  for (const [n, item] of [...element("queue").children].entries())
    item.classList.toggle("current", n === index);
  // Load media promptly; metadata inspection runs separately and never blocks a Play gesture.
  engine?.load(`/media/${track.id}`);
  if (unlocked) {
    applyVolume();
    if (!(await engine?.play()))
      status.textContent = "Click Play to unlock audio in this browser.";
  }
  const cached = await preloader.getOrAwait(track.id);
  const loaded = cached
    ? { ok: true as const, data: cached }
    : await loader.load(track.id, pending.signal);
  if (version !== generation || closed) return;
  if (loaded.ok) {
    current = loaded.data;
    const assessment = assessPlayback({
      expectedSeconds: current.duration,
      actualSeconds: engine?.duration,
      codecs: current.codec,
    });
    if (!assessment.ok)
      status.textContent = "Playback duration differs from the file metadata.";
    element("title").textContent = current.title;
    element("artist").textContent = current.artists.join(", ");
    updateMediaMetadata({
      title: current.title,
      artists: current.artists.map((name) => ({ name })),
    });
  }
  const upcoming = session.tracks[index + 1];
  if (upcoming) preloader.preload(upcoming.id);
}
async function startPlaying() {
  unlocked = true;
  engine?.resume();
  applyVolume();
  if (!(await engine?.play()))
    status.textContent =
      "This browser could not play the audio. Try another supported file or browser.";
}
function close() {
  if (closed) return;
  closed = true;
  pending.abort();
  lifetime.abort();
  if (timer) clearInterval(timer);
  preloader.clear();
  engine?.destroy();
  updateMediaMetadata(null);
  updatePlaybackState(false);
  if ("mediaSession" in navigator)
    for (const action of [
      "play",
      "pause",
      "nexttrack",
      "previoustrack",
      "seekbackward",
      "seekforward",
      "seekto",
      "stop",
    ] as MediaSessionAction[]) {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch {
        /* Unsupported OS control. */
      }
    }
  status.textContent = "Session stopped. You can close this window.";
  playButton.disabled = true;
}
async function events() {
  const response = await api("/api/events");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing event stream");
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!closed) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (!block.startsWith("data: ")) continue;
        const event = JSON.parse(block.slice(6)) as {
          type: string;
          index?: number;
          value?: number;
        };
        if (event.type === "load") guard(load(event.index ?? 0));
        else if (event.type === "stop") close();
        else if (event.type === "pause") engine?.pause();
        else if (event.type === "toggle") {
          if (engine?.paused) guard(startPlaying());
          else engine?.pause();
        } else if (event.type === "play") guard(startPlaying());
        else if (event.type === "seek")
          engine?.seek(
            Math.max(0, (engine?.currentTime ?? 0) + (event.value ?? 0)),
          );
        else if (event.type === "volume" || event.type === "volume-step") {
          volume.value = String(
            Math.min(
              1,
              Math.max(
                0,
                (event.type === "volume" ? 0 : Number(volume.value)) +
                  (event.value ?? 0),
              ),
            ),
          );
          applyVolume();
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
    close();
  }
}
async function convert() {
  const button = element<HTMLButtonElement>("convert-button");
  button.disabled = true;
  let context: OfflineAudioContext | undefined;
  try {
    status.textContent = "Reading bounded input…";
    const response = await fetch(`/media/${session.tracks[0]!.id}`, {
      signal: lifetime.signal,
    });
    if (!response.ok) throw new Error();
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const item = await reader.read();
        if (item.done) break;
        length += item.value.length;
        if (length > session.maxBytes) throw new Error();
        chunks.push(item.value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    status.textContent = "Decoding in this browser…";
    context = new OfflineAudioContext(2, 1, 48000);
    const audio = await decodeAudio(bytes, {
      context,
      maxInputBytes: session.maxBytes,
      signal: lifetime.signal,
    });
    if (
      audio.numberOfChannels < 1 ||
      audio.numberOfChannels > 2 ||
      audio.length * audio.numberOfChannels * 4 > session.maxPcmBytes
    )
      throw new Error();
    const wav = encodeWav(
      {
        sampleRate: audio.sampleRate,
        channels: Array.from({ length: audio.numberOfChannels }, (_, ch) =>
          audio.getChannelData(ch),
        ),
      },
      { bitDepth: session.bitDepth, maxBytes: session.maxBytes },
    );
    const saved = await api("/api/output", {
      method: "POST",
      headers: { "content-type": "audio/wav" },
      body: wav,
    });
    if (!saved.ok) throw new Error();
    status.textContent = `Saved WAV: ${audio.sampleRate} Hz, ${audio.numberOfChannels} channels. Tags and artwork were omitted.`;
  } catch {
    status.textContent =
      "Conversion failed. This browser may not support the codec, or the input / PCM / output exceeded its limit. Check the terminal output path.";
    button.disabled = false;
  }
}
async function main() {
  if (!token) {
    status.textContent = "Open the complete companion link printed by bragi.";
    return;
  }
  const response = await api("/api/session", { method: "POST" });
  if (!response.ok) throw new Error();
  session = (await response.json()) as Session;
  if (session.mode === "convert") {
    element("player").style.display = "none";
    element("convert").style.display = "block";
    element("title").textContent = session.tracks[0]!.title;
    status.textContent = "Ready to convert. Output sample rate is 48000 Hz.";
    element("convert-button").onclick = () => guard(convert());
    return;
  }
  engine = new AudioEngine({
    onTimeUpdate: renderPosition,
    onDuration: (duration) => {
      renderPosition();
      const assessment = assessPlayback({
        expectedSeconds: current?.duration,
        actualSeconds: duration,
        codecs: current?.codec,
      });
      if (!assessment.ok)
        status.textContent =
          "Playback duration differs from the file metadata.";
    },
    onPlay: () => {
      playButton.textContent = "Pause";
      updatePlaybackState(true);
      status.textContent = "Playing";
    },
    onPause: () => {
      playButton.textContent = "Play";
      updatePlaybackState(false);
    },
    onEnded: () => guard(command("ended")),
    onError: () => {
      status.textContent =
        "Audio could not be played. Check codec support and the terminal connection.";
    },
  });
  engine.init();
  playButton.onclick = () => {
    if (engine?.paused) guard(startPlaying());
    else engine?.pause();
  };
  element("previous").onclick = () => guard(command("previous"));
  element("next").onclick = () => guard(command("next"));
  element("stop").onclick = () => guard(command("stop"));
  seek.oninput = () => engine?.seek(Number(seek.value));
  volume.oninput = applyVolume;
  session.tracks.forEach((track, n) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.textContent = track.title;
    button.onclick = () => {
      const steps = n - index;
      const action = steps > 0 ? "next" : "previous";
      guard(
        (async () => {
          for (let count = 0; count < Math.abs(steps); count++)
            await command(action);
        })(),
      );
    };
    li.append(button);
    element("queue").append(li);
  });
  setupMediaSessionHandlers({
    onPlay: () => guard(startPlaying()),
    onPause: () => engine?.pause(),
    onPrevious: () => guard(command("previous")),
    onNext: () => guard(command("next")),
    onSeekBackward: (seconds) =>
      engine?.seek(Math.max(0, engine.currentTime - seconds)),
    onSeekForward: (seconds) => engine?.seek(engine.currentTime + seconds),
    onSeekTo: (position) => engine?.seek(position),
    onStop: () => guard(command("stop")),
  });
  timer = setInterval(() => {
    if (!engine || closed) return;
    guard(
      api("/api/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          position: engine.currentTime,
          duration: engine.duration,
          paused: engine.paused,
        }),
      }),
    );
  }, 1000);
  window.addEventListener("pagehide", close, { once: true });
  guard(load(session.index));
  guard(events());
}
guard(main());
