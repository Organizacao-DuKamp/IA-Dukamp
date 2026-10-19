import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import binary from "ffmpeg-static";
import { prepareWhatsAppVideo, WhatsAppVideoError } from "../src/lib/whatsapp/video.server.ts";

const run = promisify(execFile);

async function fixture(audio: boolean, duration = 2): Promise<ArrayBuffer> {
  const directory = await mkdtemp(join(tmpdir(), "tpec-fixture-"));
  try {
    const path = join(directory, "video.mp4");
    await run(
      binary!,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        duration > 10 ? "color=c=red:size=32x32:rate=1" : "testsrc2=size=160x120:rate=4",
        ...(audio ? ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=16000"] : []),
        "-t",
        String(duration),
        "-c:v",
        "libx264",
        "-threads",
        "1",
        "-pix_fmt",
        "yuv420p",
        ...(audio ? ["-c:a", "aac"] : []),
        path,
      ],
      { timeout: 15_000 },
    );
    const buffer = await readFile(path);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("MP4 real sem som extrai JPEGs distintos até o fim da linha do tempo", async () => {
  const result = await prepareWhatsAppVideo(await fixture(false));
  assert.equal(result.durationSeconds, 2);
  assert.ok(result.frames.length >= 4 && result.frames.length <= 16);
  assert.equal(result.frames[0].seconds, 0);
  assert.ok(result.frames.at(-1)!.seconds >= 1.5);
  assert.ok(new Set(result.frames.map((frame) => frame.base64)).size >= 2);
  for (const frame of result.frames) {
    assert.equal(Buffer.from(frame.base64, "base64").subarray(0, 2).toString("hex"), "ffd8");
  }
  assert.equal(result.audio, undefined);
});

test("MP4 real com som extrai a faixa em MP3 além dos quadros", async () => {
  const result = await prepareWhatsAppVideo(await fixture(true));
  assert.ok(result.frames.length > 0);
  assert.ok(result.audio && result.audio.byteLength > 100);
  assert.equal(result.audioUnavailable, false);
});

test("arquivo corrompido gera erro seguro e remove arquivos temporários", async () => {
  const before = (await readdir(tmpdir())).filter((name) => name.startsWith("tpec-video-"));
  await assert.rejects(
    () => prepareWhatsAppVideo(new TextEncoder().encode("isto não é um vídeo").buffer),
    (error: unknown) => error instanceof WhatsAppVideoError && error.status === 422,
  );
  assert.deepEqual(
    (await readdir(tmpdir())).filter((name) => name.startsWith("tpec-video-")),
    before,
  );
});

test("limite de duração é explícito em vez de analisar somente o começo", async () => {
  await assert.rejects(
    () => fixture(false, 601).then(prepareWhatsAppVideo),
    (error: unknown) =>
      error instanceof WhatsAppVideoError && error.code === "whatsapp_video_too_long",
  );
});
