// Isolated synthetic UI; every non-local request is blocked.
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const options = { headless: true };
if (process.env.SPARTICUZ_MODULE) {
  const { default: binary } = await import(process.env.SPARTICUZ_MODULE);
  options.executablePath = await binary.executablePath();
  options.args = binary.args;
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
  { stdio: ["ignore", "pipe", "pipe"] },
);
let log = "",
  browser;
server.stdout.on("data", (d) => {
  log += d;
});
server.stderr.on("data", (d) => {
  log += d;
});
try {
  const deadline = Date.now() + 20000;
  while (!/Local:/.test(log) && Date.now() < deadline && server.exitCode === null) await delay(100);
  assert.match(log, /Local:/);
  browser = await chromium.launch(options);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort(),
  );
  await page.goto("http://127.0.0.1:5180/tests/ui/observed.html");
  await page
    .getByRole("heading", { name: "Histórico das informações", exact: true })
    .waitFor({ timeout: 15000 });
  const articles = page.getByRole("article");
  assert.match(await articles.nth(1).innerText(), /38 cabeças[\s\S]*Dado variável/);
  assert.match(await articles.nth(0).innerText(), /Tanabi[\s\S]*Dado de cadastro/);
  await articles.nth(1).getByText("Mensagem de origem", { exact: true }).click();
  assert.match(await articles.nth(1).innerText(), /Agora tenho 38 bovinos/);
  const history = page.getByRole("list", { name: "Histórico dos dados do produtor" });
  assert.equal(await history.getByRole("listitem").count(), 3);
  assert.match(await history.innerText(), /40 cabeças/);
  await page.getByRole("textbox", { name: "Buscar produtor ou propriedade" }).fill("inexistente");
  await page.getByText("Nenhum perfil corresponde à busca.", { exact: true }).waitFor();
  await page.getByRole("textbox").fill("");
  await page.getByRole("button", { name: /Fazenda Teste/ }).click();
  await page.getByRole("heading", { name: "Histórico das informações", exact: true }).waitFor();
  assert.match(await page.getByRole("article").innerText(), /Poloni/);
  assert.doesNotMatch(
    await page.getByRole("list", { name: "Histórico dos dados do produtor" }).innerText(),
    /40 cabeças/,
  );
  await page.getByRole("button", { name: /Propriedade de 5517000000000/ }).click();
  await page.getByRole("heading", { name: "Histórico das informações", exact: true }).waitFor();
  assert.ok(await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: "/tmp/tpec-observed-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth + 1),
    "Mobile horizontal overflow",
  );
  await page.screenshot({ path: "/tmp/tpec-observed-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "Observed profiles UI passed: source, variable count, prior value, search, sender isolation, desktop and mobile. No external requests.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
