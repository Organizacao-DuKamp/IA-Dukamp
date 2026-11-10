import assert from "node:assert/strict";
import test from "node:test";
import { guardianOpsReport, type GuardianOpsTurn } from "../src/lib/guardian/ops-health.ts";

const at = new Date("2026-11-10T20:00:00.000Z");
const turn = (
  minsAgo: number,
  values: Partial<GuardianOpsTurn> = {},
): GuardianOpsTurn => ({
  created_at: new Date(at.getTime() - minsAgo * 60_000).toISOString(),
  channel: "whatsapp",
  status: "completed",
  input_tokens: 200,
  duration_ms: 1_000,
  estimated_cost_usd: 0.001,
  pricing_configured: true,
  ...values,
});

test("phase7: 24-hour windows do not mix web traffic, future turns or prior days", () => {
  const rows = [
    turn(10),
    turn(1_440),
    turn(1_440 + 1, { status: "error" }),
    turn(2_881, { status: "error" }),
    turn(4, { channel: "web", status: "error" }),
    turn(-2, { status: "error" }),
  ];
  const report = guardianOpsReport(rows, at);
  assert.equal(report.current.turns, 2);
  assert.equal(report.current.errors, 0);
  assert.equal(report.previous.turns, 1);
  assert.equal(report.previous.errors, 1);
});

test("phase7: monitoring detects long pending operations without retrying them", () => {
  const rows = [
    turn(17, { status: "pending" }),
    turn(3, { status: "pending" }),
    turn(4, { status: "error", error_code: "import_busy" }),
    turn(5, { status: "error", error_code: "import_busy" }),
    turn(6, { status: "completed" }),
  ];
  const report = guardianOpsReport(rows, at);
  assert.equal(report.current.pending, 2);
  assert.equal(report.stalledPending, 1);
  assert.equal(report.current.errors, 2);
  assert.equal(report.current.errorPercent, 40);
  assert.equal(report.errorsByCode[0].code, "import_busy");
  assert.equal(report.errorsByCode[0].count, 2);
  assert.ok(report.signals.some((entry) => entry.id === "pending" && entry.severity === "critical"));
});

test("phase7: 95th-percentile tokens and duration are calculated from real samples", () => {
  const rows = Array.from({ length: 20 }, (_, index) =>
    turn(index + 1, {
      input_tokens: index === 19 ? 69_810 : index === 18 ? 35_000 : 100,
      duration_ms: index === 19 ? 80_000 : index === 18 ? 40_000 : 500,
    }),
  );
  const report = guardianOpsReport(rows, at);
  assert.equal(report.current.highTokenTurns, 2);
  assert.equal(report.current.p95InputTokens, 35_000);
  assert.equal(report.current.p95DurationMs, 40_000);
  assert.ok(report.signals.some((entry) => entry.id === "tokens"));
});

test("phase7: stage cost is counted once per usage event, never from private user text", () => {
  const rows = [
    turn(1, {
      estimated_cost_usd: 0.125,
      error_code: "token:secret-sample",
      metadata: {
        guardian: { version: 1, status: "completed", stage: "receipt" },
        usage_events: [
          { stage: "guardian_semantic_plan", estimated_cost_usd: 0.1 },
          { stage: "transcription", estimated_cost_usd: 0.025 },
          { stage: "https://malicious.example", estimated_cost_usd: 100 },
        ],
        user_text: "private producer sentence",
        phone_number: "5517999991111",
      },
    }),
    turn(2, {
      status: "error",
      error_code: "5517999991111: another private sentence",
      pricing_configured: false,
    }),
  ];
  const report = guardianOpsReport(rows, at);
  assert.equal(report.current.estimatedCostUsd, 0.126);
  assert.equal(report.current.traces, 1);
  assert.equal(report.current.confirmedWrites, 1);
  assert.equal(report.current.pricingIncomplete, 1);
  assert.deepEqual(
    report.stages.map((entry) => entry.name),
    ["guardian_semantic_plan", "transcription"],
  );
  assert.ok(report.errorsByCode.some((entry) => entry.code === "outros"));
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /5517999991111|private producer sentence|malicious\.example/);
});

test("phase7: prevents false green when telemetry is missing or incomplete", () => {
  const empty = guardianOpsReport([], at);
  assert.equal(empty.current.turns, 0);
  assert.ok(empty.signals.some((entry) => entry.severity === "unknown"));
  assert.ok(!empty.signals.some((entry) => entry.id === "no-alert"));
  const truncated = guardianOpsReport([turn(1)], at, true);
  assert.equal(truncated.truncated, true);
  assert.ok(truncated.signals.some((entry) => entry.id === "sample"));
  assert.ok(!truncated.signals.some((entry) => entry.id === "no-alert"));
  assert.ok(truncated.signals.some((entry) => entry.id === "small-sample"));
  const missingTariff = guardianOpsReport(
    [turn(2, { pricing_configured: null })],
    at,
  );
  assert.equal(missingTariff.current.pricingIncomplete, 1);
  assert.ok(missingTariff.signals.some((entry) => entry.id === "pricing"));
});

test("phase7: flags cost increases only with a reliable comparable baseline", () => {
  const rows = [
    ...Array.from({ length: 12 }, (_, i) => turn(i + 1, { estimated_cost_usd: 0.05 })),
    ...Array.from({ length: 12 }, (_, i) => turn(1_500 + i, { estimated_cost_usd: 0.01 })),
  ];
  const report = guardianOpsReport(rows, at);
  assert.ok(report.signals.some((entry) => entry.id === "cost"));
  assert.equal(report.current.turns, 12);
  assert.equal(report.previous.turns, 12);
  const small = guardianOpsReport([turn(5, { estimated_cost_usd: 0.5 })], at);
  assert.ok(!small.signals.some((entry) => entry.id === "cost"));
});

test("phase7: invalid clock fails closed rather than showing fabricated green status", () => {
  assert.throws(() => guardianOpsReport([], new Date("invalid")), /invalid_monitoring_clock/);
});
