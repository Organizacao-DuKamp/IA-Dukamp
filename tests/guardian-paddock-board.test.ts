import assert from "node:assert/strict";
import test from "node:test";
import { paddockBoard, herdOverview } from "../src/lib/guardian/paddock-board.ts";
import { emptyFarm, type FarmBook, type GuardianAction } from "../src/lib/guardian/schema.ts";
import { prepareFarmBatch } from "../src/lib/guardian/execution.ts";
import { farmIndicators } from "../src/lib/guardian/operations.ts";
const at = "2026-11-12T12:00:00Z",
  date = "2026-11-12";
const source = { actor: "000000000000500", messageId: "seed", at, confirmed: true as const };
const act = (book: FarmBook, actions: GuardianAction[]) =>
  prepareFarmBatch({
    book,
    actions,
    role: "owner",
    propertyId: "test",
    source,
    executedByMessageId: "seed",
  }).book;
function fixture() {
  return act(emptyFarm("QA Piquetes", "Tanabi", "SP"), [
    { kind: "lot_update", lot: "1", pasture: "Piquete Norte" },
    { kind: "lot_update", lot: "2", pasture: "Piquete Sul" },
    { kind: "herd_count", count: 10, date: "2026-11-01", lot: "1" },
    { kind: "animal", code: "QA 1", lot: "1", sex: "female" },
    { kind: "animal", code: "QA 2", lot: "1", sex: "male" },
    {
      kind: "herd_event",
      type: "purchase",
      count: 5,
      date: "2026-11-02",
      lot: "1",
      description: "Cinco bovinos recebidos",
    },
  ]);
}
test("board preserves explicit piquete/lot links and never adds individual cards to census totals", () => {
  const book = fixture(),
    original = JSON.stringify(book),
    board = paddockBoard(book, date);
  const north = board.find((p) => p.name === "Piquete Norte")!;
  assert.equal(north.lots[0].name, "1");
  assert.equal(north.lots[0].rows[0].count, 15);
  assert.deepEqual(
    north.lots[0].animals.map((a) => a.code),
    ["QA 1", "QA 2"],
  );
  assert.equal(board.find((p) => p.name === "Piquete Sul")!.lots[0].name, "2");
  assert.equal(JSON.stringify(book), original);
});
test("a transferred group appears only in its current lot and unknown totals remain unknown", () => {
  let book = fixture();
  book = act(book, [{ kind: "herd_relocate", to: "2", date }]);
  const board = paddockBoard(book, date);
  const lot = board.find((p) => p.name === "Piquete Sul")!.lots[0];
  assert.equal(lot.animals.length, 2);
  assert.equal(lot.rows[0].count, null, "a partial lot census does not establish a farm census");
  assert.equal(lot.rows[0].groups[0].count, 5);
  assert.equal(board.find((p) => p.name === "Piquete Norte")!.lots[0].animals.length, 0);
});
test("unlinked lots and unidentified groups remain visible without invented paddocks or animal identities", () => {
  const book = act(emptyFarm("QA", "Tanabi", "SP"), [
    { kind: "lot_update", lot: "3" },
    {
      kind: "herd_event",
      type: "purchase",
      count: 8,
      date,
      description: "Bovinos sem identificação",
    },
  ]);
  const board = paddockBoard(book, date);
  assert.equal(board.length, 1);
  assert.equal(board[0].name, null);
  assert.ok(board[0].lots.some((l) => l.name === "3"));
  const unassigned = board[0].lots.find((l) => l.name === null)!;
  assert.equal(unassigned.animals.length, 0);
  assert.equal(unassigned.rows[0].count, null);
  assert.equal(unassigned.rows[0].registered, 8);
});
test("421 identified without lot override misleading zero display and two quantity-only cattle stay drafts", () => {
  let book = act(emptyFarm("QA", "Tanabi", "SP"), [
    { kind: "lot_update", lot: "6" },
    { kind: "herd_count", count: 2, date },
    { kind: "herd_count", count: 2, date, lot: "6" },
  ]);
  book.animals = Array.from({ length: 421 }, (_, i) => ({
    code: `QA ${i + 1}`,
    sex: "unknown" as const,
    weights: [],
    source,
  }));
  const before = JSON.stringify(book);
  const board = paddockBoard(book, date);
  const unassigned = board.find((p) => p.name === null)!.lots.find((l) => l.name === null)!;
  const lot6 = board.find((p) => p.name === null)!.lots.find((l) => l.name === "6")!;
  assert.equal(unassigned.rows[0].count, 0, "reported balance remains visible for reconciliation");
  assert.equal(unassigned.animals.length, 421, "individual cards must remain visible");
  assert.equal(unassigned.unidentified, 0, "individual cards must not turn into anonymous drafts");
  assert.equal(lot6.rows[0].count, 2);
  assert.equal(lot6.animals.length, 0);
  assert.equal(lot6.unidentified, 2);
  assert.equal(lot6.draftStart, 1);
  assert.equal(JSON.stringify(book), before, "projection must not write fake animals or census");

  // Identifying one anonymous slot adds an individual card, not a new stock event.
  book = act(book, [{ kind: "animal", code: "QA 422", lot: "6", sex: "unknown" }]);
  const refreshed = paddockBoard(book, date).find((p) => p.name === null)!;
  const updated = refreshed.lots.find((l) => l.name === "6")!;
  assert.equal(updated.animals.length, 1);
  assert.equal(updated.unidentified, 1);
  assert.equal(updated.draftStart, 2, "remaining anonymous animal retains number 2");
  assert.equal(updated.rows[0].count, 2);
  assert.equal(unassigned.animals.length, 421);
});
test("anonymous purchased groups produce draft slots without inventing cattle identities", () => {
  const book = act(emptyFarm("QA", "Tanabi", "SP"), [
    { kind: "herd_event", type: "purchase", count: 8, date, description: "Bovinos sem ID" },
  ]);
  const unassigned = paddockBoard(book, date)[0].lots[0];
  assert.equal(unassigned.animals.length, 0);
  assert.equal(unassigned.unidentified, 8);
  assert.equal(book.animals.length, 0);
});
test("declared paddocks with no lots remain visible and ambiguous management links never select an arbitrary paddock", () => {
  const book = fixture();
  book.management = {
    entries: ["A", "B", "Vazio"].map((name, i) => ({
      id: `p${i}`,
      section: "pasture",
      values: { name, ...(i < 2 ? { lot: "3" } : {}) },
      source,
      revisions: [],
    })),
  };
  book.operations!.lots.push({ name: "3" });
  const board = paddockBoard(book, date);
  assert.equal(board.find((p) => p.name === "Vazio")!.lots.length, 0);
  assert.ok(board.find((p) => p.name === null)!.lots.some((l) => l.name === "3"));
  book.operations!.lots.find((l) => l.name === "3")!.pasture = "Oficial";
  assert.ok(
    paddockBoard(book, date)
      .find((p) => p.name === "Oficial")!
      .lots.some((l) => l.name === "3"),
  );
});
test("light dashboard totals match existing indicators including replaced events and other species", () => {
  const book = act(fixture(), [
    { kind: "herd_count", count: 100, date: "2026-11-01" },
    { kind: "herd_count", count: 20, species: "pig", date: "2026-11-01" },
    {
      kind: "herd_event",
      type: "birth",
      count: 2,
      date: "2026-11-05",
      description: "Dois nascimentos",
    },
    { kind: "herd_event", type: "death", count: 1, date: "2026-11-06", description: "Uma morte" },
  ]);
  const full = farmIndicators(book, "2026-11-01", date),
    light = herdOverview(book, date);
  assert.equal(light.stock.count, full.stock.count);
  assert.equal(light.births, full.births);
  assert.equal(light.deaths, full.deaths);
  assert.deepEqual(
    light.stocksBySpecies.map(({ species, count }) => ({ species, count })),
    full.stocksBySpecies.map(({ species, count }) => ({ species, count })),
  );
  // Loading the three tiles must not inspect any individual weights.
  Object.defineProperty(book, "animals", {
    get() {
      throw Error("weights must be lazy");
    },
  });
  assert.equal(herdOverview(book, date).stock.count, light.stock.count);
});
