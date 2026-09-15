/**
 * context-packet.mjs - CONTEXT PACKET compacto do Segundo Cerebro do App Piteco.
 *
 * Protocolo: READ ONCE -> COMPACT -> SHARE -> REUSE.
 * O packet e o artefato COMPARTILHAVEL entre main, worker e reviewer. Ele nao
 * copia o vault: carrega os campos de decisao (regras, contratos, riscos,
 * arquivos, "nao quebrar", incertezas) mais PONTEIROS com sha256 de cada nota
 * relevante. Quem precisa de mais detalhe faz retrieval sob demanda de UMA nota
 * (subcomando "read") e PATCH no packet - nunca reconstrucao.
 *
 * Campos: PROJECT, OBJECTIVE, BRAIN_VERSION, RELEVANT_RULES,
 * RELEVANT_ARCHITECTURE, CONTRACTS, DECISIONS, KNOWN_RISKS, FILES_MODULES,
 * DO_NOT_BREAK, OPEN_UNCERTAINTIES.
 *
 * Subcomandos:
 *   new       cria o packet a partir do manifesto (docs/brain/brain-manifest.json)
 *   patch     adiciona/atualiza um campo sem reconstruir o packet
 *   validate  compara brain_version/hash do manifesto atual (staleness material)
 *   show      imprime o packet (markdown compacto ou --json)
 *   read      retrieval sob demanda de UMA nota, registrado na telemetria
 *
 * Tokens: estimativa declarada tokens = ceil(bytes/4).
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendEvent,
  estimateTokens,
  readLedger,
  resolveLedgerPath,
  summarize,
  TOKEN_ESTIMATOR,
} from './brain-telemetry.mjs';
import { buildManifest, DEFAULT_OUT as DEFAULT_MANIFEST, resolveRoot, sha256OfText, shortHash } from './brain-index.mjs';

export const PACKET_VERSION = 1;
export const DEFAULT_PACKET_DIR = '.superpowers/sdd/context-packets';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PACKET_FIELDS = [
  'PROJECT',
  'OBJECTIVE',
  'BRAIN_VERSION',
  'RELEVANT_RULES',
  'RELEVANT_ARCHITECTURE',
  'CONTRACTS',
  'DECISIONS',
  'KNOWN_RISKS',
  'FILES_MODULES',
  'DO_NOT_BREAK',
  'OPEN_UNCERTAINTIES',
];

const SINGLE_LINE_FIELDS = new Set(['PROJECT', 'OBJECTIVE', 'BRAIN_VERSION']);

/** Dominio -> secao do packet onde os ponteiros daquele dominio aparecem. */
const DOMAIN_SECTIONS = {
  'knowledge-management': 'RELEVANT_RULES',
  'agent-operations': 'RELEVANT_RULES',
  'repository-operations': 'DO_NOT_BREAK',
  'current-state': 'RELEVANT_ARCHITECTURE',
  planning: 'RELEVANT_ARCHITECTURE',
  architecture: 'RELEVANT_ARCHITECTURE',
  handoff: 'RELEVANT_ARCHITECTURE',
  decisions: 'DECISIONS',
  bugs: 'KNOWN_RISKS',
  release: 'KNOWN_RISKS',
  quality: 'CONTRACTS',
  security: 'CONTRACTS',
};

/** Notas nucleares que entram em qualquer packet, salvo --no-core. */
const CORE_REFS = [
  { path: '10-CONTEXT-FEEDING-RULE.md', section: 'RELEVANT_RULES', reason: 'protocolo de contexto vigente' },
  { path: '04-DECISIONS.md', section: 'DECISIONS', reason: 'decisoes vigentes nao revertidas por engano' },
  { path: '08-RISKS.md', section: 'KNOWN_RISKS', reason: 'riscos conhecidos e limites' },
  { path: '07-TESTS.md', section: 'CONTRACTS', reason: 'evidencias e contratos de regressao' },
];

const BASELINE_RULES = [
  'READ ONCE: o Segundo Cerebro e lido uma vez por tarefa; o restante vem deste packet ou de retrieval sob demanda.',
  'Subagente que recebe packet valido NAO refaz o preflight completo; presume valido ate evidencia contraria.',
  'Invalidacao do packet somente por mudanca material (objetivo, brain_version, contratos, dominio) - nunca por tempo arbitrario.',
  'Faltou informacao material: retrieval de UMA nota (context-packet read) + PATCH, nunca reconstrucao.',
];

const BASELINE_DO_NOT_BREAK = [
  'Nao trocar Supabase project refs, Auth, RLS, RPCs ou fronteira publico/privado sem tarefa explicita, teste especifico e rollback.',
  'Nao criar dado ficticio para mascarar falha de descoberta publica.',
  'Nao commitar, pushar, publicar ou migrar producao automaticamente; publicacao e exclusiva da Lovable.',
  'Preservar identidade visual, privacidade, acessibilidade e compatibilidade mobile.',
];

function comparePaths(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function toRelative(from, target) {
  const relative = path.relative(from, target).split(path.sep).join('/');
  return relative || '.';
}

export function resolveFromRepo(target) {
  return path.isAbsolute(target) ? target : path.resolve(REPO_ROOT, target);
}

export function emptyFields() {
  const fields = {};
  for (const field of PACKET_FIELDS) fields[field] = [];
  return fields;
}

export function normalizeFields(fields) {
  const normalized = {};
  for (const field of PACKET_FIELDS) normalized[field] = [...((fields ?? {})[field] ?? [])];
  return normalized;
}

export function packetBody(packet) {
  return {
    packet_version: packet.packet_version,
    task_id: packet.task_id,
    created_by: packet.created_by,
    created_at: packet.created_at,
    updated_at: packet.updated_at,
    brain_root: packet.brain_root,
    brain_version: packet.brain_version,
    manifest_path: packet.manifest_path,
    token_estimator: packet.token_estimator,
    fields: normalizeFields(packet.fields),
    refs: [...packet.refs].sort((left, right) => comparePaths(left.path, right.path)),
    patch_count: packet.patch_count ?? 0,
    patch_log: packet.patch_log ?? [],
  };
}

export function hashPacket(packet) {
  return sha256OfText(JSON.stringify(packetBody(packet)));
}

export function withHash(packet) {
  const body = packetBody(packet);
  body.packet_hash = hashPacket(packet);
  return body;
}

export function refLine(ref) {
  const flags = [];
  if (ref.canonical) flags.push('canonical');
  flags.push(ref.domain);
  return (
    '- ' +
    ref.path +
    ' | sha ' +
    shortHash(ref.sha256) +
    ' | ' +
    ref.bytes +
    ' B | ' +
    flags.join(', ') +
    ' | ' +
    ref.description
  );
}

export function renderMarkdown(packet) {
  const body = withHash(packet);
  const lines = [];
  lines.push('# CONTEXT PACKET - ' + body.task_id);
  lines.push('');
  lines.push(
    'PACKET_HASH: ' +
      shortHash(body.packet_hash) +
      ' | brain_version: ' +
      shortHash(body.brain_version) +
      ' | refs: ' +
      body.refs.length,
  );
  lines.push('TOKEN_ESTIMATOR: ' + TOKEN_ESTIMATOR + ' (tokens = ceil(bytes/4))');
  lines.push('');
  for (const field of PACKET_FIELDS) {
    const values = body.fields[field];
    lines.push('## ' + field);
    if (!values.length) {
      lines.push(SINGLE_LINE_FIELDS.has(field) ? '(nao definido)' : '(nenhum)');
    } else if (SINGLE_LINE_FIELDS.has(field)) {
      for (const value of values) lines.push(value);
    } else {
      for (const value of values) lines.push(value.startsWith('- ') ? value : '- ' + value);
    }
    lines.push('');
  }
  lines.push('## REFS');
  for (const field of PACKET_FIELDS) {
    const refs = body.refs.filter((ref) => ref.section === field);
    if (!refs.length) continue;
    lines.push('### ' + field);
    for (const ref of refs) lines.push(refLine(ref));
    lines.push('');
  }
  lines.push('Leitura sob demanda: node scripts/context-packet.mjs read --packet <arquivo> --note-path <nota>');
  lines.push('Depois do retrieval: patch do packet, nunca reconstrucao.');
  return lines.join('\n') + '\n';
}

export function sectionForDomain(domain) {
  return DOMAIN_SECTIONS[domain] ?? 'RELEVANT_ARCHITECTURE';
}

export function selectRefs(manifest, options = {}) {
  const domains = new Set(options.domains ?? []);
  const includeHistorical = options.includeHistorical === true;
  const includeSessions = options.includeSessions === true;
  const maxRefs = Number.isFinite(options.maxRefs) ? options.maxRefs : 12;
  const explicit = new Set(options.explicitPaths ?? []);

  const candidates = manifest.notes.filter((note) => {
    if (explicit.has(note.path)) return true;
    if (note.historical && !includeHistorical) return false;
    if (note.path.startsWith('sessions/') && !includeSessions) return false;
    if (note.path.startsWith('templates/') || note.path.startsWith('learning/templates/')) return false;
    if (note.bytes === 0) return false;
    if (domains.size === 0) return false;
    return domains.has(note.domain);
  });

  candidates.sort((left, right) => {
    const priority = (left.canonical ? 0 : 1) - (right.canonical ? 0 : 1);
    if (priority !== 0) return priority;
    const leftReview = left.last_reviewed ?? '';
    const rightReview = right.last_reviewed ?? '';
    if (leftReview !== rightReview) return rightReview < leftReview ? -1 : 1;
    return comparePaths(left.path, right.path);
  });

  const selected = candidates.slice(0, maxRefs);
  const selectedPaths = new Set(selected.map((note) => note.path));
  for (const notePath of explicit) {
    if (selectedPaths.has(notePath)) continue;
    const note = manifest.notes.find((entry) => entry.path === notePath);
    if (note) selected.push(note);
  }

  return selected.map((note) => ({
    path: note.path,
    sha256: note.sha256,
    bytes: note.bytes,
    domain: note.domain,
    canonical: note.canonical,
    description: note.description || note.title || note.type,
    section: (options.sectionOverrides ?? {})[note.path] ?? sectionForDomain(note.domain),
    reason: 'selecionado por dominio ' + note.domain,
  }));
}

function mergeRefs(refs) {
  const byPath = new Map();
  for (const ref of refs) {
    if (!byPath.has(ref.path)) byPath.set(ref.path, ref);
  }
  return [...byPath.values()].sort((left, right) => comparePaths(left.path, right.path));
}

export function buildPacket(options) {
  const manifest = options.manifest;
  const fields = emptyFields();
  const domains = options.domains ?? [];
  const refs = [];

  if (!options.noCore) {
    for (const core of CORE_REFS) {
      const note = manifest.notes.find((entry) => entry.path === core.path);
      if (!note) continue;
      refs.push({
        path: note.path,
        sha256: note.sha256,
        bytes: note.bytes,
        domain: note.domain,
        canonical: note.canonical,
        description: note.description || note.title || note.type,
        section: core.section,
        reason: core.reason,
      });
    }
  }

  refs.push(
    ...selectRefs(manifest, {
      domains,
      includeHistorical: options.includeHistorical,
      includeSessions: options.includeSessions,
      maxRefs: options.maxRefs,
      explicitPaths: options.explicitPaths,
    }),
  );

  const mergedRefs = mergeRefs(refs);

  fields.PROJECT = [options.project];
  fields.OBJECTIVE = [options.objective];
  fields.BRAIN_VERSION = [
    shortHash(manifest.brain_version) + ' (' + manifest.brain_root + ' @ ' + manifest.note_count + ' notas)',
  ];
  fields.RELEVANT_RULES = [...BASELINE_RULES, ...(options.rules ?? [])];
  fields.RELEVANT_ARCHITECTURE = [...(options.architecture ?? [])];
  fields.CONTRACTS = [...(options.contracts ?? [])];
  fields.DECISIONS = [...(options.decisions ?? [])];
  fields.KNOWN_RISKS = [...(options.risks ?? [])];
  fields.FILES_MODULES = [...(options.files ?? [])];
  fields.DO_NOT_BREAK = [...BASELINE_DO_NOT_BREAK, ...(options.doNotBreak ?? [])];
  fields.OPEN_UNCERTAINTIES = [
    domains.length
      ? 'Nao revalidado nesta tarefa: ' + domains.join(', ') + ' (ponteiros com sha no packet).'
      : 'Nenhum dominio foi selecionado explicitamente; o packet contem apenas o nucleo.',
    ...(options.uncertainties ?? []),
  ];

  return {
    packet_version: PACKET_VERSION,
    task_id: options.taskId,
    created_by: options.actor,
    created_at: options.at,
    updated_at: options.at,
    brain_root: manifest.brain_root,
    brain_version: manifest.brain_version,
    manifest_path: options.manifestPath,
    token_estimator: TOKEN_ESTIMATOR,
    fields,
    refs: mergedRefs,
    patch_count: 0,
    patch_log: [],
  };
}

export function applyPatchOps(packet, options) {
  const fields = normalizeFields(packet.fields);
  const ops = [];
  for (const op of options.ops ?? []) {
    if (!PACKET_FIELDS.includes(op.field)) throw new Error('campo desconhecido: ' + op.field);
    if (op.kind === 'set') {
      fields[op.field] = [op.value];
      ops.push('set ' + op.field);
    } else if (op.kind === 'append') {
      fields[op.field].push(op.value);
      ops.push('append ' + op.field);
    } else if (op.kind === 'clear') {
      fields[op.field] = [];
      ops.push('clear ' + op.field);
    }
  }

  let refs = [...packet.refs];
  for (const refPath of options.refRemove ?? []) {
    const before = refs.length;
    refs = refs.filter((ref) => ref.path !== refPath);
    if (refs.length !== before) ops.push('ref-remove ' + refPath);
  }
  for (const refPath of options.refAdd ?? []) {
    const note = options.manifest.notes.find((entry) => entry.path === refPath);
    if (!note) throw new Error('nota nao encontrada no manifesto: ' + refPath);
    refs = refs.filter((ref) => ref.path !== refPath);
    refs.push({
      path: note.path,
      sha256: note.sha256,
      bytes: note.bytes,
      domain: note.domain,
      canonical: note.canonical,
      description: note.description || note.title || note.type,
      section: sectionForDomain(note.domain),
      reason: 'adicionado por patch: ' + options.reason,
    });
    ops.push('ref-add ' + refPath);
  }

  let brainVersion = packet.brain_version;
  if (options.rebase) {
    brainVersion = options.manifest.brain_version;
    refs = refs.map((ref) => {
      const note = options.manifest.notes.find((entry) => entry.path === ref.path);
      if (!note) return ref;
      return { ...ref, sha256: note.sha256, bytes: note.bytes };
    });
    fields.BRAIN_VERSION = [
      shortHash(options.manifest.brain_version) +
        ' (' +
        options.manifest.brain_root +
        ' @ ' +
        options.manifest.note_count +
        ' notas, rebase explicito)',
    ];
    ops.push('rebase brain_version');
  }

  return {
    ...packet,
    updated_at: options.at,
    brain_version: brainVersion,
    fields,
    refs: mergeRefs(refs),
    patch_count: (packet.patch_count ?? 0) + 1,
    patch_log: [
      ...(packet.patch_log ?? []),
      { at: options.at, actor: options.actor, reason: options.reason, ops },
    ],
  };
}

export function validatePacket(packet, manifest) {
  const findings = [];
  const computedHash = hashPacket(packet);
  if (computedHash !== packet.packet_hash) {
    findings.push({ code: 'INTEGRITY_MISMATCH', detail: 'packet_hash nao corresponde ao conteudo atual' });
  }

  if (manifest.brain_version !== packet.brain_version) {
    findings.push({ code: 'BRAIN_DRIFT', detail: 'brain_version do manifesto mudou (fora dos refs do packet)' });
  }

  const notes = new Map(manifest.notes.map((note) => [note.path, note]));
  for (const ref of packet.refs) {
    const note = notes.get(ref.path);
    if (!note) {
      findings.push({ code: 'REF_MISSING', detail: ref.path });
      continue;
    }
    if (note.sha256 !== ref.sha256) {
      findings.push({
        code: 'REF_CHANGED',
        detail: ref.path + ' (' + shortHash(ref.sha256) + ' -> ' + shortHash(note.sha256) + ')',
      });
    } else if (note.bytes !== ref.bytes) {
      findings.push({ code: 'REF_CHANGED', detail: ref.path + ' (bytes ' + ref.bytes + ' -> ' + note.bytes + ')' });
    }
  }

  const material = findings.some((finding) => finding.code !== 'BRAIN_DRIFT');
  return {
    result: material ? 'STALE' : findings.length ? 'DRIFT' : 'FRESH',
    findings,
    material,
    computedHash,
  };
}

export async function loadManifest(brainRoot, options = {}) {
  const rootDir = resolveRoot(brainRoot);
  const manifestPath = options.manifestPath ? resolveFromRepo(options.manifestPath) : null;
  if (manifestPath) {
    try {
      const parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
      if (parsed && Array.isArray(parsed.notes)) return { manifest: parsed, manifestPath, fromDisk: true };
    } catch {
      /* regenera abaixo */
    }
  }
  const manifest = await buildManifest(rootDir);
  return { manifest, manifestPath: manifestPath ?? resolveRoot(DEFAULT_MANIFEST), fromDisk: false };
}

function packetPathFor(taskId, explicit) {
  if (explicit) return resolveFromRepo(explicit);
  return resolveFromRepo(DEFAULT_PACKET_DIR + '/' + taskId + '.packet.json');
}

export async function readPacketFile(packetPath) {
  const resolved = resolveFromRepo(packetPath);
  return { packet: JSON.parse(await readFile(resolved, 'utf8')), packetPath: resolved };
}

function parseArgs(argv) {
  const options = {
    command: argv[0] ?? 'help',
    domains: [],
    rules: [],
    architecture: [],
    contracts: [],
    decisions: [],
    risks: [],
    files: [],
    doNotBreak: [],
    uncertainties: [],
    explicitPaths: [],
    refAdd: [],
    refRemove: [],
    ops: [],
    log: true,
    rebase: false,
    strict: false,
    record: false,
    json: false,
    includeHistorical: false,
    includeSessions: false,
    noCore: false,
    maxRefs: 12,
    project: 'App Piteco / APE Education',
    actor: 'main',
  };

  const listArg = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];
    if (arg === '--task') options.taskId = next();
    else if (arg.indexOf('--task=') === 0) options.taskId = arg.slice('--task='.length);
    else if (arg === '--objective') options.objective = next();
    else if (arg.indexOf('--objective=') === 0) options.objective = arg.slice('--objective='.length);
    else if (arg === '--domain' || arg === '--area') options.domains.push(...listArg(next()));
    else if (arg.indexOf('--domain=') === 0) options.domains.push(...listArg(arg.slice('--domain='.length)));
    else if (arg.indexOf('--area=') === 0) options.domains.push(...listArg(arg.slice('--area='.length)));
    else if (arg === '--rule') options.rules.push(next());
    else if (arg === '--architecture') options.architecture.push(next());
    else if (arg === '--contract') options.contracts.push(next());
    else if (arg === '--decision') options.decisions.push(next());
    else if (arg === '--risk') options.risks.push(next());
    else if (arg === '--file') options.files.push(next());
    else if (arg === '--files') options.files.push(...listArg(next()));
    else if (arg === '--do-not-break') options.doNotBreak.push(next());
    else if (arg === '--uncertainty') options.uncertainties.push(next());
    else if (arg === '--ref') options.explicitPaths.push(next());
    else if (arg === '--ref-add') options.refAdd.push(next());
    else if (arg === '--ref-remove') options.refRemove.push(next());
    else if (arg === '--max-refs') options.maxRefs = Number(next()) || options.maxRefs;
    else if (arg === '--project') options.project = next();
    else if (arg === '--actor') options.actor = next();
    else if (arg === '--reason') options.reason = next();
    else if (arg === '--at') options.at = next();
    else if (arg === '--packet') options.packetPath = next();
    else if (arg.indexOf('--packet=') === 0) options.packetPath = arg.slice('--packet='.length);
    else if (arg === '--out') options.out = next();
    else if (arg === '--ledger') options.ledger = next();
    else if (arg === '--note-path') options.notePath = next();
    else if (arg === '--stage') options.stage = next();
    else if (arg === '--no-log') options.log = false;
    else if (arg === '--rebase') options.rebase = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--record') options.record = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--include-historical') options.includeHistorical = true;
    else if (arg === '--include-sessions') options.includeSessions = true;
    else if (arg === '--no-core') options.noCore = true;
    else if (arg === '--set' || arg === '--append' || arg === '--clear') {
      const kind = arg.slice(2);
      const raw = next();
      if (kind === 'clear') {
        options.ops.push({ kind, field: raw });
      } else {
        const separator = raw.indexOf('=');
        if (separator < 1) throw new Error(arg + ' exige CAMPO=valor');
        options.ops.push({ kind, field: raw.slice(0, separator), value: raw.slice(separator + 1) });
      }
    } else if (arg === '--help' || arg === '-h') options.command = 'help';
    else throw new Error('argumento desconhecido: ' + arg);
  }
  options.domains = [...new Set(options.domains)];
  return options;
}

function usage() {
  return [
    'context-packet - CONTEXT PACKET compacto do Segundo Cerebro',
    '',
    '  new      --task <id> --objective "<texto>" [--domain a,b] [--area x]',
    '           [--rule "..."] [--contract "..."] [--decision "..."] [--risk "..."]',
    '           [--files a,b] [--do-not-break "..."] [--uncertainty "..."]',
    '           [--ref <nota>] [--max-refs N] [--include-historical] [--include-sessions]',
    '           [--no-core] [--actor main] [--out <arquivo>] [--at <ISO>] [--no-log]',
    '  patch    --packet <arquivo> (--set CAMPO=valor | --append CAMPO=valor | --clear CAMPO |',
    '           --ref-add <nota> | --ref-remove <nota>) --reason "<motivo>" [--rebase] [--actor x]',
    '  validate --packet <arquivo> [--strict] [--record]',
    '  show     --packet <arquivo> [--json] [--actor <quem>]',
    '  read     --packet <arquivo> --note-path <nota>   (retrieval sob demanda de UMA nota)',
    '',
    'packet padrao: ' + DEFAULT_PACKET_DIR + '/<task>.packet.json',
    'manifesto padrao: ' + DEFAULT_MANIFEST + ' (gere com: node scripts/brain-index.mjs)',
  ].join('\n');
}

async function logEvent(event, options) {
  if (!options.log) return;
  await appendEvent(event, { ledger: options.ledger, at: options.at });
}

async function commandNew(options) {
  if (!options.taskId) throw new Error('new exige --task <id>');
  if (!options.objective) throw new Error('new exige --objective "<texto>"');
  const at = options.at ?? new Date().toISOString();
  const loaded = await loadManifest(options.root ?? 'docs/brain', {});
  const packet = buildPacket({
    ...options,
    at,
    manifest: loaded.manifest,
    manifestPath: toRelative(REPO_ROOT, loaded.manifestPath),
  });
  const outPath = packetPathFor(options.taskId, options.out);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(withHash(packet), null, 2) + '\n', 'utf8');

  const markdown = renderMarkdown(packet);
  const bytes = Buffer.byteLength(markdown, 'utf8');
  await logEvent(
    {
      task: options.taskId,
      stage: options.stage ?? 'main',
      actor: options.actor,
      event: 'packet_new',
      bytes,
      tokens: estimateTokens(bytes),
      packet: toRelative(REPO_ROOT, outPath),
      refs: packet.refs.length,
      brain_version: packet.brain_version,
    },
    options,
  );
  const manifestBytes = Buffer.byteLength(JSON.stringify(loaded.manifest), 'utf8');
  await logEvent(
    {
      task: options.taskId,
      stage: 'index',
      actor: 'tool',
      event: 'brain_index',
      bytes: manifestBytes,
      tokens: estimateTokens(manifestBytes),
      note: 'manifesto lido pela ferramenta; nao entra no contexto do agente',
    },
    options,
  );

  console.log('packet: ' + outPath);
  console.log('task: ' + packet.task_id);
  console.log('brain_version: ' + shortHash(packet.brain_version));
  console.log('refs: ' + packet.refs.length + ' | packet_tokens(estimado): ' + estimateTokens(bytes) + ' (bytes/4)');
  console.log('PACKET_WRITTEN');
}

async function commandPatch(options) {
  if (!options.packetPath) throw new Error('patch exige --packet <arquivo>');
  if (!options.reason) throw new Error('patch exige --reason "<motivo>" (protocolo: patch justificado)');
  const { packet, packetPath } = await readPacketFile(options.packetPath);
  const loaded = await loadManifest(packet.brain_root, {});
  const at = options.at ?? new Date().toISOString();
  const patched = applyPatchOps(packet, { ...options, at, manifest: loaded.manifest });
  await writeFile(packetPath, JSON.stringify(withHash(patched), null, 2) + '\n', 'utf8');

  const markdown = renderMarkdown(patched);
  const bytes = Buffer.byteLength(markdown, 'utf8');
  await logEvent(
    {
      task: patched.task_id,
      stage: options.stage ?? 'on-demand',
      actor: options.actor,
      event: 'packet_patch',
      bytes,
      tokens: estimateTokens(bytes),
      reason: options.reason,
      patch_count: patched.patch_count,
      rebased: options.rebase === true,
    },
    options,
  );

  console.log('packet: ' + packetPath);
  console.log('patch_count: ' + patched.patch_count + ' | ops: ' + patched.patch_log.at(-1).ops.join(', '));
  console.log('packet_tokens(estimado): ' + estimateTokens(bytes) + ' (bytes/4)');
  console.log('PATCH_APPLIED');
}

async function commandValidate(options) {
  if (!options.packetPath) throw new Error('validate exige --packet <arquivo>');
  const { packet, packetPath } = await readPacketFile(options.packetPath);
  const loaded = await loadManifest(packet.brain_root, {});
  const result = validatePacket(packet, loaded.manifest);

  if (options.record) {
    await logEvent(
      {
        task: packet.task_id,
        stage: options.stage ?? 'validate',
        actor: options.actor,
        event: 'packet_validate',
        result: result.result,
        reasons: result.findings.map((finding) => finding.code + ':' + finding.detail),
        packet: toRelative(REPO_ROOT, packetPath),
      },
      options,
    );
  }

  console.log('packet: ' + packetPath);
  console.log('result: ' + result.result);
  for (const finding of result.findings) console.log('  ' + finding.code + ': ' + finding.detail);
  if (result.result === 'FRESH') {
    console.log('PACKET_FRESH');
  } else if (result.result === 'DRIFT') {
    console.log('PACKET_DRIFT (nenhuma nota do packet mudou; brain_version global avancou)');
    console.log('acao: reutilizar o packet; rebase apenas se algum ref relevante mudar');
  } else {
    console.log('PACKET_STALE (mudanca material)');
    console.log('acao: node scripts/context-packet.mjs patch --packet "' + packetPath + '" --reason "<motivo>" --rebase');
  }
  if (options.strict && result.result !== 'FRESH') process.exitCode = 1;
}

async function commandShow(options) {
  if (!options.packetPath) throw new Error('show exige --packet <arquivo>');
  const { packet, packetPath } = await readPacketFile(options.packetPath);
  const output = options.json ? JSON.stringify(packet, null, 2) : renderMarkdown(packet);
  const bytes = Buffer.byteLength(output, 'utf8');
  await logEvent(
    {
      task: packet.task_id,
      stage: options.stage ?? 'share',
      actor: options.actor,
      created_by: packet.created_by,
      event: 'packet_show',
      bytes,
      tokens: estimateTokens(bytes),
      format: options.json ? 'json' : 'markdown',
      packet: toRelative(REPO_ROOT, packetPath),
      brain_version: packet.brain_version,
    },
    options,
  );
  process.stdout.write(output);
  if (!output.endsWith('\n')) process.stdout.write('\n');
}

async function commandRead(options) {
  if (!options.packetPath) throw new Error('read exige --packet <arquivo>');
  if (!options.notePath) throw new Error('read exige --note-path <nota>');
  const { packet, packetPath } = await readPacketFile(options.packetPath);
  const rootDir = resolveRoot(packet.brain_root);
  const notePath = path.resolve(rootDir, options.notePath);
  const relative = path.relative(rootDir, notePath).split(path.sep).join('/');
  const text = (await readFile(notePath, 'utf8')).replace(/\r\n/g, '\n');
  const bytes = Buffer.byteLength(text, 'utf8');
  await logEvent(
    {
      task: packet.task_id,
      stage: options.stage ?? 'on-demand',
      actor: options.actor,
      event: 'brain_read',
      on_demand: true,
      files: [relative],
      bytes,
      tokens: estimateTokens(bytes),
      packet: toRelative(REPO_ROOT, packetPath),
      reason: options.reason,
    },
    options,
  );
  process.stdout.write(text);
  if (!text.endsWith('\n')) process.stdout.write('\n');
}

async function commandStatus(options) {
  const ledger = await readLedger(options.ledger);
  const counters = summarize(ledger.events, {});
  console.log('ledger: ' + ledger.path + ' (' + ledger.events.length + ' eventos)');
  for (const entry of Object.entries(counters)) {
    if (Array.isArray(entry[1])) continue;
    console.log('  ' + entry[0] + ': ' + entry[1]);
  }
  console.log('  ledger_resolved: ' + resolveLedgerPath(options.ledger));
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

  try {
    if (options.command === 'new') await commandNew(options);
    else if (options.command === 'patch') await commandPatch(options);
    else if (options.command === 'validate') await commandValidate(options);
    else if (options.command === 'show') await commandShow(options);
    else if (options.command === 'read') await commandRead(options);
    else if (options.command === 'status') await commandStatus(options);
    else if (options.command === 'help') console.log(usage());
    else {
      console.error('ERROR comando desconhecido: ' + options.command);
      console.error(usage());
      process.exitCode = 2;
    }
  } catch (error) {
    console.error('ERROR ' + error.message);
    process.exitCode = 1;
  }
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main();
}
