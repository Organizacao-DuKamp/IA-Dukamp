// Starts an isolated local Vite server; only the synthetic fixture is visited.
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
let options = { headless: true };
if (process.env.SPARTICUZ_MODULE) {
  const mod = await import(process.env.SPARTICUZ_MODULE);
  const c = mod.default;
  options = { ...options, executablePath: await c.executablePath(), args: c.args };
}
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--config",
    "tests/ui/vite.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    "5180",
  ],
  { stdio: ["ignore", "pipe", "pipe"], env: process.env },
);
let log = "";
server.stdout.on("data", (d) => {
  log += d;
});
server.stderr.on("data", (d) => {
  log += d;
});
let browser;
try {
  const deadline = Date.now() + 20000;
  while (!/Local:/.test(log) && Date.now() < deadline && server.exitCode === null) await delay(100);
  assert.match(log, /Local:/, "Local Vite server did not start");
  browser = await chromium.launch(options);
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    return u.hostname === "127.0.0.1" || u.hostname === "localhost"
      ? route.continue()
      : route.abort();
  });
  const response = await page.goto("http://127.0.0.1:5180/tests/ui/guardian.html");
  try {
    await page.getByRole("heading", { name: "Próximas atividades" }).waitFor({ timeout: 15000 });
  } catch (error) {
    console.log(
      JSON.stringify({
        status: response?.status(),
        errors,
        body: (await page.locator("body").innerText()).slice(0, 3000),
        server: log.slice(-1000),
      }),
    );
    throw error;
  }
  assert.equal(await page.getByText("R$ 3.000,00", { exact: true }).count(), 1);
  await page.screenshot({
    path: process.env.GUARDIAN_DESKTOP_SCREENSHOT || "/tmp/tpec-ui-desktop.png",
    fullPage: true,
  });
  for (const area of ["Tarefas", "Rebanho", "Caderno", "Financeiro", "Eventos", "Equipe e dados"]) {
    await page.getByRole("navigation").getByRole("button", { name: area, exact: true }).click();
    assert.ok(
      await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth + 1),
      `Horizontal overflow in ${area}`,
    );
  }
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Calculadoras", exact: true })
    .click();
  await page.getByLabel("Peso inicial (kg)").fill("350");
  await page.getByLabel("Peso final (kg)").fill("450");
  await page.getByLabel("Dias entre pesagens").fill("100");
  await page.getByRole("button", { name: "Calcular", exact: true }).click();
  assert.match(await page.locator("pre").innerText(), /GMD: 1 kg/);
  await page.getByLabel("Dias entre pesagens").fill("0");
  await page.getByRole("button", { name: "Calcular", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await page.getByLabel("O que deseja fazer?").selectOption("expense");
  await page.getByLabel("Valor (R$)").fill("150.50");
  await page.getByLabel("Descrição", { exact: true }).fill("Compra de ração de teste");
  await page.getByRole("button", { name: "Revisar antes de salvar" }).click();
  assert.match(
    await page
      .getByRole("status")
      .innerText()
      .catch(() => page.locator("output").innerText()),
    /15050/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Visão geral", exact: true })
    .click();
  assert.ok(
    await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth + 1),
    "Mobile horizontal overflow",
  );
  await page.screenshot({
    path: process.env.GUARDIAN_MOBILE_SCREENSHOT || "/tmp/tpec-ui-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Guardian UI: desktop/mobile, 8 areas, deterministic calculator, invalid input and review-only form passed. No external requests allowed.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
