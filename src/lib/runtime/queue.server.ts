import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export const JOB_KINDS = ["whatsapp", "recovery", "followup", "push"] as const;
export type JobKind = (typeof JOB_KINDS)[number];
export interface Job {
  id: string;
  kind: JobKind;
  payload: string;
  token: string;
  attempts: number;
}
// Longer than the worker's 25-minute HTTP deadline: uncertain requests must not
// be immediately re-dispatched while the old HTTP handler could still be alive.
export const LEASE_MS = 30 * 60_000;

export class JobQueue {
  private db: DatabaseSync;
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
    const path = join(directory, "jobs.sqlite");
    this.db = new DatabaseSync(path);
    chmodSync(path, 0o600);
    this.db.exec(`
      PRAGMA busy_timeout=5000;
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
      PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
        available INTEGER NOT NULL, lease INTEGER, token TEXT,
        created INTEGER NOT NULL, updated INTEGER NOT NULL, error TEXT
      );
      CREATE INDEX IF NOT EXISTS jobs_ready ON jobs(kind,status,available);
      CREATE TABLE IF NOT EXISTS clocks (name TEXT PRIMARY KEY, tick INTEGER NOT NULL);
    `);
  }
  close() {
    this.db.close();
  }
  enqueue(kind: JobKind, id: string, payload = "{}", now = Date.now()) {
    return (
      this.db
        .prepare(
          "INSERT OR IGNORE INTO jobs(id,kind,payload,available,created,updated) VALUES(?,?,?,?,?,?)",
        )
        .run(id, kind, payload, now, now, now).changes > 0
    );
  }
  schedule(now = Date.now()) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const kind of ["recovery", "followup", "push"] as const) {
        const last = this.db.prepare("SELECT tick FROM clocks WHERE name=?").get(kind) as
          | { tick: number }
          | undefined;
        if (last && now - last.tick < 60_000) continue;
        const active = this.db
          .prepare("SELECT id FROM jobs WHERE kind=? AND status IN ('pending','running') LIMIT 1")
          .get(kind);
        if (!active) this.enqueue(kind, `${kind}:${randomUUID()}`, "{}", now);
        this.db
          .prepare(
            "INSERT INTO clocks(name,tick) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET tick=excluded.tick",
          )
          .run(kind, now);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  claim(kind: JobKind, now = Date.now()): Job | undefined {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          "UPDATE jobs SET status='dead',token=NULL,lease=NULL,error='worker_lost',updated=? WHERE kind=? AND status='running' AND lease<=? AND attempts>=10",
        )
        .run(now, kind, now);
      this.db
        .prepare(
          "UPDATE jobs SET status='pending', token=NULL, lease=NULL WHERE kind=? AND status='running' AND lease<=?",
        )
        .run(kind, now);
      // A lane is serialized across all worker processes, including restarts.
      if (
        this.db.prepare("SELECT id FROM jobs WHERE kind=? AND status='running' LIMIT 1").get(kind)
      ) {
        this.db.exec("COMMIT");
        return;
      }
      const row = this.db
        .prepare(
          "SELECT id,kind,payload,attempts FROM jobs WHERE kind=? AND status='pending' AND available<=? ORDER BY created,id LIMIT 1",
        )
        .get(kind, now) as Omit<Job, "token"> | undefined;
      if (!row) {
        this.db.exec("COMMIT");
        return;
      }
      const token = randomUUID();
      this.db
        .prepare(
          "UPDATE jobs SET status='running',attempts=attempts+1,token=?,lease=?,updated=? WHERE id=?",
        )
        .run(token, now + LEASE_MS, now, row.id);
      this.db.exec("COMMIT");
      return { ...row, token, attempts: row.attempts + 1 };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  owned(id: string, token: string, now = Date.now()): Job | undefined {
    return this.db
      .prepare(
        "SELECT id,kind,payload,token,attempts FROM jobs WHERE id=? AND token=? AND status='running' AND lease>?",
      )
      .get(id, token, now) as Job | undefined;
  }
  renew(job: Job, now = Date.now()) {
    return (
      this.db
        .prepare(
          "UPDATE jobs SET lease=?,updated=? WHERE id=? AND token=? AND status='running' AND lease>?",
        )
        .run(now + LEASE_MS, now, job.id, job.token, now).changes > 0
    );
  }
  finish(job: Job, now = Date.now()) {
    return (
      this.db
        .prepare(
          "UPDATE jobs SET status='done',payload='{}',token=NULL,lease=NULL,updated=?,error=NULL WHERE id=? AND token=? AND status='running' AND lease>?",
        )
        .run(now, job.id, job.token, now).changes > 0
    );
  }
  fail(job: Job, code = "handler_failed", now = Date.now()) {
    // No exception messages or payloads: external providers may include secrets.
    const status = job.attempts >= 10 ? "dead" : "pending";
    const delay = Math.min(300_000, 5000 * 2 ** Math.min(job.attempts - 1, 6));
    this.db
      .prepare(
        "UPDATE jobs SET status=?,available=?,token=NULL,lease=NULL,updated=?,error=? WHERE id=? AND token=? AND status='running' AND lease>?",
      )
      .run(
        status,
        now + delay,
        now,
        code.replace(/[^a-z_]/g, "").slice(0, 50),
        job.id,
        job.token,
        now,
      );
  }
  heartbeat(now = Date.now()) {
    this.db
      .prepare(
        "INSERT INTO clocks(name,tick) VALUES('worker',?) ON CONFLICT(name) DO UPDATE SET tick=excluded.tick",
      )
      .run(now);
  }
  stats(now = Date.now()) {
    const rows = this.db
      .prepare("SELECT status,COUNT(*) AS total,MIN(created) AS oldest FROM jobs GROUP BY status")
      .all();
    const heartbeat = this.db.prepare("SELECT tick FROM clocks WHERE name='worker'").get() as
      | { tick: number }
      | undefined;
    return { jobs: rows, workerHealthy: Boolean(heartbeat && now - heartbeat.tick < 90_000) };
  }
  prune(now = Date.now()) {
    this.db.prepare("DELETE FROM jobs WHERE status='done' AND updated<?").run(now - 7 * 86400_000);
    // Failed tasks stay inspectable/replayable; expire sensitive content after 7 days.
    this.db
      .prepare("UPDATE jobs SET payload='{}' WHERE status='dead' AND updated<? AND payload!='{}'")
      .run(now - 7 * 86400_000);
  }
  replay(id: string) {
    return (
      this.db
        .prepare(
          "UPDATE jobs SET status='pending',attempts=0,available=?,error=NULL WHERE id=? AND status='dead' AND payload!='{}'",
        )
        .run(Date.now(), id).changes > 0
    );
  }
}

let shared: JobQueue | undefined;
export function jobQueue() {
  const directory = process.env.TPEC_DATA_DIR;
  if (!directory) throw new Error("missing_TPEC_DATA_DIR");
  return (shared ??= new JobQueue(directory));
}
