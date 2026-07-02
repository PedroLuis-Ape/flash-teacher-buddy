import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const sourceDir = resolve(root, 'src');
const outputPath = resolve(root, 'docs/audits/generated/i18n-string-inventory.md');
const writeOutput = process.argv.includes('--write');
const allowed = new Set(['.ts', '.tsx', '.js', '.jsx']);
const ignored = /(?:\.test\.|\.spec\.|\.stories\.|\/generated\/|\/integrations\/supabase\/types\.ts$)/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    return stat.isDirectory() ? walk(path) : [path];
  });
}

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function looksTranslatable(value) {
  const text = normalize(value);
  if (text.length < 2 || text.length > 180) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(text)) return false;
  if (/^(?:https?:|\/|#|[A-Z0-9_:-]+)$/.test(text)) return false;
  if (/^(?:true|false|null|undefined|button|submit|dialog|status)$/i.test(text)) return false;
  return true;
}

const findings = [];
const files = walk(sourceDir)
  .filter((path) => allowed.has(extname(path)))
  .filter((path) => !ignored.test(path.replaceAll('\\', '/')));

for (const path of files) {
  const source = readFileSync(path, 'utf8');
  const file = relative(root, path).replaceAll('\\', '/');
  const candidates = [];

  const patterns = [
    { kind: 'jsx-text', regex: />([^<>{}\n][^<>{}]*)</g },
    { kind: 'attribute', regex: /\b(?:placeholder|title|aria-label|alt)=(["'])(.*?)\1/g },
    { kind: 'toast', regex: /\btoast\.(?:success|error|info|warning)\(\s*(["'`])([^\n]*?)\1/g },
    { kind: 'confirm', regex: /\b(?:confirm|alert)\(\s*(["'`])([^\n]*?)\1/g },
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern.regex)) {
      const value = pattern.kind === 'jsx-text' ? match[1] : match[2];
      if (!looksTranslatable(value)) continue;
      const before = source.slice(0, match.index ?? 0);
      const line = before.split('\n').length;
      candidates.push({ kind: pattern.kind, line, text: normalize(value) });
    }
  }

  const unique = [...new Map(candidates.map((item) => [`${item.kind}:${item.line}:${item.text}`, item])).values()];
  if (unique.length) {
    findings.push({
      file,
      usesTranslation: /useTranslation\s*\(|\bi18n\.t\s*\(|\bt\s*\(/.test(source),
      items: unique,
    });
  }
}

const total = findings.reduce((sum, file) => sum + file.items.length, 0);
const lines = [
  '# Inventário heurístico de strings da interface',
  '',
  '> Gerado por `node scripts/audit-i18n-strings.mjs --write`.',
  '>',
  '> O resultado é um ponto de partida. Falsos positivos e falsos negativos devem ser revisados manualmente.',
  '',
  `- Arquivos analisados: ${files.length}`,
  `- Arquivos com candidatos: ${findings.length}`,
  `- Candidatos encontrados: ${total}`,
  '',
];

for (const finding of findings.sort((a, b) => b.items.length - a.items.length)) {
  lines.push(`## ${finding.file}`);
  lines.push('');
  lines.push(`- Usa mecanismo de tradução aparente: ${finding.usesTranslation ? 'sim' : 'não'}`);
  lines.push(`- Candidatos: ${finding.items.length}`);
  lines.push('');
  for (const item of finding.items.slice(0, 80)) {
    lines.push(`- L${item.line} · ${item.kind}: ${JSON.stringify(item.text)}`);
  }
  if (finding.items.length > 80) lines.push(`- … mais ${finding.items.length - 80} candidato(s)`);
  lines.push('');
}

const report = `${lines.join('\n')}\n`;
if (writeOutput) {
  mkdirSync(resolve(root, 'docs/audits/generated'), { recursive: true });
  writeFileSync(outputPath, report, 'utf8');
  console.log(`Inventário salvo em ${relative(root, outputPath)}`);
} else {
  process.stdout.write(report);
}
