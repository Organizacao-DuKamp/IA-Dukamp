import type { NitroConfig } from "nitro/types";

type TraceHooks = NonNullable<NonNullable<NitroConfig["traceOpts"]>["hooks"]>;

/**
 * nf3 0.3.24 appends NFT-discovered files after the full-package file list.
 * That schedules concurrent copyFile calls for the same ffmpeg.exe on Windows.
 * Keep the full trace (including the binary and licenses), but copy each file once.
 */
export const deduplicateFFmpegTrace: NonNullable<TraceHooks["tracedPackages"]> = (packages) => {
  for (const version of Object.values(packages["ffmpeg-static"]?.versions ?? {})) {
    version.files = [...new Set(version.files)];
  }
};
