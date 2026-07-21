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
const forbidden = [["Pedro", "Luis", privateSurname].join(" "), privateSurname];
const violations = [];

function visit(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) visit(resolve(path, entry));
    return;
  }
  if (!textExtensions.has(extname(path).toLowerCase())) return;

  const content = readFileSync(path, "utf8");
  for (const value of forbidden) {
    if (content.includes(value)) violations.push(`${path.replace(`${root}\\`, "")}: ${value}`);
  }
}

for (const target of scanTargets) visit(resolve(root, target));

if (violations.length > 0) {
  console.error("Validação de privacidade da autoria falhou:");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log("Privacidade da autoria validada: somente o nome público abreviado pode ser publicado.");
