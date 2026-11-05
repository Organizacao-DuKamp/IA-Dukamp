import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mock, test } from "node:test";
import { traceNodeModules } from "nf3";
import { deduplicateFFmpegTrace } from "../build/ffmpeg-trace.ts";

test("full FFmpeg trace never copies a destination concurrently (Windows EBUSY regression)", async () => {
  const directory = await fs.mkdtemp(join(tmpdir(), "tpec-ffmpeg-trace-"));
  const packageDir = join(directory, "node_modules", "ffmpeg-static");
  const output = join(directory, "output");
  const executable = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  await fs.mkdir(packageDir, { recursive: true });
  await fs.writeFile(
    join(packageDir, "package.json"),
    JSON.stringify({ name: "ffmpeg-static", version: "5.3.0", main: "index.js" }),
  );
  await fs.writeFile(
    join(packageDir, "index.js"),
    `module.exports = require("node:path").join(__dirname, ${JSON.stringify(executable)});`,
  );
  await fs.writeFile(join(packageDir, executable), "binary fixture");
  await fs.writeFile(join(packageDir, "LICENSE"), "license fixture");

  const copyFile = fs.copyFile;
  const active = new Set<string>();
  const copies = new Map<string, number>();
  const pending: Array<Promise<void>> = [];
  // Linux normally permits the overlapping copies that Windows rejects. Model
  // that lock here so CI detects the packaging race on either operating system.
  const mockedCopy = mock.method(fs, "copyFile", (src, dst, mode) => {
    const destination = resolve(String(dst));
    if (active.has(destination)) {
      throw Object.assign(new Error(`concurrent copy: ${destination}`), { code: "EBUSY" });
    }
    active.add(destination);
    copies.set(destination, (copies.get(destination) ?? 0) + 1);
    const task = copyFile(src, dst, mode).finally(() => active.delete(destination));
    pending.push(task);
    return task;
  });
  syncBuiltinESMExports();
  try {
    await traceNodeModules([join(packageDir, "index.js")], {
      rootDir: directory,
      outDir: output,
      fullTraceInclude: ["ffmpeg-static"],
      hooks: { tracedPackages: deduplicateFFmpegTrace },
    });
    const packaged = join(output, "node_modules", "ffmpeg-static");
    assert.equal(copies.get(join(packaged, executable)), 1);
    assert.ok([...copies.values()].every((count) => count === 1));
    assert.equal(await fs.readFile(join(packaged, executable), "utf8"), "binary fixture");
    assert.equal(await fs.readFile(join(packaged, "LICENSE"), "utf8"), "license fixture");
    const require = createRequire(join(output, "entry.cjs"));
    assert.equal(require("ffmpeg-static"), join(packaged, executable));
  } finally {
    await Promise.allSettled(pending);
    mockedCopy.mock.restore();
    syncBuiltinESMExports();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
