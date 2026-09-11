import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_FILES = [
  '00-HOME.md',
  '01-CURRENT-STATE.md',
  '03-ARCHITECTURE.md',
  '04-DECISIONS.md',
  '06-BUGS.md',
  '07-TESTS.md',
  '08-RISKS.md',
  '09-ASTRA-HANDOFF.md',
  '22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL.md',
  'learning/00-LEARNING-HUB.md',
  'learning/LESSON-INDEX.md',
  'learning/ANTI-PATTERNS.md',
  'learning/VALIDATED-HEURISTICS.md',
  'learning/SKILL-CHANGELOG.md',
];

const IGNORED_DIRECTORIES = new Set(['.obsidian', 'node_modules']);
const WIKILINK_PATTERN = /\[\[([^\]]+)\]\]/g;
const CANONICAL_ID_PATTERN = /\b(?:BUG|DEC|LESSON|AP)-\d+\b/g;

function relativeName(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function collectMarkdownFiles(root, current = root, includeImports = false) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && (IGNORED_DIRECTORIES.has(entry.name) || (!includeImports && entry.name === 'imports'))) continue;

    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(root, absolutePath, includeImports)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(absolutePath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed.at(-1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { hasFrontmatter: false, data: {}, error: null };

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return { hasFrontmatter: true, data: {}, error: 'frontmatter has no closing ---' };
  }

  const data = {};
  const keys = new Set();
  let currentKey = null;

  for (const [index, line] of match[1].split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    if (line.includes('\t')) {
      return { hasFrontmatter: true, data: {}, error: `frontmatter line ${index + 1} contains a tab` };
    }

    const keyMatch = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
    if (keyMatch) {
      const [, indentation, key, rawValue = ''] = keyMatch;
      if (indentation.length === 0) {
        if (keys.has(key)) {
          return { hasFrontmatter: true, data: {}, error: `duplicate frontmatter key ${key}` };
        }
        keys.add(key);
        currentKey = key;
        data[key] = parseScalar(rawValue);
      } else if (!currentKey) {
        return { hasFrontmatter: true, data: {}, error: `nested key ${key} has no parent` };
      }
      continue;
    }

    if (/^\s*-\s+/.test(line) && currentKey) continue;
    if (/^\s+/.test(line) && currentKey) continue;
    return { hasFrontmatter: true, data: {}, error: `unparseable frontmatter line ${index + 1}` };
  }

  return { hasFrontmatter: true, data, error: null };
}

function linkTarget(rawTarget) {
  return rawTarget.split('|')[0].split('#')[0].trim().replaceAll('\\', '/');
}

function resolveWikilink(activeRelativeFiles, rawTarget) {
  const target = linkTarget(rawTarget);
  if (!target) return { target, matches: [] };

  const normalized = target.replace(/^\.\//, '').replace(/\/$/, '');
  const exactMatches = activeRelativeFiles.filter((file) =>
    file.toLowerCase() === normalized.toLowerCase() ||
    file.toLowerCase() === `${normalized.toLowerCase()}.md`,
  );
  if (exactMatches.length > 0) return { target, matches: exactMatches.sort() };

  const candidates = new Set();
  if (!normalized.includes('/')) {
    for (const file of activeRelativeFiles) {
      if (path.posix.basename(file, '.md').toLowerCase() === normalized.toLowerCase()) candidates.add(file);
    }
  }

  return { target, matches: [...candidates].sort() };
}

export async function evaluateBrain(root) {
  const absoluteRoot = path.resolve(root);
  const errors = [];
  const warnings = [];

  if (!(await exists(absoluteRoot))) {
    return { ok: false, root: absoluteRoot, errors: [`brain root not found: ${absoluteRoot}`], warnings: [], stats: {} };
  }

  const allMarkdownFiles = await collectMarkdownFiles(absoluteRoot);
  const relativeFiles = allMarkdownFiles.map((file) => relativeName(absoluteRoot, file));
  const resolutionFiles = (await collectMarkdownFiles(absoluteRoot, absoluteRoot, true)).map((file) => relativeName(absoluteRoot, file));

  for (const required of REQUIRED_FILES) {
    if (!relativeFiles.includes(required)) errors.push(`missing required note: ${required}`);
  }

  const canonicalIds = new Map();
  let linkCount = 0;
  let frontmatterCount = 0;

  for (const absolutePath of allMarkdownFiles) {
    const relativePath = relativeName(absoluteRoot, absolutePath);
    const content = await readFile(absolutePath, 'utf8');
    const frontmatter = parseFrontmatter(content);

    if (frontmatter.hasFrontmatter) {
      frontmatterCount += 1;
      if (frontmatter.error) errors.push(`${relativePath}: ${frontmatter.error}`);
    }

    if (content.includes('TODO_AGENT')) errors.push(`${relativePath}: contains TODO_AGENT`);

    const idsInFile = new Set();
    if (typeof frontmatter.data.id === 'string' && frontmatter.data.id.trim()) {
      idsInFile.add(frontmatter.data.id.trim());
    }
    const headingMatch = content.match(/^#\s+((?:BUG|DEC|LESSON|AP)-\d+)\b/im);
    if (headingMatch) idsInFile.add(headingMatch[1].toUpperCase());
    for (const id of content.match(CANONICAL_ID_PATTERN) ?? []) {
      if (/^LESSON-\d+$/i.test(id) && /^#\s+LESSON-\d+\b/im.test(content)) idsInFile.add(id.toUpperCase());
    }

    for (const id of idsInFile) {
      const owner = canonicalIds.get(id);
      if (owner && owner !== relativePath) {
        errors.push(`duplicate canonical id ${id}: ${owner} and ${relativePath}`);
      } else {
        canonicalIds.set(id, relativePath);
      }
    }

    for (const match of content.matchAll(WIKILINK_PATTERN)) {
      linkCount += 1;
      const { target, matches } = resolveWikilink(resolutionFiles, match[1]);
      if (!target) {
        errors.push(`${relativePath}: empty wikilink`);
      } else if (matches.length === 0) {
        errors.push(`${relativePath}: unresolved wikilink [[${target}]]`);
      } else if (matches.length > 1) {
        errors.push(`${relativePath}: ambiguous wikilink [[${target}]] -> ${matches.join(', ')}`);
      }
    }
  }

  if (!relativeFiles.some((file) => /^12-PROCESS-LOG(?:-.+)?\.md$/i.test(file))) {
    errors.push('missing current session log: expected 12-PROCESS-LOG-*.md');
  }

  if (frontmatterCount === 0) warnings.push('no frontmatter-bearing notes found');

  return {
    ok: errors.length === 0,
    root: absoluteRoot,
    errors,
    warnings,
    stats: {
      markdownFiles: allMarkdownFiles.length,
      frontmatterNotes: frontmatterCount,
      wikilinks: linkCount,
      canonicalIds: canonicalIds.size,
    },
  };
}

function rootFromArgs(args) {
  const index = args.indexOf('--root');
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith('--root='));
  if (inline) return inline.slice('--root='.length);
  return 'docs/brain';
}

async function main() {
  const result = await evaluateBrain(rootFromArgs(process.argv.slice(2)));
  console.log(`Second Brain: ${result.root}`);
  console.log(`Notes: ${result.stats.markdownFiles ?? 0}; wikilinks: ${result.stats.wikilinks ?? 0}; canonical IDs: ${result.stats.canonicalIds ?? 0}`);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
  if (result.ok) {
    console.log('BRAIN_CHECK_PASS');
  } else {
    console.error(`BRAIN_CHECK_FAIL (${result.errors.length} error${result.errors.length === 1 ? '' : 's'})`);
    process.exitCode = 1;
  }
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main();
}
