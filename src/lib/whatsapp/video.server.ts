import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const MAX_VIDEO_SECONDS = 600;
const MAX_FRAMES = 16;
const PROCESS_TIMEOUT_MS = 30_000;

export interface PreparedWhatsAppVideo {
  durationSeconds: number;
  frames: Array<{ seconds: number; base64: string }>;
  audio?: Uint8Array;
  audioUnavailable?: boolean;
}

export class WhatsAppVideoError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 422, code = "invalid_whatsapp_video") {
    super(message);
    this.name = "WhatsAppVideoError";
    this.status = status;
    this.code = code;
  }
}

/** Local files only: no shell, no remote protocols, bounded CPU, time and output. */
async function ffmpeg(binary: string, args: string[]) {
  return run(
    binary,
    ["-hide_banner", "-nostdin", "-format_whitelist", "mov,matroska,webm,mpeg,mpegvideo", ...args],
    {
      timeout: PROCESS_TIMEOUT_MS,
      killSignal: "SIGKILL",
      maxBuffer: 512 * 1024,
    },
  );
}

/** Samples the whole timeline; temporary media never enters storage or chat history. */
export async function prepareWhatsAppVideo(bytes: ArrayBuffer): Promise<PreparedWhatsAppVideo> {
  const { default: binary } = await import("ffmpeg-static");
  if (!binary) {
    throw new WhatsAppVideoError("O processamento de vídeo está indisponível.", 503);
  }
  const directory = await mkdtemp(join(tmpdir(), "tpec-video-"));
  const input = join(directory, "input.video");
  try {
    await writeFile(input, Buffer.from(bytes));
    let metadata = "";
    try {
      // FFmpeg exits with 1 when no output is specified, after inspecting the streams.
      const result = await ffmpeg(binary, ["-protocol_whitelist", "file", "-i", input]);
      metadata = result.stderr;
    } catch (error) {
      const result = error as { code?: unknown; stderr?: string };
      if (result.code !== 1) throw error;
      metadata = result.stderr ?? "";
    }
    const duration = metadata.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const durationSeconds = duration
      ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])
      : 0;
    if (!durationSeconds || !/Stream[^\n]*Video:/.test(metadata)) {
      throw new WhatsAppVideoError("Não foi possível ler as imagens deste vídeo. Reenvie em MP4.");
    }
    if (durationSeconds > MAX_VIDEO_SECONDS) {
      throw new WhatsAppVideoError(
        "Envie um trecho de até 10 minutos para que eu possa analisar o vídeo.",
        413,
        "whatsapp_video_too_long",
      );
    }
    const interval = Math.max(durationSeconds / MAX_FRAMES, 0.25);
    const framePattern = join(directory, "frame-%03d.jpg");
    await ffmpeg(binary, [
      "-loglevel",
      "error",
      "-protocol_whitelist",
      "file",
      "-threads",
      "1",
      "-i",
      input,
      "-map",
      "0:v:0",
      "-an",
      "-vf",
      `fps=1/${interval}:start_time=0:round=up,scale=768:768:force_original_aspect_ratio=decrease`,
      "-frames:v",
      String(MAX_FRAMES),
      "-threads",
      "1",
      "-q:v",
      "4",
      framePattern,
    ]);
    const names = (await readdir(directory)).filter((name) => /^frame-\d+\.jpg$/.test(name)).sort();
    if (!names.length) throw new WhatsAppVideoError("O vídeo não contém imagens legíveis.");
    const frames = await Promise.all(
      names.map(async (name, index) => ({
        seconds: Number((index * interval).toFixed(2)),
        base64: (await readFile(join(directory, name))).toString("base64"),
      })),
    );
    let audio: Uint8Array | undefined;
    let audioUnavailable = false;
    if (/Stream[^\n]*Audio:/.test(metadata)) {
      try {
        const audioPath = join(directory, "audio.mp3");
        await ffmpeg(binary, [
          "-loglevel",
          "error",
          "-protocol_whitelist",
          "file",
          "-threads",
          "1",
          "-i",
          input,
          "-map",
          "0:a:0",
          "-vn",
          "-ac",
          "1",
          "-ar",
          "16000",
          "-c:a",
          "libmp3lame",
          "-b:a",
          "32k",
          "-t",
          String(MAX_VIDEO_SECONDS),
          audioPath,
        ]);
        audio = await readFile(audioPath);
      } catch {
        // A damaged/unsupported audio track must not discard valid visual evidence.
        audioUnavailable = true;
      }
    }
    return { durationSeconds, frames, audio, audioUnavailable };
  } catch (error) {
    if (error instanceof WhatsAppVideoError) throw error;
    throw new WhatsAppVideoError(
      "Não foi possível processar este vídeo. Tente reenviar em MP4 ou enviar um trecho menor.",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
