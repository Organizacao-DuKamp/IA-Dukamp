import { assertConfiguration } from "../src/lib/runtime/config.server.ts";
assertConfiguration(process.env, process.argv.includes("--build"));
console.log("[config] ok (values omitted)");
