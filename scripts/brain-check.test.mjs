import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { evaluateBrain } from './brain-check.mjs';

const temporaryRoots = [];

async function createBrain(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'piteco-brain-check-'));
  temporaryRoots.push(root);
  await mkdir(path.join(root, 'learning', 'lessons'), { recursive: true });
  for (const [relativePath, contents] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents, 'utf8');
  }
  return root;
}

const core = {
  '00-HOME.md': '---\ntype: home\n---\n# Home\n[[01-CURRENT-STATE]] [[learning/00-LEARNING-HUB]]\n',
  '01-CURRENT-STATE.md': '---\ntype: current-state\n---\n# Current state\n[[03-ARCHITECTURE]]\n',
  '03-ARCHITECTURE.md': '---\ntype: architecture\n---\n# Architecture\n',
  '04-DECISIONS.md': '---\ntype: decisions\n---\n# Decisions\n',
  '06-BUGS.md': '---\ntype: bugs\n---\n# Bugs\n',
  '07-TESTS.md': '---\ntype: tests\n---\n# Tests\n',
  '08-RISKS.md': '---\ntype: risks\n---\n# Risks\n',
  '09-ASTRA-HANDOFF.md': '---\ntype: handoff\n---\n# Handoff\n',
  '22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL.md': '---\ntype: protocol\n---\n# Protocol\n',
  '12-PROCESS-LOG-2099-01-01.md': '---\ntype: session-log\n---\n# Session\n',
  'learning/00-LEARNING-HUB.md': '---\ntype: learning-hub\n---\n# Learning hub\n[[learning/LESSON-INDEX]]\n',
  'learning/LESSON-INDEX.md': '---\ntype: lesson-index\n---\n# Lesson index\n',
  'learning/ANTI-PATTERNS.md': '---\ntype: anti-patterns\n---\n# Anti-patterns\n',
  'learning/VALIDATED-HEURISTICS.md': '---\ntype: heuristics\n---\n# Heuristics\n',
  'learning/SKILL-CHANGELOG.md': '---\ntype: skill-changelog\n---\n# Skill changelog\n',
};

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('brain:check', () => {
  it('accepts a connected brain with valid frontmatter and unique IDs', async () => {
    const root = await createBrain({
      ...core,
      'learning/lessons/LESSON-001.md': '---\ntype: lesson\nid: LESSON-001\nstatus: candidate\nrelated:\n  - "[[01-CURRENT-STATE]]"\n---\n# LESSON-001 — Test\n',
    });

    const result = await evaluateBrain(root);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports unresolved links, duplicate canonical IDs, and agent placeholders', async () => {
    const root = await createBrain({
      ...core,
      'learning/lessons/LESSON-001-a.md': '---\ntype: lesson\nid: LESSON-001\n---\n# LESSON-001 — A\n[[missing-note]] TODO_AGENT\n',
      'learning/lessons/LESSON-001-b.md': '---\ntype: lesson\nid: LESSON-001\n---\n# LESSON-001 — B\n',
    });

    const result = await evaluateBrain(root);
    const errors = result.errors.join('\n');

    expect(result.ok).toBe(false);
    expect(errors).toContain('unresolved wikilink');
    expect(errors).toContain('duplicate canonical id LESSON-001');
    expect(errors).toContain('TODO_AGENT');
  });
});
