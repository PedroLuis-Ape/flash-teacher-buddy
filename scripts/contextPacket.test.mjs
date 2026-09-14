import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { buildManifest, checkManifest, serializeManifest } from './brain-index.mjs';
import { appendEvent, estimateTokens, readLedger, summarize } from './brain-telemetry.mjs';
import {
  applyPatchOps,
  buildPacket,
  hashPacket,
  PACKET_FIELDS,
  renderMarkdown,
  validatePacket,
  withHash,
} from './context-packet.mjs';

const run = promisify(execFile);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoots = [];

async function temporaryDirectory(prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

async function createBrain(files) {
  const root = await temporaryDirectory('piteco-brain-index-');
  for (const entry of Object.entries(files)) {
    const target = path.join(root, entry[0]);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, entry[1], 'utf8');
  }
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const BRAIN_FILES = {
  '00-HOME.md': '---\ntype: home\n---\n\n# Home do brain\n\nIndice de contexto do projeto.\n\n[[10-CONTEXT-FEEDING-RULE]]\n',
  '01-CURRENT-STATE.md': '---\ntype: current-state\narea: visual-polish\n---\n\n# Current State\n\nFotografia factual do trabalho.\n',
  '04-DECISIONS.md': '---\nstatus: active\n---\n\n# Decisoes\n\nDecisoes que nao devem ser revertidas.\n',
  '06-BUGS.md': '---\n---\n\n# Bugs e achados\n\nBug aberto com causa-raiz pendente.\n',
  '07-TESTS.md': '---\ntype: evidence\narea: quality\n---\n\n# Testes e evidencias\n\nEvidencia de execucao real.\n',
  '08-RISKS.md': '---\ntype: risk-register\narea: release\n---\n\n# Riscos\n\nRiscos de integracao e publicacao.\n',
  '10-CONTEXT-FEEDING-RULE.md': '---\ntype: protocol\narea: knowledge-management\nlast_reviewed: 2026-09-12\n---\n\n# START HERE\n\nProtocolo de contexto do projeto.\n',
  'areas/study-resume.md':
    '---\ntype: area\ndomain: study-resume\nstatus: active\nlast_reviewed: 2026-09-13\n---\n\n# Retomada de estudo\n\nFonte de verdade da retomada de sessao.\n\nCORPO_INTERNO_NAO_DEVE_ENTRAR_NO_PACKET: ' + 'y'.repeat(500) + '\n',
  'sessions/2026-09-13-exemplo.md': '---\ntype: session\narea: study-resume\n---\n\n# Sessao de exemplo\n\nRegistro de sessao.\n',
};

describe('brain-index', () => {
  it('gera manifesto deterministico, ordenado e apenas com metadados', async () => {
    const root = await createBrain(BRAIN_FILES);
    const first = serializeManifest(await buildManifest(root));
    const second = serializeManifest(await buildManifest(root));

    expect(first).toBe(second);
    const manifest = JSON.parse(first);
    const paths = manifest.notes.map((note) => note.path);
    expect(paths).toEqual([...paths].sort());
    expect(manifest.note_count).toBe(9);
    expect(manifest.brain_version).toMatch(/^[0-9a-f]{64}$/);

    const area = manifest.notes.find((note) => note.path === 'areas/study-resume.md');
    expect(area.domain).toBe('study-resume');
    expect(area.canonical).toBe(true);
    expect(area.canonical_document).toBe('areas/study-resume.md');
    expect(area.type).toBe('area');
    expect(area.last_reviewed).toBe('2026-09-13');
    expect(area.description).toBe('Fonte de verdade da retomada de sessao.');
    expect(area.bytes).toBeGreaterThan(0);
    expect(area.sha256).toMatch(/^[0-9a-f]{64}$/);

    const bugs = manifest.notes.find((note) => note.path === '06-BUGS.md');
    expect(bugs.domain).toBe('bugs');
    expect(bugs.canonical).toBe(true);
    expect(manifest.canonical_documents.bugs.path).toBe('06-BUGS.md');
    expect(manifest.domains['study-resume'].notes).toBe(2);
    expect(first).not.toContain('Fonte de verdade da retomada de sessao.\n\nFonte');
  });

  it('detecta manifesto desatualizado em --check e mudanca de brain_version', async () => {
    const root = await createBrain(BRAIN_FILES);
    const out = path.join(root, 'brain-manifest.json');
    const manifest = await buildManifest(root);
    await writeFile(out, serializeManifest(manifest), 'utf8');

    const current = await checkManifest({ root, out });
    expect(current.ok).toBe(true);

    await writeFile(
      path.join(root, '06-BUGS.md'),
      '---\n---\n\n# Bugs e achados\n\nBug aberto com causa-raiz demonstrada.\n',
      'utf8',
    );
    const stale = await checkManifest({ root, out });
    expect(stale.ok).toBe(false);
    expect(stale.reason).toBe('stale');
    expect(stale.diff.changed).toEqual(['06-BUGS.md']);
    expect(stale.manifest.brain_version).not.toBe(manifest.brain_version);
  });
});

function packetOptions(manifest, overrides = {}) {
  return {
    manifest,
    manifestPath: 'docs/brain/brain-manifest.json',
    taskId: 'tarefa-teste',
    objective: 'validar o packet',
    actor: 'main',
    at: '2026-09-13T12:00:00.000Z',
    domains: ['study-resume'],
    files: ['src/features/study/lib/studyResumeQuery.ts'],
    project: 'App Piteco / APE Education',
    rules: [],
    architecture: [],
    contracts: [],
    decisions: [],
    risks: [],
    doNotBreak: [],
    uncertainties: [],
    explicitPaths: [],
    maxRefs: 12,
    ...overrides,
  };
}

describe('context-packet', () => {
  it('cria packet compacto com os 11 campos, refs com sha e hash proprio', async () => {
    const root = await createBrain(BRAIN_FILES);
    const manifest = await buildManifest(root);
    const packet = withHash(buildPacket(packetOptions(manifest)));

    expect(Object.keys(packet.fields)).toEqual(PACKET_FIELDS);
    expect(packet.fields.PROJECT).toEqual(['App Piteco / APE Education']);
    expect(packet.fields.OBJECTIVE).toEqual(['validar o packet']);
    expect(packet.fields.DO_NOT_BREAK.length).toBeGreaterThan(0);
    expect(packet.fields.FILES_MODULES).toEqual(['src/features/study/lib/studyResumeQuery.ts']);
    expect(packet.refs.map((ref) => ref.path)).toContain('10-CONTEXT-FEEDING-RULE.md');
    expect(packet.refs.map((ref) => ref.path)).toContain('areas/study-resume.md');
    expect(packet.refs.map((ref) => ref.path)).not.toContain('sessions/2026-09-13-exemplo.md');
    for (const ref of packet.refs) {
      expect(ref.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(ref.bytes).toBeGreaterThan(0);
    }
    expect(packet.packet_hash).toBe(hashPacket(packet));

    const markdown = renderMarkdown(packet);
    expect(markdown).toContain('# CONTEXT PACKET - tarefa-teste');
    expect(markdown).toContain('## DO_NOT_BREAK');
    expect(markdown).toContain('areas/study-resume.md | sha ' + packet.refs.find((ref) => ref.path === 'areas/study-resume.md').sha256.slice(0, 8));

    const compact = Buffer.byteLength(markdown, 'utf8');
    expect(compact).toBeGreaterThan(0);
    // O packet carrega metadados e ponteiros, nao o corpo das notas.
    expect(markdown).not.toContain('CORPO_INTERNO_NAO_DEVE_ENTRAR_NO_PACKET');

    const huge = { ...BRAIN_FILES };
    for (let index = 0; index < 30; index += 1) {
      huge['areas/filler-' + index + '.md'] =
        '---\ntype: area\ndomain: area\nstatus: active\n---\n\n# Filler ' + index + '\n\n' + 'x'.repeat(8000) + '\n';
    }
    const hugeManifest = await buildManifest(await createBrain(huge));
    const hugePacket = withHash(buildPacket(packetOptions(hugeManifest)));
    const hugeCompact = Buffer.byteLength(renderMarkdown(hugePacket), 'utf8');

    // O packet cresce com os refs selecionados, nao com o tamanho do vault.
    expect(hugeManifest.total_bytes).toBeGreaterThan(manifest.total_bytes * 50);
    expect(hugeCompact).toBeLessThan(compact * 1.1);
    expect(hugePacket.refs.length).toBe(packet.refs.length);
  });

  it('patcha campo e ref sem reconstruir e mantem hash coerente', async () => {
    const root = await createBrain(BRAIN_FILES);
    const manifest = await buildManifest(root);
    const packet = withHash(buildPacket(packetOptions(manifest)));
    const before = renderMarkdown(packet);

    const patched = withHash(
      applyPatchOps(packet, {
        manifest,
        at: '2026-09-13T12:30:00.000Z',
        actor: 'worker',
        reason: 'lacuna material encontrada na execucao',
        ops: [
          { kind: 'append', field: 'OPEN_UNCERTAINTIES', value: 'sem cobertura de teste para escopo anon' },
          { kind: 'set', field: 'CONTRACTS', value: 'refresh preserva a sessao exata do aparelho' },
        ],
        refAdd: ['06-BUGS.md'],
        refRemove: ['04-DECISIONS.md'],
      }),
    );

    expect(patched.patch_count).toBe(1);
    expect(patched.patch_log).toHaveLength(1);
    expect(patched.updated_at).toBe('2026-09-13T12:30:00.000Z');
    expect(patched.brain_version).toBe(packet.brain_version);
    expect(patched.packet_hash).toBe(hashPacket(patched));
    expect(patched.packet_hash).not.toBe(packet.packet_hash);
    expect(patched.fields.OPEN_UNCERTAINTIES).toContain('sem cobertura de teste para escopo anon');
    expect(patched.fields.CONTRACTS).toEqual(['refresh preserva a sessao exata do aparelho']);
    expect(patched.refs.map((ref) => ref.path)).toContain('06-BUGS.md');
    expect(patched.refs.map((ref) => ref.path)).not.toContain('04-DECISIONS.md');
    expect(renderMarkdown(patched)).not.toBe(before);
    expect(patched.fields.RELEVANT_RULES).toEqual(packet.fields.RELEVANT_RULES);
  });

  it('valida FRESH, DRIFT e STALE conforme a mudanca do brain', async () => {
    const root = await createBrain(BRAIN_FILES);
    const manifest = await buildManifest(root);
    const packet = withHash(buildPacket(packetOptions(manifest)));

    expect(validatePacket(packet, manifest).result).toBe('FRESH');

    const drifted = { ...manifest, brain_version: 'f'.repeat(64) };
    const drift = validatePacket(packet, drifted);
    expect(drift.result).toBe('DRIFT');
    expect(drift.material).toBe(false);
    expect(drift.findings.map((finding) => finding.code)).toEqual(['BRAIN_DRIFT']);

    const changedNote = 'areas/study-resume.md';
    await writeFile(
      path.join(root, changedNote),
      '---\ntype: area\ndomain: study-resume\nstatus: active\nlast_reviewed: 2026-09-13\n---\n\n# Retomada de estudo\n\nFonte de verdade alterada.\n\nCORPO_INTERNO_NAO_DEVE_ENTRAR_NO_PACKET: ' + 'y'.repeat(500) + '\n',
      'utf8',
    );
    const nextManifest = await buildManifest(root);
    const stale = validatePacket(packet, nextManifest);
    expect(stale.result).toBe('STALE');
    expect(stale.material).toBe(true);
    expect(stale.findings.some((finding) => finding.code === 'REF_CHANGED' && finding.detail.includes(changedNote))).toBe(true);

    const tampered = { ...packet, fields: { ...packet.fields, OBJECTIVE: ['outro objetivo'] } };
    const integrity = validatePacket(tampered, nextManifest);
    expect(integrity.findings.some((finding) => finding.code === 'INTEGRITY_MISMATCH')).toBe(true);
  });

  it('nao inclui nota historica nem de sessao por padrao', async () => {
    const root = await createBrain({
      ...BRAIN_FILES,
      'imports/2026-09-11/antigo.md': '---\n---\n\n# Nota historica importada\n\nConteudo antigo.\n',
    });
    const manifest = await buildManifest(root);
    const packet = withHash(buildPacket(packetOptions(manifest, { domains: ['study-resume', 'historical-import'], includeSessions: false })));
    const refs = packet.refs.map((ref) => ref.path);
    expect(refs).not.toContain('imports/2026-09-11/antigo.md');
    expect(refs).not.toContain('sessions/2026-09-13-exemplo.md');

    const withHistory = withHash(
      buildPacket(packetOptions(manifest, { domains: ['study-resume'], includeHistorical: true, explicitPaths: ['imports/2026-09-11/antigo.md'] })),
    );
    expect(withHistory.refs.map((ref) => ref.path)).toContain('imports/2026-09-11/antigo.md');
  });
});

describe('brain-telemetry', () => {
  it('registra ledger append-only e agrega os contadores por tarefa e etapa', async () => {
    const root = await temporaryDirectory('piteco-brain-telemetry-');
    const ledger = path.join(root, 'ledger.jsonl');

    expect(estimateTokens(400)).toBe(100);
    expect(estimateTokens(401)).toBe(101);
    expect(estimateTokens(0)).toBe(0);

    await appendEvent(
      { task: 't1', stage: 'before', actor: 'main', event: 'brain_read', bytes: 4000, files: ['a.md', 'b.md'] },
      { ledger, at: '2026-09-13T10:00:00.000Z' },
    );
    await appendEvent(
      { task: 't1', stage: 'before', actor: 'worker', event: 'brain_read', bytes: 2000, files: ['a.md'] },
      { ledger, at: '2026-09-13T10:01:00.000Z' },
    );
    await appendEvent(
      { task: 't1', stage: 'after', actor: 'main', event: 'packet_new', bytes: 800, tokens: 200 },
      { ledger, at: '2026-09-13T11:00:00.000Z' },
    );
    await appendEvent(
      { task: 't1', stage: 'after', actor: 'worker', created_by: 'main', event: 'packet_show', bytes: 800, tokens: 200 },
      { ledger, at: '2026-09-13T11:01:00.000Z' },
    );
    await appendEvent(
      { task: 't1', stage: 'after', actor: 'reviewer', event: 'brain_read', on_demand: true, bytes: 1200, files: ['06-BUGS.md'] },
      { ledger, at: '2026-09-13T11:02:00.000Z' },
    );
    await appendEvent(
      { task: 't1', stage: 'after', actor: 'reviewer', event: 'packet_patch', bytes: 900, tokens: 225, reason: 'lacuna material' },
      { ledger, at: '2026-09-13T11:03:00.000Z' },
    );
    await appendEvent(
      { task: 't1', stage: 'after', actor: 'main', event: 'packet_invalidation', reason: 'contrato alterado' },
      { ledger, at: '2026-09-13T11:04:00.000Z' },
    );

    const loaded = await readLedger(ledger);
    expect(loaded.events).toHaveLength(7);
    expect(loaded.invalidLines).toBe(0);

    const before = summarize(loaded.events, { task: 't1', stage: 'before' });
    expect(before.brain_reads).toBe(2);
    expect(before.brain_files_read).toBe(3);
    expect(before.brain_tokens_loaded).toBe(1500);
    expect(before.total_agent_tokens).toBe(1500);

    const after = summarize(loaded.events, { task: 't1', stage: 'after' });
    expect(after.brain_reads).toBe(1);
    expect(after.context_on_demand_reads).toBe(1);
    expect(after.context_packet_tokens).toBe(625);
    expect(after.context_reuse_count).toBe(1);
    expect(after.context_patch_count).toBe(1);
    expect(after.context_invalidations).toBe(1);
    expect(after.invalidation_reason).toEqual(['contrato alterado']);
    expect(after.total_agent_tokens).toBe(300 + 625);
  });

  it('faz append sem reescrever o ledger', async () => {
    const root = await temporaryDirectory('piteco-brain-append-');
    const ledger = path.join(root, 'ledger.jsonl');
    await appendEvent({ task: 't2', stage: 'main', event: 'note', bytes: 4 }, { ledger });
    const first = await readFile(ledger, 'utf8');
    await appendEvent({ task: 't2', stage: 'main', event: 'note', bytes: 4 }, { ledger });
    const second = await readFile(ledger, 'utf8');
    expect(second.startsWith(first)).toBe(true);
    expect(second.trim().split('\n')).toHaveLength(2);
  });
});

describe('cli do protocolo de contexto', () => {
  it('roda new, validate, patch e validate pela linha de comando', async () => {
    const root = await temporaryDirectory('piteco-brain-cli-');
    const ledger = path.join(root, 'ledger.jsonl');
    const packet = path.join(root, 'cli.packet.json');
    const options = { cwd: REPO_ROOT };

    const created = await run(process.execPath, [
      'scripts/context-packet.mjs',
      'new',
      '--task',
      'cli-teste',
      '--objective',
      'validar cli',
      '--domain',
      'quality',
      '--out',
      packet,
      '--ledger',
      ledger,
      '--at',
      '2026-09-13T09:00:00.000Z',
      '--no-core',
    ], options);
    expect(created.stdout).toContain('PACKET_WRITTEN');

    const fresh = await run(process.execPath, [
      'scripts/context-packet.mjs',
      'validate',
      '--packet',
      packet,
      '--ledger',
      ledger,
      '--record',
    ], options);
    expect(fresh.stdout).toContain('PACKET_FRESH');

    const patched = await run(process.execPath, [
      'scripts/context-packet.mjs',
      'patch',
      '--packet',
      packet,
      '--append',
      'OPEN_UNCERTAINTIES=falta evidencia de browser',
      '--reason',
      'lacuna material',
      '--ledger',
      ledger,
    ], options);
    expect(patched.stdout).toContain('PATCH_APPLIED');

    const shown = await run(process.execPath, [
      'scripts/context-packet.mjs',
      'show',
      '--packet',
      packet,
      '--actor',
      'reviewer',
      '--ledger',
      ledger,
    ], options);
    expect(shown.stdout).toContain('falta evidencia de browser');

    const ledgerEvents = await readLedger(ledger);
    const events = ledgerEvents.events.map((event) => event.event);
    expect(events).toContain('packet_new');
    expect(events).toContain('packet_validate');
    expect(events).toContain('packet_patch');
    expect(events).toContain('packet_show');

    const reuse = summarize(ledgerEvents.events, { stage: 'share' });
    expect(reuse.context_reuse_count).toBe(1);
  });

  it('brain-index --check falha quando o manifesto esta ausente', async () => {
    const root = await temporaryDirectory('piteco-brain-index-cli-');
    const manifestPath = path.join(root, 'brain-manifest.json');
    await expect(
      run(process.execPath, ['scripts/brain-index.mjs', '--root', path.resolve(REPO_ROOT, 'docs/brain'), '--out', manifestPath, '--check'], {
        cwd: REPO_ROOT,
      }),
    ).rejects.toMatchObject({ code: 1 });
  });
});
