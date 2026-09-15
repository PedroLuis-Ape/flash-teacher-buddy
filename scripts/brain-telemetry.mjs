/**
 * brain-telemetry.mjs - ledger append-only (JSONL) do custo de contexto por
 * tarefa, mais o comando "report".
 *
 * Por que existe: o protocolo READ ONCE -> COMPACT -> SHARE -> REUSE so pode
 * ser cobrado com numero. Este ledger registra, por tarefa e por etapa
 * (before/after/main/worker/reviewer/...), quantas vezes o Segundo Cerebro foi
 * lido, quantos arquivos, quantos bytes e quantos tokens entraram no contexto.
 *
 * ESTIMATIVA DE TOKENS: tokens = ceil(bytes / 4). Isto e uma ESTIMATIVA
 * declarada, nao uma contagem de tokenizer. Toda saida de report imprime o
 * metodo para que a comparacao antes x depois seja honesta: o que se compara
 * e o mesmo estimador aplicado a bytes REAIS medidos com readFile.
 *
 * Uso:
 *   node scripts/brain-telemetry.mjs report [--task <id>] [--stage <id>] [--format md|json]
 *   node scripts/brain-telemetry.mjs path
 *   node scripts/brain-telemetry.mjs tail [--limit 20]
 *   node scripts/brain-telemetry.mjs log --task <id> --stage <id> --event <tipo> [--bytes N]
 *
 * Ledger padrao: .superpowers/sdd/brain-telemetry.jsonl
 * Override: --ledger <arquivo> ou variavel de ambiente APE_BRAIN_TELEMETRY.
 */

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TELEMETRY_SCHEMA = 1;
export const TOKEN_ESTIMATOR = 'bytes/4';
export const DEFAULT_LEDGER = '.superpowers/sdd/brain-telemetry.jsonl';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Tipos de evento reconhecidos pelo report. */
export const EVENT_TYPES = [
  'brain_read',
  'brain_index',
  'packet_new',
  'packet_show',
  'packet_patch',
  'packet_validate',
  'packet_invalidation',
  'note',
];

export const STAGES = ['before', 'main', 'worker', 'reviewer', 'correction', 'after', 'closeout'];

export function estimateTokens(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.ceil(bytes / 4);
}

export function resolveLedgerPath(explicit) {
  const target = explicit || process.env.APE_BRAIN_TELEMETRY || DEFAULT_LEDGER;
  return path.isAbsolute(target) ? target : path.resolve(REPO_ROOT, target);
}

export async function appendEvent(event, options = {}) {
  const ledgerPath = resolveLedgerPath(options.ledger);
  const record = {
    schema: TELEMETRY_SCHEMA,
    at: options.at || event.at || new Date().toISOString(),
    token_estimator: TOKEN_ESTIMATOR,
    ...event,
  };
  record.at = options.at || event.at || record.at;
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await appendFile(ledgerPath, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

export async function readLedger(ledgerPath) {
  const resolved = resolveLedgerPath(ledgerPath);
  let text = '';
  try {
    text = await readFile(resolved, 'utf8');
  } catch {
    return { path: resolved, events: [], invalidLines: 0, missing: true };
  }
  const events = [];
  let invalidLines = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      invalidLines += 1;
    }
  }
  return { path: resolved, events, invalidLines, missing: false };
}

export function emptyCounters() {
  return {
    brain_reads: 0,
    brain_files_read: 0,
    brain_tokens_loaded: 0,
    brain_bytes_loaded: 0,
    context_packet_tokens: 0,
    context_packet_bytes: 0,
    context_reuse_count: 0,
    context_patch_count: 0,
    context_invalidations: 0,
    context_stale_detections: 0,
    context_brain_drifts: 0,
    context_on_demand_reads: 0,
    invalidation_reason: [],
    token_estimator: TOKEN_ESTIMATOR,
    total_events: 0,
    total_agent_tokens: 0,
  };
}

export function summarize(events, filter = {}) {
  const counters = emptyCounters();
  let matched = 0;
  for (const event of events) {
    if (filter.task && event.task !== filter.task) continue;
    if (filter.stage && event.stage !== filter.stage) continue;
    matched += 1;
    const bytes = Number(event.bytes) || 0;
    const tokens = Number(event.tokens) || estimateTokens(bytes);
    if (event.event === 'brain_read') {
      counters.brain_reads += 1;
      counters.brain_files_read += Array.isArray(event.files) ? event.files.length : 1;
      counters.brain_tokens_loaded += tokens;
      counters.brain_bytes_loaded += bytes;
      if (event.on_demand === true) counters.context_on_demand_reads += 1;
    } else if (event.event === 'packet_new' || event.event === 'packet_show') {
      counters.context_packet_tokens += tokens;
      counters.context_packet_bytes += bytes;
      if (event.event === 'packet_show' && event.created_by && event.actor && event.actor !== event.created_by) {
        counters.context_reuse_count += 1;
      }
    } else if (event.event === 'packet_patch') {
      counters.context_patch_count += 1;
      counters.context_packet_tokens += tokens;
      counters.context_packet_bytes += bytes;
    } else if (event.event === 'packet_invalidation') {
      counters.context_invalidations += 1;
      if (event.reason) counters.invalidation_reason.push(String(event.reason));
    } else if (event.event === 'packet_validate') {
      if (event.result === 'STALE') counters.context_stale_detections += 1;
      if (event.result === 'DRIFT') counters.context_brain_drifts += 1;
    }
  }
  counters.invalidation_reason = [...new Set(counters.invalidation_reason)].sort();
  counters.total_events = matched;
  counters.total_agent_tokens = counters.brain_tokens_loaded + counters.context_packet_tokens;
  return counters;
}

export function groupEvents(events) {
  const tasks = new Map();
  for (const event of events) {
    const task = event.task || '(sem task)';
    if (!tasks.has(task)) tasks.set(task, new Map());
    const stages = tasks.get(task);
    const stage = event.stage || '(sem stage)';
    if (!stages.has(stage)) stages.set(stage, []);
    stages.get(stage).push(event);
  }
  return tasks;
}

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

const REPORT_COLUMNS = [
  ['stage', 12],
  ['reads', 7],
  ['files', 7],
  ['brain_tok', 10],
  ['packet_tok', 11],
  ['total_tok', 10],
  ['reuse', 6],
  ['patch', 6],
  ['inval', 6],
];

function tableHeader() {
  return REPORT_COLUMNS.map((column) => pad(column[0], column[1])).join(' ').trimEnd();
}

function tableRow(stage, counters) {
  const cells = [
    stage,
    counters.brain_reads,
    counters.brain_files_read,
    counters.brain_tokens_loaded,
    counters.context_packet_tokens,
    counters.total_agent_tokens,
    counters.context_reuse_count,
    counters.context_patch_count,
    counters.context_invalidations,
  ];
  return cells.map((cell, index) => pad(cell, REPORT_COLUMNS[index][1])).join(' ').trimEnd();
}

function percentDelta(before, after) {
  if (!before) return after ? 'n/a' : '0%';
  const value = ((before - after) / before) * 100;
  return (value >= 0 ? '-' : '+') + Math.abs(value).toFixed(1) + '%';
}

export function buildReport(events, options = {}) {
  const tasks = groupEvents(events);
  const lines = [];
  lines.push('BRAIN_CONTEXT_COST_REPORT');
  lines.push('token_estimator: ' + TOKEN_ESTIMATOR + ' (tokens = ceil(bytes/4); estimativa declarada, nao contagem de tokenizer)');
  lines.push('eventos: ' + events.length + (options.ledgerPath ? ' | ledger: ' + options.ledgerPath : ''));
  lines.push('');

  const selectedTasks = [...tasks.keys()].filter((task) => !options.task || task === options.task).sort();
  if (selectedTasks.length === 0) {
    lines.push('(sem eventos para o filtro informado)');
    return { text: lines.join('\n'), tasks: {} };
  }

  const summary = {};
  for (const task of selectedTasks) {
    const stages = tasks.get(task);
    const stageNames = [...stages.keys()].filter((stage) => !options.stage || stage === options.stage).sort();
    if (stageNames.length === 0) continue;

    lines.push('## ' + task);
    lines.push(tableHeader());
    const taskSummary = {};
    for (const stage of stageNames) {
      const counters = summarize(stages.get(stage), {});
      taskSummary[stage] = counters;
      lines.push(tableRow(stage, counters));
      if (counters.invalidation_reason.length > 0) {
        lines.push('    invalidation_reason: ' + counters.invalidation_reason.join(' | '));
      }
    }

    const before = taskSummary.before;
    const after = taskSummary.after;
    if (before && after) {
      lines.push('');
      lines.push('### ANTES x DEPOIS (' + task + ')');
      lines.push('  brain_reads        : ' + before.brain_reads + ' -> ' + after.brain_reads + '  (' + percentDelta(before.brain_reads, after.brain_reads) + ')');
      lines.push('  brain_files_read   : ' + before.brain_files_read + ' -> ' + after.brain_files_read + '  (' + percentDelta(before.brain_files_read, after.brain_files_read) + ')');
      lines.push('  brain_tokens_loaded: ' + before.brain_tokens_loaded + ' -> ' + after.brain_tokens_loaded + '  (' + percentDelta(before.brain_tokens_loaded, after.brain_tokens_loaded) + ')');
      lines.push('  context_packet_tok : ' + before.context_packet_tokens + ' -> ' + after.context_packet_tokens);
      lines.push('  total_agent_tokens : ' + before.total_agent_tokens + ' -> ' + after.total_agent_tokens + '  (' + percentDelta(before.total_agent_tokens, after.total_agent_tokens) + ')');
      lines.push('  context_reuse_count: ' + before.context_reuse_count + ' -> ' + after.context_reuse_count);
      lines.push('  context_patch_count: ' + before.context_patch_count + ' -> ' + after.context_patch_count);
      lines.push('  invalidations      : ' + before.context_invalidations + ' -> ' + after.context_invalidations);
    }
    lines.push('');
    summary[task] = taskSummary;
  }

  return { text: lines.join('\n'), tasks: summary };
}

function parseArgs(argv) {
  const options = { command: argv[0] || 'report', task: null, stage: null, ledger: null, format: 'md', limit: 20 };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--task') options.task = argv[++index];
    else if (arg.indexOf('--task=') === 0) options.task = arg.slice('--task='.length);
    else if (arg === '--stage') options.stage = argv[++index];
    else if (arg.indexOf('--stage=') === 0) options.stage = arg.slice('--stage='.length);
    else if (arg === '--ledger') options.ledger = argv[++index];
    else if (arg.indexOf('--ledger=') === 0) options.ledger = arg.slice('--ledger='.length);
    else if (arg === '--format') options.format = argv[++index];
    else if (arg.indexOf('--format=') === 0) options.format = arg.slice('--format='.length);
    else if (arg === '--limit') options.limit = Number(argv[++index]) || options.limit;
    else if (arg === '--event') options.event = argv[++index];
    else if (arg === '--actor') options.actor = argv[++index];
    else if (arg === '--bytes') options.bytes = Number(argv[++index]) || 0;
    else if (arg === '--files') options.files = argv[++index];
    else if (arg === '--note') options.note = argv[++index];
    else throw new Error('argumento desconhecido: ' + arg);
  }
  return options;
}

function usage() {
  return [
    'brain-telemetry - ledger append-only do custo de contexto',
    '',
    '  node scripts/brain-telemetry.mjs report [--task <id>] [--stage <id>] [--format md|json]',
    '  node scripts/brain-telemetry.mjs path',
    '  node scripts/brain-telemetry.mjs tail [--limit 20]',
    '  node scripts/brain-telemetry.mjs log --task <id> --stage <id> --event <tipo> --bytes <n> [--files a,b]',
    '',
    'ledger padrao: ' + DEFAULT_LEDGER + ' (override: --ledger ou APE_BRAIN_TELEMETRY)',
    'eventos: ' + EVENT_TYPES.join(', '),
  ].join('\n');
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

  if (options.command === 'help' || options.command === '--help' || options.command === '-h') {
    console.log(usage());
    return;
  }

  if (options.command === 'path') {
    console.log(resolveLedgerPath(options.ledger));
    return;
  }

  const ledger = await readLedger(options.ledger);
  if (ledger.missing) console.error('WARN ledger inexistente: ' + ledger.path);

  if (options.command === 'tail') {
    const tail = ledger.events.slice(-options.limit);
    console.log('ledger: ' + ledger.path + ' (' + ledger.events.length + ' eventos, ' + ledger.invalidLines + ' linhas invalidas)');
    for (const event of tail) console.log(JSON.stringify(event));
    return;
  }

  if (options.command === 'log') {
    if (!options.event) {
      console.error('ERROR log exige --event <tipo>');
      process.exitCode = 2;
      return;
    }
    const record = await appendEvent(
      {
        task: options.task || '(sem task)',
        stage: options.stage || 'note',
        actor: options.actor || 'unknown',
        event: options.event,
        bytes: options.bytes || 0,
        tokens: estimateTokens(options.bytes || 0),
        files: options.files ? options.files.split(',').filter(Boolean) : undefined,
        note: options.note,
      },
      { ledger: options.ledger },
    );
    console.log('ledger: ' + resolveLedgerPath(options.ledger));
    console.log(JSON.stringify(record));
    return;
  }

  if (options.command !== 'report') {
    console.error('ERROR comando desconhecido: ' + options.command);
    console.error(usage());
    process.exitCode = 2;
    return;
  }

  const report = buildReport(ledger.events, {
    task: options.task,
    stage: options.stage,
    ledgerPath: ledger.path,
  });

  if (options.format === 'json') {
    console.log(JSON.stringify({ ledger: ledger.path, token_estimator: TOKEN_ESTIMATOR, tasks: report.tasks }, null, 2));
    return;
  }
  console.log(report.text);
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main();
}
