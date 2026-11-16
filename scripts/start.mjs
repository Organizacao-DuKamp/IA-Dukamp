import { assertConfiguration } from "../src/lib/runtime/config.server.ts";
assertConfiguration();
process.env.NODE_ENV = "production";
process.env.TPEC_RUNTIME = "node";
process.env.WHATSAPP_STATE_STORE = "supabase";
process.env.HOST ||= "127.0.0.1";
process.env.PORT ||= "3000";
process.env.SERVER_SHUTDOWN_TIMEOUT ||= "1560";
await import("../.output/server/index.mjs");
