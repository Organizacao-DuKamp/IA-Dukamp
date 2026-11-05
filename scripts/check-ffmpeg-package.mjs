import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

const root = resolve(".netlify/functions-internal/server");
const require = createRequire(resolve(root, "package.json"));
const binary = require("ffmpeg-static");
assert.ok(binary, "FFmpeg is unsupported on this platform");
const path = relative(root, binary);
assert.ok(!isAbsolute(path) && !path.startsWith(".."), "FFmpeg resolved outside the function");
assert.equal(basename(binary), process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");

const contents = await readFile(binary);
if (process.platform === "linux") {
  assert.equal(contents.subarray(0, 4).toString("hex"), "7f454c46", "Expected a Linux ELF binary");
  const machine = { x64: 62, arm64: 183, ia32: 3, arm: 40 }[process.arch];
  assert.equal(contents.readUInt16LE(18), machine, "Wrong Linux CPU architecture");
  assert.ok((await stat(binary)).mode & 0o111, "FFmpeg lost its executable permission");
} else if (process.platform === "win32") {
  assert.equal(contents.subarray(0, 2).toString(), "MZ", "Expected a Windows executable");
}

const source = createRequire(import.meta.url)("ffmpeg-static");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(
  hash(contents),
  hash(await readFile(source)),
  "Packaged FFmpeg differs from the source",
);
const { stdout } = await promisify(execFile)(binary, ["-version"], { timeout: 15_000 });
assert.match(stdout, /^ffmpeg version /);
console.log(`[ffmpeg-package-check] ok ${process.platform}-${process.arch}: ${path}`);
