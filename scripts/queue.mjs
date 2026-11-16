import { jobQueue } from "../src/lib/runtime/queue.server.ts";
const queue = jobQueue();
try {
  if (process.argv[2] === "replay") {
    if (!process.argv[3] || !queue.replay(process.argv[3])) throw Error("job_not_replayable");
    console.log("[queue] replay queued; original idempotency checks remain active");
  } else console.log(JSON.stringify(queue.stats(), null, 2));
} finally {
  queue.close();
}
