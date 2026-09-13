/**
 * Gera as capturas reais do produto publico usadas no carrossel da Home.
 *
 * Regras (ver Segundo Cerebro):
 * - apenas rotas publicas (/portal/*), nunca area autenticada;
 * - nenhum dado privado ou de aluno aparece nas imagens;
 * - viewport mobile determinista 390x844;
 * - a saida e convertida para WebP e os textos vivem em HTML, nao na imagem.
 *
 * Uso:
 *   npx vite preview --port 4173
 *   node scripts/marketing-screenshots.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.APE_PREVIEW_URL ?? "http://localhost:4173";
const LIST_ID = process.env.APE_FEATURED_LIST_ID ?? "a1c6d475-3a69-4b7e-9f7b-877d2480b5f6";
const FOLDER_ID = process.env.APE_FEATURED_FOLDER_ID ?? "8adc3d48-5648-45d5-bad3-30001e76df94";
const OUT_DIR = process.env.APE_SCREENSHOT_DIR ?? "tmp/marketing-screenshots";
const VIEWPORT = { width: 390, height: 844 };

const targets = [
  { path: "/portal", file: "ape-catalogo-publico-mobile" },
  // A pagina de material (/portal/list/:id) ainda depende de RPC ausente em
  // producao; a pasta publica e a superficie real equivalente hoje.
  { path: `/portal/folder/${FOLDER_ID}`, file: "ape-pasta-publica-mobile" },
  { path: `/portal/list/${LIST_ID}/games`, file: "ape-hub-de-jogos-mobile" },
  { path: `/portal/list/${LIST_ID}/study`, file: "ape-modo-de-estudo-mobile" },
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });

for (const target of targets) {
  const page = await context.newPage();
  await page.goto(`${BASE}${target.path}`, { waitUntil: "networkidle", timeout: 45000 });
  // A pagina publica carrega dados via RPC; esperar o estado de carregamento
  // sumir evita capturar a tela de "Carregando...".
  await page
    .waitForFunction(() => !/Carregando/i.test(document.body.innerText), null, { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT_DIR}/${target.file}.png`, fullPage: false });
  console.log(`capturado ${target.path} -> ${target.file}.png`);
  await page.close();
}

await context.close();
await browser.close();
