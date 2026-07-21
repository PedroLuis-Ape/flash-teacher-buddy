import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";

const root = process.cwd();
const scanTargets = [
  "config",
  "docs",
  "public",
  "scripts",
  "src",
  "index.html",
  "vite.config.ts",
];
const textExtensions = new Set([".css", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".sql", ".ts", ".tsx", ".txt"]);
const privateSurname = ["de", "Oliveira", "Silva"].join(" ");
const forbidden = [
  { label: "nome completo privado", value: ["Pedro", "Luis", privateSurname].join(" ") },
  { label: "sobrenome privado", value: privateSurname },
];
const violations = [];

function normalizeSeparators(value) {
  return value
    .replace(/%(?:20|2d|5f)/gi, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

function visit(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) visit(resolve(path, entry));
    return;
  }
  if (!textExtensions.has(extname(path).toLowerCase())) return;

  const content = normalizeSeparators(readFileSync(path, "utf8"));
  for (const entry of forbidden) {
    if (content.includes(normalizeSeparators(entry.value))) {
      violations.push(`${path.replace(`${root}\\`, "")}: ${entry.label}`);
    }
  }
}

for (const target of scanTargets) visit(resolve(root, target));

if (violations.length > 0) {
  console.error("Validação de privacidade da autoria falhou:");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log("Privacidade da autoria validada: somente o nome público abreviado pode ser publicado.");
