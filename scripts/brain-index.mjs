#!/usr/bin/env node
/**
 * brain-index.mjs - manifesto de METADADOS do Segundo Cerebro do App Piteco.
 *
 * Regra do protocolo de contexto: READ ONCE -> COMPACT -> SHARE -> REUSE.
 * Este script existe para que um agente decida O QUE ler sem ler o vault
 * inteiro. Ele NAO duplica conteudo: emite apenas metadados por nota
 * (dominio, documento canonico, descricao de 1 linha, type, last_reviewed,
 * bytes e sha256) mais um brain_version derivado do conjunto.
 *
 * Determinismo (obrigatorio):
 * - ordem estavel por path, comparacao de code points (sem locale);
 * - sha256 e bytes calculados sobre UTF-8 com finais de linha normalizados
 *   para LF ("byte_basis"), de modo que o MESMO conteudo em um checkout CRLF
 *   (Windows/autocrlf) e LF (CI/Linux) gere o MESMO manifesto;
 * - nenhum timestamp, caminho absoluto ou dado de ambiente no arquivo.
 *
 * Uso:
 *   node scripts/brain-index.mjs                  # regenera docs/brain/brain-manifest.json
 *   node scripts/brain-index.mjs --check          # falha (exit 1) se estiver desatualizado
 *   node scripts/brain-index.mjs --print          # imprime no stdout, nao escreve
 *   node scripts/brain-index.mjs --root <dir> --out <file>
 *   node scripts/brain-index.mjs --compare <dir>  # reconcilia dois roots (vault x docs/brain)
 */

import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANIFEST_VERSION = 1;
export const BYTE_BASIS = 'utf8-bytes-lf-normalized';
export const DEFAULT_ROOT = 'docs/brain';
export const DEFAULT_OUT = 'docs/brain/brain-manifest.json';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IGNORED_DIRECTORIES = new Set(['.obsidian', 'node_modules', '.git']);
const HISTORICAL_ROOT = 'imports';
const SESSION_LOG_PATTERN = /^12-PROCESS-LOG(?:-.+)?\.md$/i;
const BACKTICK_FENCE_PATTERN = /^(#|>|---|\|\||\x60\x60\x60|-\s|\*\s|\d+\.\s)/;

/**
 * Documento canonico por dominio.
 * "declared" = a nota e explicitamente a fonte daquele dominio.
 * "inferred" = melhor porta de entrada conhecida; ajustar somente por
 * decisao explicita, nunca por escrita silenciosa.
 */
export const CANONICAL_DOCUMENTS = {
  'knowledge-management': { path: '10-CONTEXT-FEEDING-RULE.md', confidence: 'declared' },
  'current-state': { path: '01-CURRENT-STATE.md', confidence: 'declared' },
  planning: { path: '02-MASTER-PLAN.md', confidence: 'declared' },
  architecture: { path: '03-ARCHITECTURE.md', confidence: 'declared' },
  decisions: { path: '04-DECISIONS.md', confidence: 'declared' },
  'agent-operations': { path: '05-AGENTS.md', confidence: 'declared' },
  bugs: { path: '06-BUGS.md', confidence: 'declared' },
  quality: { path: '07-TESTS.md', confidence: 'declared' },
  release: { path: '08-RISKS.md', confidence: 'declared' },
  handoff: { path: '09-ASTRA-HANDOFF.md', confidence: 'declared' },
  'repository-operations': { path: '23-GIT-E-WORKTREES.md', confidence: 'declared' },
  security: { path: '24-SECURITY-AUDIT-2026-09-12.md', confidence: 'declared' },
  'public-activation': { path: '25-PUBLIC-ACTIVATION-PROGRAM.md', confidence: 'declared' },
  'seo-public-web': { path: '25-PUBLIC-ACTIVATION-PROGRAM.md', confidence: 'inferred' },
  mcp: { path: 'areas/mcp-agent-api.md', confidence: 'declared' },
  extension: { path: 'areas/browser-extension.md', confidence: 'declared' },
  'browser-extension': { path: 'areas/browser-extension.md', confidence: 'declared' },
  'ui-motion': { path: 'areas/motion-system.md', confidence: 'declared' },
  'study-resume': { path: 'areas/study-resume.md', confidence: 'declared' },
  'supabase-runtime': { path: 'areas/supabase-runtime.md', confidence: 'declared' },
  'adaptive-learning': { path: 'learning/00-LEARNING-HUB.md', confidence: 'declared' },
  'visual-polish': { path: 'areas/visual-polish.md', confidence: 'declared' },
};

/**
 * Dominio fixo das notas numeradas da raiz. Algumas delas nao possuem
 * frontmatter (06-BUGS, 04-DECISIONS, ...) ou possuem "area" que descreve o
 * assunto do momento, nao o dominio documental. Aqui a fonte e o papel da
 * nota no vault, declarado explicitamente.
 */
const PATH_DOMAINS = {
  '00-HOME.md': 'knowledge-management',
  '01-CURRENT-STATE.md': 'current-state',
  '02-MASTER-PLAN.md': 'planning',
  '03-ARCHITECTURE.md': 'architecture',
  '04-DECISIONS.md': 'decisions',
  '05-AGENTS.md': 'agent-operations',
  '06-BUGS.md': 'bugs',
  '07-TESTS.md': 'quality',
  '08-RISKS.md': 'release',
  '09-ASTRA-HANDOFF.md': 'handoff',
  '10-CONTEXT-FEEDING-RULE.md': 'knowledge-management',
  '11-ARCHIVE-IMPORT-2026-09-11.md': 'historical-import',
};

const DIRECTORY_DOMAINS = [
  { prefix: 'sessions/', domain: 'session-log' },
  { prefix: 'learning/lessons/', domain: 'adaptive-learning' },
  { prefix: 'learning/attempts/', domain: 'adaptive-learning' },
  { prefix: 'learning/playbooks/', domain: 'adaptive-learning' },
  { prefix: 'learning/retrospectives/', domain: 'adaptive-learning' },
  { prefix: 'learning/templates/', domain: 'template' },
  { prefix: 'learning/', domain: 'adaptive-learning' },
  { prefix: 'areas/', domain: 'area' },
  { prefix: 'templates/', domain: 'template' },
  { prefix: HISTORICAL_ROOT + '/', domain: 'historical-import' },
];

function comparePaths(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

export function normalizeText(buffer) {
  return buffer.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function sha256OfText(text) {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

export function shortHash(value, length = 8) {
  return typeof value === 'string' ? value.slice(0, length) : '';
}

export function parseFrontmatter(content) {
  if (!content.startsWith('---')) return {};
  const match = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return {};

  const data = {};
  for (const line of match[1].split('\n')) {
    const keyMatch = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!keyMatch) continue;
    const key = keyMatch[1];
    let value = (keyMatch[2] ?? '').trim();
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")));
    if (quoted) value = value.slice(1, -1);
    if (value) data[key] = value;
  }
  return data;
}

function stripFrontmatter(content) {
  if (!content.startsWith('---')) return content;
  const match = content.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? content.slice(match[0].length) : content;
}

export function firstHeading(content) {
  const match = stripFrontmatter(content).match(/^#[ \t]+(.+)$/m);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

export function shorten(value, limit = 140) {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= limit) return collapsed;
  return collapsed.slice(0, limit - 1).trimEnd() + '...';
}

export function firstParagraphLine(content) {
  const lines = stripFrontmatter(content).split('\n');
  let index = 0;
  while (index < lines.length && !/^#[ \t]+/.test(lines[index])) index += 1;
  index += 1;
  for (; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (BACKTICK_FENCE_PATTERN.test(line)) continue;
    return line
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/[*_\x60]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

export function domainFor(relativePath, frontmatter) {
  if (PATH_DOMAINS[relativePath]) return PATH_DOMAINS[relativePath];
  if (SESSION_LOG_PATTERN.test(relativePath)) return 'session-log';
  const declared = (frontmatter.domain ?? '').trim() || (frontmatter.area ?? '').trim();
  if (declared) return declared;
  for (const rule of DIRECTORY_DOMAINS) {
    if (relativePath.startsWith(rule.prefix)) return rule.domain;
  }
  return 'general';
}

function fallbackType(relativePath, domain) {
  if (relativePath === '00-HOME.md') return 'home';
  if (domain === 'historical-import') return 'historical-import';
  if (domain === 'session-log') return 'session-log';
  if (domain === 'template') return 'template';
  if (domain === 'area') return 'area';
  return 'note';
}

async function collectMarkdown(current, files = []) {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await collectMarkdown(absolute, files);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(absolute);
    }
  }
  return files;
}

export async function readNote(absolutePath, rootDir) {
  const text = normalizeText(await readFile(absolutePath));
  const relativePath = toPosix(path.relative(rootDir, absolutePath));
  const frontmatter = parseFrontmatter(text);
  const domain = domainFor(relativePath, frontmatter);
  const canonical = CANONICAL_DOCUMENTS[domain] ?? null;
  const bytes = Buffer.byteLength(text, 'utf8');
  const sha256 = sha256OfText(text);
  const title = firstHeading(text);
  const historical = domain === 'historical-import' || relativePath.startsWith(HISTORICAL_ROOT + '/');

  return {
    path: relativePath,
    text,
    bytes,
    sha256,
    note: {
      path: relativePath,
      domain,
      canonical: canonical ? canonical.path === relativePath : false,
      canonical_document: canonical ? canonical.path : null,
      title,
      description: shorten(frontmatter.description || firstParagraphLine(text) || title),
      type: (frontmatter.type ?? '').trim() || fallbackType(relativePath, domain),
      status: (frontmatter.status ?? '').trim() || null,
      last_reviewed: (frontmatter.last_reviewed ?? '').trim() || null,
      historical,
      bytes,
      sha256,
    },
  };
}

export function brainVersionOf(notes) {
  const digest = createHash('sha256');
  digest.update('brain-manifest-v' + MANIFEST_VERSION + '\n');
  for (const note of [...notes].sort((left, right) => comparePaths(left.path, right.path))) {
    digest.update(note.path + '\u0000' + note.sha256 + '\u0000' + note.bytes + '\n');
  }
  return digest.digest('hex');
}

export function resolveRoot(rootDir) {
  return path.isAbsolute(rootDir) ? rootDir : path.resolve(REPO_ROOT, rootDir);
}

export async function buildManifest(rootDir = DEFAULT_ROOT) {
  const absoluteRoot = resolveRoot(rootDir);
  const notes = [];
  for (const file of await collectMarkdown(absoluteRoot)) {
    const { note } = await readNote(file, absoluteRoot);
    notes.push(note);
  }
  notes.sort((left, right) => comparePaths(left.path, right.path));

  const domains = {};
  for (const note of notes) {
    if (!domains[note.domain]) {
      const canonical = CANONICAL_DOCUMENTS[note.domain];
      domains[note.domain] = {
        notes: 0,
        bytes: 0,
        historical_notes: 0,
        canonical_document: canonical ? canonical.path : null,
        canonical_confidence: canonical ? canonical.confidence : null,
      };
    }
    const entry = domains[note.domain];
    entry.notes += 1;
    entry.bytes += note.bytes;
    if (note.historical) entry.historical_notes += 1;
  }

  const sortedDomains = {};
  for (const domain of Object.keys(domains).sort(comparePaths)) sortedDomains[domain] = domains[domain];

  const canonicalDocuments = {};
  for (const domain of Object.keys(CANONICAL_DOCUMENTS).sort(comparePaths)) {
    canonicalDocuments[domain] = CANONICAL_DOCUMENTS[domain];
  }

  return {
    manifest_version: MANIFEST_VERSION,
    brain_root: toPosix(path.relative(REPO_ROOT, absoluteRoot)) || '.',
    generated_by: 'scripts/brain-index.mjs',
    byte_basis: BYTE_BASIS,
    note_count: notes.length,
    historical_note_count: notes.filter((note) => note.historical).length,
    total_bytes: notes.reduce((total, note) => total + note.bytes, 0),
    brain_version: brainVersionOf(notes),
    canonical_documents: canonicalDocuments,
    domains: sortedDomains,
    notes,
  };
}

export function serializeManifest(manifest) {
  return JSON.stringify(manifest, null, 2) + '\n';
}

export function diffManifests(previous, next) {
  const previousNotes = new Map(((previous ?? {}).notes ?? []).map((note) => [note.path, note]));
  const nextNotes = new Map(((next ?? {}).notes ?? []).map((note) => [note.path, note]));
  const added = [];
  const removed = [];
  const changed = [];
  for (const entry of nextNotes) {
    const before = previousNotes.get(entry[0]);
    if (!before) added.push(entry[0]);
    else if (before.sha256 !== entry[1].sha256 || before.bytes !== entry[1].bytes) changed.push(entry[0]);
  }
  for (const notePath of previousNotes.keys()) {
    if (!nextNotes.has(notePath)) removed.push(notePath);
  }
  return {
    added: added.sort(comparePaths),
    removed: removed.sort(comparePaths),
    changed: changed.sort(comparePaths),
    unchanged: nextNotes.size - added.length - changed.length,
  };
}

export async function checkManifest(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const out = options.out ?? DEFAULT_OUT;
  const manifest = await buildManifest(root);
  const serialized = serializeManifest(manifest);
  const outPath = resolveRoot(out);
  let previousText = null;
  try {
    previousText = await readFile(outPath, 'utf8');
  } catch {
    return { ok: false, reason: 'missing', outPath, manifest, serialized };
  }
  if (previousText === serialized) return { ok: true, reason: 'current', outPath, manifest, serialized };
  let previous = null;
  try {
    previous = JSON.parse(previousText);
  } catch {
    return { ok: false, reason: 'unparseable', outPath, manifest, serialized };
  }
  return {
    ok: false,
    reason: 'stale',
    outPath,
    manifest,
    serialized,
    diff: diffManifests(previous, manifest),
    previousBrainVersion: previous.brain_version ?? null,
  };
}

function parseArgs(argv) {
  const options = { check: false, print: false, help: false, root: DEFAULT_ROOT, out: null, compare: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') options.check = true;
    else if (arg === '--print') options.print = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--root') options.root = argv[++index];
    else if (arg.indexOf('--root=') === 0) options.root = arg.slice('--root='.length);
    else if (arg === '--out') options.out = argv[++index];
    else if (arg.indexOf('--out=') === 0) options.out = arg.slice('--out='.length);
    else if (arg === '--compare') options.compare = argv[++index];
    else if (arg.indexOf('--compare=') === 0) options.compare = arg.slice('--compare='.length);
    else throw new Error('argumento desconhecido: ' + arg);
  }
  return options;
}

function usage() {
  return [
    'brain-index - manifesto de metadados do Segundo Cerebro',
    '',
    '  node scripts/brain-index.mjs [--root <dir>] [--out <file>]',
    '  node scripts/brain-index.mjs --check [--root <dir>] [--out <file>]',
    '  node scripts/brain-index.mjs --print [--root <dir>]',
    '  node scripts/brain-index.mjs --compare <dir>',
    '',
    'defaults: --root ' + DEFAULT_ROOT + ' --out ' + DEFAULT_OUT,
  ].join('\n');
}

async function runCompare(leftRoot, rightRoot) {
  const left = await buildManifest(leftRoot);
  const right = await buildManifest(rightRoot);
  const leftNotes = new Map(left.notes.map((note) => [note.path, note]));
  const rightNotes = new Map(right.notes.map((note) => [note.path, note]));
  const onlyLeft = [...leftNotes.keys()].filter((notePath) => !rightNotes.has(notePath)).sort(comparePaths);
  const onlyRight = [...rightNotes.keys()].filter((notePath) => !leftNotes.has(notePath)).sort(comparePaths);
  const different = [...leftNotes.keys()]
    .filter((notePath) => rightNotes.has(notePath) && leftNotes.get(notePath).sha256 !== rightNotes.get(notePath).sha256)
    .sort(comparePaths);
  const identical = [...leftNotes.keys()].filter(
    (notePath) => rightNotes.has(notePath) && leftNotes.get(notePath).sha256 === rightNotes.get(notePath).sha256,
  ).length;

  console.log('BRAIN_INDEX_COMPARE');
  console.log('left:  ' + left.brain_root + ' (' + left.note_count + ' notas, ' + left.total_bytes + ' B)');
  console.log('right: ' + right.brain_root + ' (' + right.note_count + ' notas, ' + right.total_bytes + ' B)');
  console.log('identical: ' + identical);
  for (const notePath of onlyLeft) console.log('only-left:  ' + notePath);
  for (const notePath of onlyRight) console.log('only-right: ' + notePath);
  for (const notePath of different) {
    console.log(
      'different:  ' + notePath + ' (' + shortHash(leftNotes.get(notePath).sha256) + ' != ' + shortHash(rightNotes.get(notePath).sha256) + ')',
    );
  }
  if (onlyLeft.length === 0 && onlyRight.length === 0 && different.length === 0) {
    console.log('BRAIN_INDEX_COMPARE_IN_SYNC');
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error('ERROR ' + error.message);
    console.error(usage());
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  if (options.compare) {
    await runCompare(options.root, options.compare);
    return;
  }

  const manifest = await buildManifest(options.root);
  const outPath = resolveRoot(options.out ?? DEFAULT_OUT);

  if (options.print) {
    process.stdout.write(serializeManifest(manifest));
    return;
  }

  if (options.check) {
    const result = await checkManifest({ root: options.root, out: options.out ?? DEFAULT_OUT });
    console.log('Brain index: ' + manifest.brain_root + ' (' + manifest.note_count + ' notas, ' + manifest.total_bytes + ' B)');
    console.log('brain_version: ' + manifest.brain_version);
    if (result.ok) {
      console.log('BRAIN_INDEX_CHECK_PASS');
      return;
    }
    if (result.reason === 'missing') {
      console.error('ERROR manifest ausente: ' + result.outPath);
      console.error('ERROR rode: node scripts/brain-index.mjs');
    } else if (result.reason === 'unparseable') {
      console.error('ERROR manifest ilegivel: ' + result.outPath);
    } else {
      console.error('ERROR manifest desatualizado: ' + result.outPath);
      console.error('  brain_version: ' + shortHash(result.previousBrainVersion ?? '') + ' -> ' + shortHash(manifest.brain_version));
      for (const notePath of result.diff.added) console.error('  + ' + notePath);
      for (const notePath of result.diff.removed) console.error('  - ' + notePath);
      for (const notePath of result.diff.changed) console.error('  ~ ' + notePath);
    }
    console.error('BRAIN_INDEX_CHECK_FAIL (' + result.reason + ')');
    process.exitCode = 1;
    return;
  }

  await writeFile(outPath, serializeManifest(manifest), 'utf8');
  console.log('Brain index: ' + manifest.brain_root + ' (' + manifest.note_count + ' notas, ' + manifest.total_bytes + ' B)');
  console.log('brain_version: ' + manifest.brain_version);
  console.log('manifest: ' + outPath);
  console.log('BRAIN_INDEX_WRITTEN');
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main();
}
