#!/usr/bin/env node
/**
 * Auditoria de strings de UI provavelmente hardcoded.
 *
 * Não trata todo texto como erro: a allowlist abaixo cobre logs, IDs técnicos,
 * nomes próprios, conteúdo de teste, conteúdo do usuário, valores de schema e
 * dados SEO intencionalmente localizados.
 *
 * Uso:
 *   node scripts/audit-i18n.mjs            (relatório)
 *   node scripts/audit-i18n.mjs --write    (grava docs/audits/generated/i18n-hardcoded.md)
 *   node scripts/audit-i18n.mjs --area src/pages
 */
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const writeOutput = args.includes('--write');
const areaIndex = args.indexOf('--area');
const area = areaIndex >= 0 ? args[areaIndex + 1] : 'src';
const sourceDir = resolve(root, area);
const outputPath = resolve(root, 'docs/audits/generated/i18n-hardcoded.md');

const allowedExtensions = new Set(['.ts', '.tsx']);

/** Caminhos fora do escopo de interface traduzível. */
const ignoredPaths = [
  /\.test\.tsx?$/,
  /\.spec\.tsx?$/,
  /\.stories\.tsx?$/,
  /\/__tests__\//,
  /\/integrations\/supabase\/types\.ts$/,
  /\/i18n\//,
  /\/locales\//,
  /\/content\/public\//, // conteúdo editorial/SEO localizado intencionalmente
  /\/pages\/seo\//,
  /\/assets\//,
  /\/components\/ui\//, // primitivas shadcn sem texto próprio
];

/** Textos que não são interface do app. */
const allowedText = [
  /^[A-Z0-9_.:-]+$/, // IDs técnicos e constantes
  /^[a-z0-9_-]+$/, // slugs, chaves de schema
  /^\d/, // começa com número
  /^(?:https?:|mailto:|\/|#)/,
  /^(?:APE|Piteco|Lovable|Supabase|Google|Chrome|PWA|JSON|CSV|TTS|IA|AI)$/i,
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const normalize = (value) => value.replace(/\s+/g, ' ').trim();

function isCandidate(value) {
  const text = normalize(value);
  if (text.length < 3 || text.length > 200) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(text)) return false;
  if (!/\s/.test(text) && text.length < 4) return false;
  if (allowedText.some((pattern) => pattern.test(text))) return false;
  // Fragmentos de código capturados pelas heurísticas de JSX
  if (/[{};=<>]|=>|\breturn\b|\buseState\b|\bconst\b/.test(text)) return false;
  return true;
}

const patterns = [
  { kind: 'jsx-text', regex: />([^<>{}\n][^<>{}]*)</g, group: 1 },
  { kind: 'attribute', regex: /\b(?:placeholder|title|aria-label|aria-description|alt)=(["'])(.*?)\1/g, group: 2 },
  { kind: 'toast', regex: /\btoast\.(?:success|error|warning|info)\(\s*(["'])([^\n]*?)\1/g, group: 2 },
  { kind: 'dialog', regex: /\b(?:confirm|alert)\(\s*(["'])([^\n]*?)\1/g, group: 2 },
];

const files = walk(sourceDir)
  .filter((path) => allowedExtensions.has(extname(path)))
  .filter((path) => !ignoredPaths.some((pattern) => pattern.test(path.replaceAll('\\', '/'))));

const findings = [];
for (const path of files) {
  const source = readFileSync(path, 'utf8');
  const file = relative(root, path).replaceAll('\\', '/');
  const items = [];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern.regex)) {
      const value = match[pattern.group];
      if (!isCandidate(value)) continue;
      const line = source.slice(0, match.index ?? 0).split('\n').length;
      items.push({ kind: pattern.kind, line, text: normalize(value) });
    }
  }

  const unique = [...new Map(items.map((item) => [`${item.kind}:${item.line}:${item.text}`, item])).values()];
  if (unique.length) {
    findings.push({
      file,
      translated: /useTranslation\s*\(/.test(source),
      items: unique,
    });
  }
}

const total = findings.reduce((sum, entry) => sum + entry.items.length, 0);
const migrated = findings.filter((entry) => entry.translated).length;

const lines = [
  '# Auditoria de strings de interface hardcoded',
  '',
  '> Gerado por `npm run i18n:audit`.',
  '',
  `- Área analisada: \`${area}\``,
  `- Arquivos analisados: ${files.length}`,
  `- Arquivos com pendências: ${findings.length} (com useTranslation: ${migrated})`,
  `- Strings pendentes: ${total}`,
  '',
];

for (const finding of findings.sort((a, b) => b.items.length - a.items.length)) {
  lines.push(`## ${finding.file}`, '', `- useTranslation: ${finding.translated ? 'sim' : 'não'}`, `- Pendências: ${finding.items.length}`, '');
  for (const item of finding.items.slice(0, 60)) {
    lines.push(`- L${item.line} · ${item.kind}: ${JSON.stringify(item.text)}`);
  }
  if (finding.items.length > 60) lines.push(`- … mais ${finding.items.length - 60}`);
  lines.push('');
}

const report = `${lines.join('\n')}\n`;
if (writeOutput) {
  mkdirSync(resolve(root, 'docs/audits/generated'), { recursive: true });
  writeFileSync(outputPath, report, 'utf8');
}
console.log(`i18n:audit — ${files.length} arquivos, ${findings.length} com pendências, ${total} strings.`);
if (writeOutput) console.log(`Relatório: ${relative(root, outputPath)}`);
