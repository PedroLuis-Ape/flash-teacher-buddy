import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const individualFiles = [
  "home.json",
  "atividades-de-ingles.json",
  "flashcards-de-ingles.json",
  "ingles-para-iniciantes.json",
  "para-professores.json",
  "about.json",
  "portal.json",
];

const groupedFiles = [
  "pt-docs-a.json",
  "pt-docs-b1.json",
  "pt-docs-b2.json",
  "en-a.json",
  "en-b.json",
];

function readJson(root, fileName) {
  return JSON.parse(readFileSync(resolve(root, "config/editorial", fileName), "utf8"));
}

export function loadEditorialMeta(root = process.cwd()) {
  return readJson(root, "editorial-meta.json");
}

export function loadEditorialPages(root = process.cwd()) {
  const individual = individualFiles.map((fileName) => readJson(root, fileName));
  const grouped = groupedFiles.flatMap((fileName) => readJson(root, fileName));
  const pages = [...individual, ...grouped];
  const paths = new Set();

  for (const page of pages) {
    if (!page?.path || !page?.title || !page?.description || !page?.h1) {
      throw new Error(`Página editorial incompleta: ${JSON.stringify(page)}`);
    }
    if (paths.has(page.path)) throw new Error(`Rota editorial duplicada: ${page.path}`);
    paths.add(page.path);
  }

  return pages;
}
