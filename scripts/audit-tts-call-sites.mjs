import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const sourceDir = resolve(root, 'src');
const outputPath = resolve(root, 'docs/audits/generated/tts-call-sites.md');
const writeOutput = process.argv.includes('--write');
const allowed = new Set(['.ts', '.tsx', '.js', '.jsx']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const rules = [
  { label: 'Hook central useTTS', pattern: /\buseTTS\b/g, severity: 'esperado' },
  { label: 'Serviço legado AudioService', pattern: /\bAudioService\b|\baudioService\b|\bplaySmartAudio\b/g, severity: 'revisar' },
  { label: 'speechSynthesis direto', pattern: /\bspeechSynthesis\b/g, severity: 'revisar' },
  { label: 'Utterance direto', pattern: /\bSpeechSynthesisUtterance\b/g, severity: 'revisar' },
  { label: 'Locale fixo en-US', pattern: /["'`]en-US["'`]/g, severity: 'revisar' },
  { label: 'Locale fixo pt-BR', pattern: /["'`]pt-BR["'`]/g, severity: 'revisar' },
];

const findings = [];
for (const path of walk(sourceDir).filter((file) => allowed.has(extname(file)))) {
  const source = readFileSync(path, 'utf8');
  const file = relative(root, path).replaceAll('\\', '/');
  const matches = [];

  for (const rule of rules) {
    for (const match of source.matchAll(rule.pattern)) {
      const line = source.slice(0, match.index ?? 0).split('\n').length;
      matches.push({ label: rule.label, severity: rule.severity, line, value: match[0] });
    }
  }

  if (matches.length) findings.push({ file, matches });
}

const lines = [
  '# Inventário de chamadas de TTS',
  '',
  '> Gerado por `node scripts/audit-tts-call-sites.mjs --write`.',
  '>',
  '> Ocorrências em arquivos centrais podem ser legítimas. O objetivo é localizar duplicações, chamadas diretas e dependências legadas antes de qualquer remoção.',
  '',
  `- Arquivos com ocorrências: ${findings.length}`,
  `- Ocorrências totais: ${findings.reduce((sum, item) => sum + item.matches.length, 0)}`,
  '',
];

for (const finding of findings.sort((a, b) => b.matches.length - a.matches.length)) {
  lines.push(`## ${finding.file}`);
  lines.push('');
  for (const item of finding.matches) {
    lines.push(`- L${item.line} · ${item.severity} · ${item.label}: ${JSON.stringify(item.value)}`);
  }
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
