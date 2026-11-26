import { spawnSync } from "node:child_process";
import { assertConfiguration } from "../src/lib/runtime/config.server.ts";
assertConfiguration(process.env, true);
const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
  env: { ...process.env, NITRO_PRESET: "node_server" },
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
