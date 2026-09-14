import { z } from "zod";
import { parseAnySmartImportSource } from "../../../features/smart-import/parseAnySource";
import {
  SMART_IMPORT_LIMITS,
  smartImportPackageSchema,
  summarizeSmartImport,
  type SmartImportPackage,
} from "../../../features/smart-import/schema";
import {
  buildDefaultDestinationPlan,
  validateDestinationPlan,
  type ExistingImportFolder,
  type ExistingImportList,
  type GlobalImportDestinationPlan,
  type ImportDestinationCatalog,
} from "../../../features/global-import/destination";
import type { FolderGlossaryInput } from "../../../features/study/lib/folderGlossaryTypes";
import type { UserScopedDb } from "./client";
import { McpDomainError, toMcpDomainError } from "./errors";
import { referenceIdKind } from "./referenceIds";

export const importSelectorSchema = z.object({
  id: z.string().uuid().optional(),
  // Reuses the canonical helper so the accepted spelling and the resolved
  // spelling can never drift apart (the pattern is case-insensitive).
  reference_id: z.string().trim().refine((value) => referenceIdKind(value) !== null, "Referência humana inválida.").optional(),
  name: z.string().trim().min(1).max(160).optional(),
}).strict().refine(
  (value) => [value.id, value.reference_id, value.name].filter((item) => item !== undefined).length === 1,
  "Informe exatamente um id, reference_id ou name.",
);

const folderDestinationSchema = z.union([
  z.object({ mode: z.literal("create"), name: z.string().trim().min(1).max(160) }).strict(),
  z.object({ mode: z.literal("existing"), folderId: z.string().uuid() }).strict(),
]);

const listDestinationSchema = z.union([
  z.object({ mode: z.literal("create"), name: z.string().trim().min(1).max(160) }).strict(),
  z.object({ mode: z.literal("existing"), listId: z.string().uuid(), strategy: z.enum(["append", "replace"]).optional(), consolidate: z.boolean().optional() }).strict(),
  z.object({ mode: z.literal("skip") }).strict(),
]);

export const destinationPlanSchema = z.object({
  folders: z.record(z.string(), z.object({
    folder: folderDestinationSchema,
    lists: z.record(z.string(), listDestinationSchema),
  }).strict()),
}).strict();

const destinationSelectorSchema = z.object({
  folder: importSelectorSchema,
  list: importSelectorSchema,
}).strict();

const contentBaseSchema = {
  package: smartImportPackageSchema.optional(),
  source: z.string().trim().min(1).max(SMART_IMPORT_LIMITS.maxTextLength).optional(),
  source_context: z.object({
    packageName: z.string().trim().max(160).optional(),
    folderName: z.string().trim().max(160).optional(),
    listName: z.string().trim().max(160).optional(),
    frontLanguage: z.string().trim().max(160).optional(),
    backLanguage: z.string().trim().max(160).optional(),
  }).strict().optional(),
  destination: destinationSelectorSchema.optional(),
  destination_plan: destinationPlanSchema.optional(),
  card_conflict: z.enum(["skip", "replace", "copy", "error"]),
};

export const previewContentImportSchema = z.object(contentBaseSchema).strict();
export const executeContentImportSchema = z.object({
  ...contentBaseSchema,
  request_id: z.string().uuid(),
  confirm: z.literal(true),
}).strict();

export const glossaryEntrySchema = z.object({
  term: z.string().trim().min(1).max(SMART_IMPORT_LIMITS.maxTextLength),
  translation: z.string().trim().min(1).max(SMART_IMPORT_LIMITS.maxTextLength),
  alternatives: z.array(z.string().trim().min(1).max(SMART_IMPORT_LIMITS.maxTextLength)).max(20).optional(),
  note: z.string().trim().max(SMART_IMPORT_LIMITS.maxTextLength).nullable().optional(),
  side: z.enum(["A", "B"]).optional(),
  source_language: z.string().trim().max(160).nullable().optional(),
  target_language: z.string().trim().max(160).nullable().optional(),
  active: z.boolean().optional(),
}).strict();

const glossaryBaseSchema = {
  folder: importSelectorSchema,
  entries: z.array(glossaryEntrySchema).min(1).max(SMART_IMPORT_LIMITS.maxGlossaryEntries),
  mode: z.enum(["merge", "replace"]),
};

export const previewGlossaryImportSchema = z.object(glossaryBaseSchema).strict();
export const executeGlossaryImportSchema = z.object({
  ...glossaryBaseSchema,
  confirm: z.literal(true),
}).strict();

type ImportSelector = z.infer<typeof importSelectorSchema>;
type ContentInput = z.infer<typeof previewContentImportSchema>;
type ExecuteContentInput = z.infer<typeof executeContentImportSchema>;
type GlossaryInput = z.infer<typeof previewGlossaryImportSchema>;
type ExecuteGlossaryInput = z.infer<typeof executeGlossaryImportSchema>;

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function referenceValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Human alias shown in the ambiguity message; the UUID stays canonical. */
function describeDestination(target: ExistingImportFolder | ExistingImportList): string {
  return target.reference_id ? `${target.title} (${target.reference_id})` : `${target.title} (${target.id})`;
}

function parsePackage(input: ContentInput): { value: SmartImportPackage; format: string; notes: string[]; warnings: string[] } {
  if (input.package !== undefined) {
    const parsed = smartImportPackageSchema.safeParse(input.package);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new McpDomainError("invalid_input", `${issue.path.join(".") || "$"}: ${issue.message}`);
    }
    return { value: parsed.data, format: "json-v2", notes: ["Contrato app-piteco-super-import 2.0 validado."], warnings: [] };
  }
  if (!input.source) throw new McpDomainError("invalid_input", "Informe package ou source para a importação.");
  try {
    const result = parseAnySmartImportSource(input.source, input.source_context);
    return { value: result.packageValue, format: result.format, notes: result.notes, warnings: result.warnings };
  } catch (error) {
    throw new McpDomainError("invalid_input", error instanceof Error ? error.message : "A fonte da importação é inválida.", { cause: error });
  }
}

function queryScope(query: any, db: UserScopedDb, includeInstitutionFilter = true): any {
  const scoped = query
    .eq("owner_id", db.userId)
    .eq("system_kind", "user")
    .is("class_id", null)
    .is("deleted_at", null);
  return includeInstitutionFilter ? scoped.is("institution_id", null) : scoped;
}

function queryListScope(query: any, db: UserScopedDb): any {
  return query
    .eq("owner_id", db.userId)
    .eq("system_kind", "user")
    .is("class_id", null)
    .is("institution_id", null)
    .is("deleted_at", null);
}

async function loadPersonalCatalog(db: UserScopedDb): Promise<ImportDestinationCatalog> {
  const foldersResponse = await queryScope(
    db.client.from("folders").select("id,title,reference_id,lang_a,lang_b,labels_a,labels_b,study_type,tts_enabled"),
    db,
  ).order("title", { ascending: true });
  if (foldersResponse.error) throw toMcpDomainError(foldersResponse.error, "Não foi possível listar os destinos pessoais.");
  const folders = (Array.isArray(foldersResponse.data) ? foldersResponse.data : [])
    .filter((row): row is Record<string, unknown> => Boolean(recordOf(row)))
    .map((row) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      reference_id: referenceValue(row.reference_id),
      lang_a: stringOrNull(row.lang_a),
      lang_b: stringOrNull(row.lang_b),
      labels_a: stringOrNull(row.labels_a),
      labels_b: stringOrNull(row.labels_b),
      study_type: stringOrNull(row.study_type),
      tts_enabled: typeof row.tts_enabled === "boolean" ? row.tts_enabled : null,
      institution_id: null,
      class_id: null,
    } satisfies ExistingImportFolder));
  if (!folders.length) return { folders, lists: [] };
  const folderIds = folders.map((folder) => folder.id);
  const listsResponse = await queryListScope(
    db.client.from("lists").select("id,title,folder_id,reference_id,lang_a,lang_b,labels_a,labels_b,study_type,tts_enabled"),
    db,
  ).in("folder_id", folderIds).order("title", { ascending: true });
  if (listsResponse.error) throw toMcpDomainError(listsResponse.error, "Não foi possível listar as listas pessoais.");
  const lists = (Array.isArray(listsResponse.data) ? listsResponse.data : [])
    .filter((row): row is Record<string, unknown> => Boolean(recordOf(row)))
    .map((row) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      folder_id: String(row.folder_id ?? ""),
      reference_id: referenceValue(row.reference_id),
      lang_a: stringOrNull(row.lang_a),
      lang_b: stringOrNull(row.lang_b),
      labels_a: stringOrNull(row.labels_a),
      labels_b: stringOrNull(row.labels_b),
      study_type: stringOrNull(row.study_type),
      tts_enabled: typeof row.tts_enabled === "boolean" ? row.tts_enabled : null,
      class_id: null,
    } satisfies ExistingImportList));
  return { folders, lists };
}

function selectorKind(selector: ImportSelector): "id" | "reference_id" | "name" {
  if (selector.id) return "id";
  if (selector.reference_id) return "reference_id";
  return "name";
}

/**
 * O caminho de importação resolve destinos pelo catálogo, que espelha o
 * contrato do RPC oficial: a pasta e a lista precisam pertencer ao dono, sem
 * lixeira e sem turma. O caminho de leitura usa autoridade por pasta; aqui o
 * preview precisa prometer exatamente o que o executor aceita.
 */
function matchesSelector(target: ExistingImportFolder | ExistingImportList, selector: ImportSelector): boolean {
  const kind = selectorKind(selector);
  if (kind === "id") return target.id.toLowerCase() === (selector.id ?? "").toLowerCase();
  // The alias is stored uppercase; the selector is case-insensitive, so both
  // sides are normalized before comparing.
  if (kind === "reference_id") {
    return (target.reference_id ?? "").trim().toUpperCase() === (selector.reference_id ?? "").trim().toUpperCase();
  }
  return normalized(target.title) === normalized(selector.name ?? "");
}

async function resolveOwnedFolder(db: UserScopedDb, selector: ImportSelector): Promise<ExistingImportFolder> {
  const catalog = await loadPersonalCatalog(db);
  return resolveCatalogFolder(catalog, selector);
}

function resolveCatalogFolder(catalog: ImportDestinationCatalog, selector: ImportSelector): ExistingImportFolder {
  const matches = catalog.folders.filter((folder) => matchesSelector(folder, selector));
  if (!matches.length) {
    throw new McpDomainError("not_found", "Pasta não encontrada na biblioteca pessoal desta conta.", {
      hint: "Use list_folders para descobrir o id ou a referência correta antes de repetir.",
    });
  }
  if (matches.length > 1) {
    throw new McpDomainError("ambiguous", `Mais de uma pasta corresponde ao seletor: ${matches.map(describeDestination).join(" | ")}. Use id ou reference_id.`);
  }
  return matches[0];
}

function findListInFolder(catalog: ImportDestinationCatalog, folderId: string, selector: ImportSelector): ExistingImportList {
  const matches = catalog.lists.filter((list) => list.folder_id === folderId && matchesSelector(list, selector));
  if (!matches.length) {
    throw new McpDomainError("not_found", "Lista não encontrada dentro da pasta selecionada.", {
      hint: "Confirme a pasta e use list_lists para descobrir o id ou a referência da lista.",
    });
  }
  if (matches.length > 1) {
    throw new McpDomainError("ambiguous", `Mais de uma lista corresponde ao seletor: ${matches.map(describeDestination).join(" | ")}. Use id ou reference_id.`);
  }
  return matches[0];
}

async function resolvePlan(
  db: UserScopedDb,
  packageValue: SmartImportPackage,
  destination: ContentInput["destination"],
  requestedPlan: ContentInput["destination_plan"],
): Promise<{ plan: GlobalImportDestinationPlan; catalog: ImportDestinationCatalog }> {
  const catalog = await loadPersonalCatalog(db);
  if (requestedPlan) return { plan: requestedPlan as GlobalImportDestinationPlan, catalog };
  if (!destination) {
    const plan = buildDefaultDestinationPlan(packageValue as never, catalog);
    return { plan, catalog };
  }
  if (packageValue.package.folders.length !== 1 || packageValue.package.folders[0].lists.length !== 1) {
    throw new McpDomainError("invalid_input", "destination folder/list só pode ser usado com um pacote de uma pasta e uma lista; use destination_plan para lotes maiores.");
  }
  const folder = resolveCatalogFolder(catalog, destination.folder);
  const list = findListInFolder(catalog, folder.id, destination.list);
  return {
    catalog,
    plan: {
      folders: {
        0: {
          folder: { mode: "existing", folderId: folder.id },
          lists: { 0: { mode: "existing", listId: list.id } },
        },
      },
    },
  };
}

/**
 * O plano default do MCP nunca escolhe em silêncio quando o nome é ambíguo.
 * Nesse caso o chamador precisa declarar destination ou destination_plan.
 */
function assertUnambiguousDefaults(packageValue: SmartImportPackage, catalog: ImportDestinationCatalog): void {
  packageValue.package.folders.forEach((incomingFolder, folderIndex) => {
    const folderMatches = catalog.folders.filter(
      (folder) => normalized(folder.title) === normalized(incomingFolder.name),
    );
    if (folderMatches.length > 1) {
      throw new McpDomainError(
        "ambiguous",
        `package.folders[${folderIndex}]: o nome "${incomingFolder.name}" corresponde a ${folderMatches.length} pastas (${folderMatches.map(describeDestination).join(" | ")}). Informe destination ou destination_plan.`,
      );
    }
    if (folderMatches.length !== 1) return;
    const targetFolder = folderMatches[0];
    incomingFolder.lists.forEach((incomingList, listIndex) => {
      const listMatches = catalog.lists.filter(
        (list) => list.folder_id === targetFolder.id && normalized(list.title) === normalized(incomingList.name),
      );
      if (listMatches.length > 1) {
        throw new McpDomainError(
          "ambiguous",
          `package.folders[${folderIndex}].lists[${listIndex}]: o nome "${incomingList.name}" corresponde a ${listMatches.length} listas em "${targetFolder.title}" (${listMatches.map(describeDestination).join(" | ")}). Informe destination ou destination_plan.`,
        );
      }
    });
  });
}

async function prepareContent(db: UserScopedDb, input: ContentInput) {
  const parsed = parsePackage(input);
  const summary = summarizeSmartImport(parsed.value);
  // Mesma regra de pré-checagem do gateway oficial: replace não aceita camadas.
  if (input.card_conflict === "replace" && summary.layeredGroups > 0) {
    throw new McpDomainError("invalid_input", "E_LAYERED_REPLACE_UNSUPPORTED|Pacotes com camadas não aceitam card_conflict=replace. Use skip, copy ou error.");
  }
  const { plan, catalog } = await resolvePlan(db, parsed.value, input.destination, input.destination_plan);
  const errors = validateDestinationPlan(parsed.value as never, catalog, plan);
  if (errors.length) throw new McpDomainError("invalid_input", errors.join(" "));
  if (!input.destination && !input.destination_plan) assertUnambiguousDefaults(parsed.value, catalog);
  return { ...parsed, plan, catalog, summary };
}

export async function previewContentImport(db: UserScopedDb, input: ContentInput) {
  const prepared = await prepareContent(db, input);
  return {
    importer: "smart_import_2.0",
    format: prepared.format,
    notes: prepared.notes,
    warnings: prepared.warnings,
    summary: prepared.summary,
    destination_plan: prepared.plan,
    validation: { status: "valid", mode: "local" },
    transaction: {
      preview_is_transaction: false,
      executor: "import_app_piteco_super_package_current",
      note: "Este preview valida e planeja localmente; a transação só ocorre no execute_content_import.",
    },
  };
}

export async function executeContentImport(db: UserScopedDb, input: ExecuteContentInput) {
  if (input.confirm !== true) throw new McpDomainError("confirmation_required", "execute_content_import exige confirm=true.");
  const prepared = await prepareContent(db, input);
  const response = await db.client.rpc("import_app_piteco_super_package_current" as never, {
    _institution_id: null,
    _payload: prepared.value,
    _destination_plan: prepared.plan,
    _card_conflict: input.card_conflict,
    _request_id: input.request_id,
  });
  if (response.error) {
    if (String((response.error as { code?: unknown }).code ?? "").toUpperCase() === "PGRST202") {
      throw new McpDomainError("unavailable", "O importador oficial Smart Import 2.0 não está disponível no backend conectado.");
    }
    throw toMcpDomainError(response.error, "O importador oficial de conteúdo falhou.");
  }
  const report = recordOf(response.data);
  if (!report) throw new McpDomainError("unavailable", "O importador oficial não devolveu um relatório válido.");
  return {
    importer: "smart_import_2.0",
    rpc: "import_app_piteco_super_package_current",
    request_id: input.request_id,
    destination_plan: prepared.plan,
    report,
  };
}

function glossaryEntries(input: GlossaryInput): FolderGlossaryInput[] {
  return input.entries.map((entry) => ({ ...entry })) as FolderGlossaryInput[];
}

async function prepareGlossary(db: UserScopedDb, input: GlossaryInput) {
  const folder = await resolveOwnedFolder(db, input.folder);
  return { folder, entries: glossaryEntries(input) };
}

async function runGlossaryRpc(
  db: UserScopedDb,
  input: GlossaryInput,
  dryRun: boolean,
) {
  const prepared = await prepareGlossary(db, input);
  const response = await db.client.rpc("import_folder_glossary_v2" as never, {
    _folder_id: prepared.folder.id,
    _entries: prepared.entries,
    _mode: input.mode,
    _dry_run: dryRun,
  });
  if (response.error) {
    if (String((response.error as { code?: unknown }).code ?? "").toUpperCase() === "PGRST202") {
      throw new McpDomainError("unavailable", "O importador oficial de glossário v2 não está disponível no backend conectado.");
    }
    throw toMcpDomainError(response.error, "O importador oficial de glossário falhou.");
  }
  const report = recordOf(response.data);
  if (!report) throw new McpDomainError("unavailable", "O importador oficial de glossário não devolveu um relatório válido.");
  return { folder: prepared.folder, report };
}

export async function previewGlossaryImport(db: UserScopedDb, input: GlossaryInput) {
  const result = await runGlossaryRpc(db, input, true);
  return {
    importer: "folder_glossary_v2",
    folder_id: result.folder.id,
    mode: input.mode,
    report: result.report,
    transaction: { preview_is_transaction: true, dry_run: true, note: "O RPC oficial executou dry-run sem persistir alterações." },
  };
}

export async function executeGlossaryImport(db: UserScopedDb, input: ExecuteGlossaryInput) {
  if (input.confirm !== true) throw new McpDomainError("confirmation_required", "execute_glossary_import exige confirm=true.");
  const result = await runGlossaryRpc(db, input, false);
  return {
    importer: "folder_glossary_v2",
    folder_id: result.folder.id,
    mode: input.mode,
    report: result.report,
  };
}
