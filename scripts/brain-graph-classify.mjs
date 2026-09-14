#!/usr/bin/env node
/**
 * Classifica notas do Segundo Cérebro para uso nos Groups do Graph View.
 *
 * Uso:
 *   node scripts/brain-graph-classify.mjs [--root <dir>] [--apply] [--json]
 *
 * Padrão é dry-run: só conta e classifica, sem escrever nada. Com `--apply`:
 * - adiciona APENAS as propriedades que faltam, preservando o frontmatter
 *   existente byte a byte (inserção textual, sem re-serializar YAML);
 * - cria o bloco de frontmatter quando a nota não tem nenhum;
 * - nunca altera o corpo, links, nomes ou encoding (Mantém CRLF/LF original).
 *
 * A classificação é determinística: frontmatter explícito > pasta > nome.
 * Ler arquivo aqui não custa token de modelo — é script local.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parse as parseYaml } from "yaml";

/**
 * ATENÇÃO ao nome da propriedade: o vault JÁ usa `type:` com semântica própria
 * (`current-state`, `area`, `protocol`, `lesson`, `session-checkpoint`...).
 * Sobrescrever isso destruiria a convenção existente, então a taxonomia do grafo
 * vive em `category:`, e `type` fica intocado.
 */
const PROP = "category";

const VALID_TYPES = [
  "architecture", "data", "game", "bug", "decision", "test", "agent", "documentation", "archive", "other",
];
const VALID_STATUS = ["active", "reference", "archived"];

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const asJson = args.includes("--json");
const validateOnly = args.includes("--validate");
const writeGraphJson = args.includes("--graph-json");
const rootArg = args.indexOf("--root");
const ROOT = rootArg >= 0 ? args[rootArg + 1] : "docs/brain";

/** Ordem importa: o primeiro token que casar decide o type. */
const TYPE_RULES = [
  ["archive", ["IMPORT", "HISTORICAL", "RETROSPECTIVE", "DEPRECATED", "ARCHIVE"]],
  ["decision", ["DECISION", "DECISIONS", "ADR"]],
  ["bug", ["BUG", "BUGS", "RISK", "RISKS", "INCIDENT", "ERROR", "FAILURE"]],
  ["test", ["TEST", "TESTS", "QA", "VALIDATION", "CHECKPOINT"]],
  ["agent", ["AGENT", "AGENTS", "CODEX", "ASTRA", "LUNA", "MCP", "SKILL", "CCL"]],
  ["data", ["DATA", "DATABASE", "SUPABASE", "RPC", "SCHEMA", "MIGRATION"]],
  ["architecture", ["ARCHITECTURE", "SYSTEM", "RUNTIME", "PIPELINE", "OPERATING-MODEL", "MASTER-PLAN", "CANONICAL-VAULT"]],
  ["game", ["GAME", "GAMES", "STUDY", "UI", "MOBILE", "MOTION", "LEARNING"]],
  ["documentation", ["README", "HOME", "HUB", "INDEX", "GLOSSARY", "PROTOCOL", "LESSON", "SOURCE-MAP", "DOCUMENTATION", "CONTEXT-FEEDING"]],
  ["documentation", ["CURRENT-STATE", "PROCESS-LOG", "HANDOFF", "CONTEXT-PACKET", "WORKTREE", "GIT-", "PROGRAM", "REGISTRY"]],
  ["test", ["AUDIT"]],
];

const AREA_RULES = [
  ["supabase", ["SUPABASE", "RPC", "SCHEMA", "MIGRATION", "DATABASE", "RLS"]],
  ["study", ["STUDY", "SESSION", "FLASHCARD", "CARD", "GLOSSARY"]],
  ["ui", ["UI", "VISUAL", "MOTION", "LAYOUT", "MOBILE", "CONTRAST", "PALETTE"]],
  ["mcp", ["MCP"]],
  ["codex", ["CODEX", "AGENT", "CLARA", "LUNA", "ASTRA", "SKILL"]],
  ["obsidian", ["OBSIDIAN", "VAULT", "BRAIN", "GRAPH"]],
  ["classroom", ["CLASSROOM", "TURMA", "CLASS"]],
  ["extension", ["EXTENSION", "EXTENSAO", "EXTENSÃO", "BROWSER"]],
  ["seo", ["SEO", "GEO", "PUBLIC"]],
  ["ai", ["AI", "CLAUDE", "GPT", "LLM"]],
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === ".obsidian" || entry === ".trash" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (entry.toLowerCase().endsWith(".md")) out.push(full);
  }
  return out;
}

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const raw = text.slice(text.indexOf("\n") + 1, end + 1);
  const body = text.slice(end + 4);
  const props = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (match) props[match[1].toLowerCase()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return { raw, body, props, endIndex: end + 4 };
}

function tokenOf(fullPath) {
  return relative(ROOT, fullPath).split(sep).join("/").toUpperCase();
}

function classify(fullPath, props) {
  const token = tokenOf(fullPath).replace(/\.MD$/, "");
  const existing = (props[PROP] ?? props.type ?? "").toLowerCase();
  if (VALID_TYPES.includes(existing)) return { type: existing, classifiedBy: "frontmatter" };
  // Nota diária (2026-09-10) e registros datados são documentação do período.
  if (/\d{4}-\d{2}-\d{2}$/.test(token)) return { type: "documentation", classifiedBy: "date-name" };

  for (const [type, needles] of TYPE_RULES) {
    if (needles.some((needle) => token.includes(needle))) return { type, classifiedBy: "path-or-name" };
  }
  // Fallback por pasta (sem token reconhecido).
  if (token.startsWith("IMPORTS/")) return { type: "archive", classifiedBy: "folder" };
  if (token.startsWith("SESSIONS/")) return { type: "test", classifiedBy: "folder" };
  if (token.startsWith("LEARNING/")) return { type: "documentation", classifiedBy: "folder" };
  if (token.startsWith("AREAS/")) return { type: "architecture", classifiedBy: "folder" };
  return { type: "other", classifiedBy: "none" };
}

function inferArea(token) {
  for (const [area, needles] of AREA_RULES) {
    if (needles.some((needle) => token.includes(needle))) return area;
  }
  return "piteco";
}

function valueOf(props, key) {
  const value = props[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function inferStatus(token, props) {
  const existing = (valueOf(props, "status") ?? "").toLowerCase();
  if (VALID_STATUS.includes(existing)) return existing;
  if (["IMPORT", "HISTORICAL", "RETROSPECTIVE", "DEPRECATED", "ARCHIVE"].some((n) => token.includes(n))) return "archived";
  if (["README", "INDEX", "GLOSSARY", "PROTOCOL", "HUB", "SOURCE-MAP", "CANONICAL"].some((n) => token.includes(n))) return "reference";
  return "active";
}

const files = walk(ROOT).sort();

if (writeGraphJson) {
  // Cores por categoria (hex -> rgb decimal, formato do Obsidian).
  const COLORS = {
    architecture: "#8B5CF6",
    data: "#3B82F6",
    game: "#22D3EE",
    bug: "#EF4444",
    decision: "#EAB308",
    test: "#22C55E",
    agent: "#EC4899",
    documentation: "#F97316",
    archive: "#6B7280",
    other: "#94A3B8",
  };
  const path = join(ROOT, ".obsidian", "graph.json");
  const graph = JSON.parse(readFileSync(path, "utf8"));
  graph["collapse-color-groups"] = false;
  graph.colorGroups = Object.entries(COLORS).map(([category, hex]) => ({
    query: `["category":"${category}"]`,
    color: { a: 1, rgb: parseInt(hex.slice(1), 16) },
  }));
  writeFileSync(path, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
  console.log(`graph.json atualizado: ${path} com ${graph.colorGroups.length} grupos`);
  process.exit(0);
}

if (validateOnly) {
  const out = { total: files.length, semCategory: [], categoriaInvalida: [], yamlQuebrado: [], duplicado: [], byCategory: {} };
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const rel = relative(ROOT, file);
    const fm = parseFrontmatter(text);
    if (!fm) { out.semCategory.push(rel); continue; }
    let parsed;
    try {
      parsed = parseYaml(fm.raw) ?? {};
    } catch (error) {
      out.yamlQuebrado.push(`${rel}: ${String(error.message).slice(0, 60)}`);
      continue;
    }
    const occurrences = (fm.raw.match(/^\s*category\s*:/gm) ?? []).length;
    if (occurrences > 1) out.duplicado.push(rel);
    const value = typeof parsed.category === "string" ? parsed.category : undefined;
    if (!value) { out.semCategory.push(rel); continue; }
    if (!VALID_TYPES.includes(value)) out.categoriaInvalida.push(`${rel}: ${value}`);
    out.byCategory[value] = (out.byCategory[value] ?? 0) + 1;
  }
  console.log(`VALIDACAO root=${ROOT} total=${out.total}`);
  console.log("categoria: " + Object.entries(out.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" "));
  console.log(`semCategory=${out.semCategory.length} invalida=${out.categoriaInvalida.length} yamlQuebrado=${out.yamlQuebrado.length} duplicado=${out.duplicado.length}`);
  if (out.yamlQuebrado.length) console.log("yaml: " + out.yamlQuebrado.slice(0, 5).join(" | "));
  if (out.categoriaInvalida.length) console.log("invalida: " + out.categoriaInvalida.slice(0, 5).join(" | "));
  if (out.semCategory.length) console.log("sem category: " + out.semCategory.slice(0, 5).join(", "));
  process.exit(out.yamlQuebrado.length || out.categoriaInvalida.length || out.duplicado.length ? 1 : 0);
}

const stats = {
  total: files.length, alreadyTyped: 0, byType: {}, byArea: {}, byStatus: {}, byHow: {},
  changed: [], other: [], ambiguous: [], errors: [],
};

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const fm = parseFrontmatter(text);
  const props = fm ? fm.props : {};
  const token = tokenOf(file).replace(/\.MD$/, "");
  const { type, classifiedBy } = classify(file, props);
  if (VALID_TYPES.includes((valueOf(props, PROP) ?? props.type ?? "").toLowerCase())) stats.alreadyTyped += 1;
  const area = valueOf(props, "area") ?? inferArea(token);
  const status = inferStatus(token, props);

  stats.byType[type] = (stats.byType[type] ?? 0) + 1;
  stats.byArea[area] = (stats.byArea[area] ?? 0) + 1;
  stats.byStatus[status] = (stats.byStatus[status] ?? 0) + 1;
  stats.byHow[classifiedBy] = (stats.byHow[classifiedBy] ?? 0) + 1;
  if (type === "other") stats.other.push(relative(ROOT, file));
  if (classifiedBy === "none") stats.ambiguous.push(relative(ROOT, file));

  // A decisão de escrever olha PRESENÇA da chave, nunca valor vazio: um
  // `area:` vazio (placeholder de template) é intencional e não pode virar chave
  // duplicada.
  const additions = [];
  if (!fm) {
    additions.push(`${PROP}: ${type}`, `area: ${area}`, `status: ${status}`);
  } else {
    if (props[PROP] === undefined) additions.push(`${PROP}: ${type}`);
    if (props.area === undefined) additions.push(`area: ${area}`);
    if (props.status === undefined) additions.push(`status: ${status}`);
  }
  if (additions.length === 0) continue;
  stats.changed.push(relative(ROOT, file));
  if (!apply) continue;

  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  let next;
  if (!fm) {
    next = ["---", ...additions, "---", "", text].join(eol);
  } else {
    // Insere logo depois da linha de abertura do frontmatter, preservando CRLF/LF.
    const firstNewline = text.indexOf("\n");
    const head = text.slice(0, firstNewline + 1);
    const rest = text.slice(firstNewline + 1);
    next = `${head}${additions.join(eol)}${eol}${rest}`;
  }
  writeFileSync(file, next, "utf8");
}

if (asJson) {
  console.log(JSON.stringify({
    root: ROOT, applied: apply, total: stats.total, alreadyTyped: stats.alreadyTyped,
    byType: stats.byType, byArea: stats.byArea, byStatus: stats.byStatus, byHow: stats.byHow,
    changedCount: stats.changed.length, other: stats.other, ambiguous: stats.ambiguous,
  }));
} else {
  console.log(`root=${ROOT} modo=${apply ? "APPLY" : "dry-run"}`);
  console.log(`total=${stats.total} jaComType=${stats.alreadyTyped} aAlterar=${stats.changed.length}`);
  console.log("type: " + Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" "));
  console.log("area: " + Object.entries(stats.byArea).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" "));
  console.log("status: " + Object.entries(stats.byStatus).map(([k, v]) => `${k}=${v}`).join(" "));
  console.log("como: " + Object.entries(stats.byHow).map(([k, v]) => `${k}=${v}`).join(" "));
  console.log(`other=${stats.other.length} ambiguas=${stats.ambiguous.length}`);
  if (stats.other.length) console.log("other: " + stats.other.slice(0, 20).join(", "));
}
