import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = resolve(process.cwd());
const viteBin = resolve(root, "node_modules/vite/bin/vite.js");
const artifactDir = resolve(root, "artifacts/preview-smoke");
const port = Number(process.env.PREVIEW_SMOKE_PORT || 4173);
const baseUrl = `http://127.0.0.1:${port}`;

function startProcess(args, label) {
  const child = spawn(process.execPath, [viteBin, ...args], {
    cwd: root,
    env: { ...process.env, CI: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const collect = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-8_000);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  child.on("error", (error) => {
    output = `${output}\n${label}: ${error.message}`.slice(-8_000);
  });
  return { child, getOutput: () => output };
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  let lastError = "preview did not answer";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/__preview-health`);
      if (response.ok) return;
      lastError = `health returned HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`Preview server did not become ready: ${lastError}`);
}

async function waitForContent(page) {
  await page.waitForFunction(() => document.body.innerText.trim().length > 40, null, {
    timeout: 12_000,
  });
}

async function runCase(browser, name, path, options = {}) {
  const page = await browser.newPage({ viewport: options.viewport });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    if (options.routeSupabase) {
      await page.route("**://*.supabase.co/**", (route) => route.abort());
    }
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await waitForContent(page);
    if (options.selector) {
      await page.locator(options.selector).waitFor({ state: "visible", timeout: 8_000 });
    }
    if (options.text) {
      await page.getByText(options.text, { exact: false }).waitFor({ state: "visible", timeout: 8_000 });
    }
    if (options.mobileLayout) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (overflow) throw new Error("mobile layout has horizontal overflow");
    }
    const allowed = options.allowConsole || [];
    const allowedPageErrors = options.allowPageErrors || [];
    const unexpectedConsole = consoleErrors.filter((message) => !allowed.some((pattern) => pattern.test(message)));
    const unexpectedPageErrors = pageErrors.filter((message) => !allowedPageErrors.some((pattern) => pattern.test(message)));
    if (unexpectedConsole.length || unexpectedPageErrors.length) {
      throw new Error(`console/page errors: ${[...unexpectedConsole, ...unexpectedPageErrors].join(" | ")}`);
    }
    console.log(`PASS ${name}`);
  } catch (error) {
    await mkdir(artifactDir, { recursive: true });
    await page.screenshot({ path: resolve(artifactDir, `${name}.png`), fullPage: true }).catch(() => undefined);
    throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await page.close();
  }
}

let build;
let server;
let browser;

try {
  await rm(artifactDir, { recursive: true, force: true });
  build = startProcess(["build", "--mode", "preview-smoke"], "build");
  const buildExit = await new Promise((resolveExit, reject) => {
    build.child.once("error", reject);
    build.child.once("exit", (code) => resolveExit(code ?? 1));
  });
  if (buildExit !== 0) throw new Error(`Vite build failed:\n${build.getOutput()}`);

  server = startProcess(["preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], "preview");
  await waitForPreview();
  browser = await chromium.launch({ headless: true });

  await runCase(browser, "health-desktop", "/__preview-health", {
    selector: '[data-testid="preview-health"]',
    text: "App Piteco Preview: OK",
  });
  await runCase(browser, "landing-desktop", "/landing");
  await runCase(browser, "auth-desktop", "/auth");
  await runCase(browser, "not-found-desktop", "/preview-smoke-not-found");
  await runCase(browser, "config-missing", "/__preview-smoke/config-missing", {
    selector: '[data-testid="bootstrap-diagnostics"]',
    text: "Diagnóstico do bootstrap",
  });
  await runCase(browser, "component-error", "/__preview-smoke/component-error", {
    text: "Não foi possível carregar esta tela.",
    allowConsole: [/Preview smoke component failure/, /\[SafeMode\]/],
    allowPageErrors: [/Preview smoke component failure/],
  });
  await runCase(browser, "supabase-unavailable", "/landing", {
    routeSupabase: true,
    allowConsole: [/supabase/i, /network/i, /fetch/i, /auth/i, /Query/i],
  });
  await runCase(browser, "health-mobile", "/__preview-health", {
    viewport: { width: 390, height: 844 },
    selector: '[data-testid="preview-health"]',
    mobileLayout: true,
  });
  await runCase(browser, "landing-mobile", "/landing", {
    viewport: { width: 390, height: 844 },
    mobileLayout: true,
  });

  console.log("Preview Safety Gate: PASS");
} catch (error) {
  if (server) console.error(`Preview server output:\n${server.getOutput()}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (server && !server.child.killed) server.child.kill();
  if (build && !build.child.killed) build.child.kill();
}
