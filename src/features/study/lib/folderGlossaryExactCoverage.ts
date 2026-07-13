import type {
  FolderGlossaryCoverageReport,
  FolderGlossaryCoverageTerm,
} from "./folderGlossaryCoverage";
import { normalizeFolderGlossaryInput } from "./folderGlossaryTransfer";
import type { FolderGlossaryInput, GlossarySide } from "./folderGlossaryTypes";

const PLACEHOLDER_TRANSLATION = /^(?:-|todo|tbd|n\/?a|null|undefined|translation|tradu[cç][aã]o)$/iu;

function normalize(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function sanitizeJsonText(text: string): string {
  const withoutBom = text.replace(/^\uFEFF/u, "").trim();
  const fenced = withoutBom.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  return (fenced?.[1] ?? withoutBom).trim();
}

function parseJsonObject(text: string): Record<string, unknown> {
  const sanitized = sanitizeJsonText(text);
  if (!sanitized) throw new Error("O arquivo preenchido está vazio.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized) as unknown;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "estrutura inválida";
    throw new Error(`O arquivo preenchido não é um JSON válido: ${detail}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("O arquivo precisa manter o objeto JSON exportado pelo App Piteco.");
  }

  return parsed as Record<string, unknown>;
}

export function exactCoverageEntryKey(input: Pick<FolderGlossaryCoverageTerm, "side" | "normalized">): string {
  return `${input.side}|${input.normalized}`;
}

export function getExactCoveragePendingTerms(
  report: FolderGlossaryCoverageReport,
): FolderGlossaryCoverageTerm[] {
  return report.terms.filter((term) => term.status !== "covered");
}

export function getExactCoveredOccurrences(report: FolderGlossaryCoverageReport): number {
  return report.terms.reduce(
    (total, term) => total + Math.max(0, Number(term.statusCounts.covered ?? 0)),
    0,
  );
}

export function serializeExactCoverageRequest(input: {
  folderTitle: string;
  labelA: string;
  labelB: string;
  report: FolderGlossaryCoverageReport;
}): string {
  const pending = getExactCoveragePendingTerms(input.report);
  const labels: Record<GlossarySide, string> = {
    A: input.labelA,
    B: input.labelB,
  };

  return JSON.stringify({
    schema: "app-piteco-folder-glossary-exact-coverage",
    version: "2.0",
    task: "Complete o glossário individual de cada palavra pendente desta pasta.",
    folder: { name: input.folderTitle },
    audit: {
      type: "exact-token-coverage-gaps",
      generated_at: input.report.generatedAt,
      exact_coverage_required: true,
      expected_entries: pending.length,
      side_labels: labels,
      instructions: [
        "Preencha translation em TODAS as entradas; nenhuma pode permanecer vazia.",
        "Cada entry.term representa uma palavra individual e precisa de tradução própria, mesmo quando já estiver coberta por uma expressão completa.",
        "Traduza exatamente o termo informado, mantendo a forma flexionada encontrada nos cards; não substitua por lema, sinônimo, expressão ou outra palavra.",
        "Use os exemplos para escolher a tradução principal mais adequada ao contexto. Coloque outros sentidos realmente úteis em alternatives.",
        "Não pule artigos, pronomes, auxiliares, preposições, conectores ou palavras repetidas em contextos diferentes.",
        "Mantenha entry_key, term, side, coverage_status, occurrences e examples sem alterações.",
        "Não remova, não combine, não duplique e não acrescente entradas. A quantidade final deve ser exatamente audit.expected_entries.",
        "Mantenha active como true. note pode explicar contexto, classe gramatical ou uso, mas não substitui translation.",
        "Devolva o mesmo objeto como JSON puro e válido, sem Markdown, comentários, introdução ou conclusão.",
      ],
      acceptance_criteria: [
        "entries.length deve ser igual a audit.expected_entries",
        "cada par side + term deve aparecer exatamente uma vez",
        "todas as translations devem ser textos não vazios e não podem conter placeholders",
        "nenhum termo coberto somente por expressão pode ser omitido",
      ],
    },
    entries: pending.map((term) => {
      const targetSide: GlossarySide = term.side === "A" ? "B" : "A";
      return {
        entry_key: exactCoverageEntryKey(term),
        term: term.term,
        translation: "",
        alternatives: [],
        note: null,
        side: term.side,
        source_language: labels[term.side],
        target_language: labels[targetSide],
        active: true,
        coverage_status: term.status,
        occurrences: term.occurrenceCount,
        examples: term.examples.map((example) => ({
          list: example.listTitle,
          side: example.side,
          text: example.text,
        })),
      };
    }),
  }, null, 2);
}

export function parseExactCoverageCompletionJson(
  text: string,
  report: FolderGlossaryCoverageReport,
): FolderGlossaryInput[] {
  const document = parseJsonObject(text);
  if (document.schema !== "app-piteco-folder-glossary-exact-coverage") {
    throw new Error("Este não é o arquivo de cobertura exata exportado pelo App Piteco.");
  }

  const rows = document.entries;
  if (!Array.isArray(rows)) {
    throw new Error('O arquivo precisa manter a lista "entries" original.');
  }

  const pending = getExactCoveragePendingTerms(report);
  const expectedByKey = new Map(pending.map((term) => [exactCoverageEntryKey(term), term]));
  const completedByKey = new Map<string, FolderGlossaryInput>();
  const problems: string[] = [];

  rows.forEach((raw, index) => {
    const position = index + 1;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      problems.push(`entrada ${position}: estrutura inválida`);
      return;
    }

    const row = raw as Record<string, unknown>;
    const rawTerm = typeof row.term === "string" ? row.term.trim() : "";
    const rawSide = typeof row.side === "string" ? row.side.toUpperCase() : "";
    if (!rawTerm) {
      problems.push(`entrada ${position}: term foi removido`);
      return;
    }
    if (rawSide !== "A" && rawSide !== "B") {
      problems.push(`entrada ${position} (${rawTerm}): side deve ser A ou B`);
      return;
    }

    const key = `${rawSide}|${normalize(rawTerm)}`;
    const expected = expectedByKey.get(key);
    if (!expected) {
      problems.push(`entrada ${position}: termo extra ou alterado (${rawSide}: ${rawTerm})`);
      return;
    }
    if (completedByKey.has(key)) {
      problems.push(`entrada duplicada: ${rawSide}: ${expected.term}`);
      return;
    }

    const returnedEntryKey = typeof row.entry_key === "string" ? row.entry_key.trim() : "";
    if (returnedEntryKey && returnedEntryKey !== key) {
      problems.push(`entrada ${position} (${expected.term}): entry_key foi alterado`);
      return;
    }

    const returnedStatus = typeof row.coverage_status === "string" ? row.coverage_status : "";
    if (returnedStatus && returnedStatus !== expected.status) {
      problems.push(`entrada ${position} (${expected.term}): coverage_status foi alterado`);
      return;
    }

    const normalized = normalizeFolderGlossaryInput(row);
    if (!normalized) {
      problems.push(`entrada ${position} (${expected.term}): translation está vazia`);
      return;
    }
    if (PLACEHOLDER_TRANSLATION.test(normalized.translation.trim())) {
      problems.push(`entrada ${position} (${expected.term}): translation contém placeholder`);
      return;
    }

    completedByKey.set(key, {
      ...normalized,
      term: expected.term,
      side: expected.side,
      active: true,
    });
  });

  for (const expected of pending) {
    const key = exactCoverageEntryKey(expected);
    if (!completedByKey.has(key)) {
      problems.push(`entrada ausente: ${expected.side}: ${expected.term}`);
    }
  }

  if (rows.length !== pending.length) {
    problems.unshift(`quantidade incorreta: esperado ${pending.length}, recebido ${rows.length}`);
  }

  if (problems.length > 0) {
    const visible = problems.slice(0, 8).join("; ");
    const hidden = Math.max(0, problems.length - 8);
    throw new Error(
      `O arquivo não completou o glossário exato. ${visible}${hidden > 0 ? `; e mais ${hidden} problema(s)` : ""}. `
      + "Corrija o JSON ou exporte uma auditoria nova antes de importar.",
    );
  }

  return pending.map((term) => completedByKey.get(exactCoverageEntryKey(term)) as FolderGlossaryInput);
}
