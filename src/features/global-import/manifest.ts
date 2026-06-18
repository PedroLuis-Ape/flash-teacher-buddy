import type { CanonicalGlobalImportPackage, GlobalImportStudySettings } from "./schema/globalImportSchema";

export type GlobalImportManifestStatus = "generated" | "validated" | "imported" | "partial";

export interface GlobalImportManifestList {
  title: string;
  order_index: number;
  expected_card_count: number;
}

export interface GlobalImportManifestFolder {
  title: string;
  order_index: number;
  expected_list_count: number;
  expected_card_count: number;
  lists: GlobalImportManifestList[];
}

export interface GlobalImportManifestConfiguration {
  title: string;
  description: string | null;
  study_settings: GlobalImportStudySettings;
  expected_folder_count: number;
  expected_list_count: number;
  expected_card_count: number;
  folders: GlobalImportManifestFolder[];
}

export interface GlobalImportManifest {
  request_id: string;
  schema_version: 1;
  configuration: GlobalImportManifestConfiguration;
  created_at: string;
  configuration_hash: string;
  status: GlobalImportManifestStatus;
}

const STORAGE_PREFIX = "ape-global-import-manifest:";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = stableValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

export function stableConfigurationHash(value: unknown): string {
  const text = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function configurationFromCanonicalPackage(
  value: CanonicalGlobalImportPackage,
): GlobalImportManifestConfiguration {
  return {
    title: value.package.title,
    description: value.package.description ?? null,
    study_settings: value.package.study_settings,
    expected_folder_count: value.package.expected_folder_count,
    expected_list_count: value.package.expected_list_count,
    expected_card_count: value.package.expected_card_count,
    folders: value.package.folders.map((folder) => ({
      title: folder.title,
      order_index: folder.order_index,
      expected_list_count: folder.expected_list_count,
      expected_card_count: folder.expected_card_count,
      lists: folder.lists.map((list) => ({
        title: list.title,
        order_index: list.order_index,
        expected_card_count: list.expected_card_count,
      })),
    })),
  };
}

export function createGlobalImportManifest(
  requestId: string,
  configuration: GlobalImportManifestConfiguration,
): GlobalImportManifest {
  return {
    request_id: requestId,
    schema_version: 1,
    configuration,
    created_at: new Date().toISOString(),
    configuration_hash: stableConfigurationHash(configuration),
    status: "generated",
  };
}

export function saveGlobalImportManifest(manifest: GlobalImportManifest): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STORAGE_PREFIX}${manifest.request_id}`, JSON.stringify(manifest));
}

export function loadGlobalImportManifest(requestId: string): GlobalImportManifest | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${requestId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GlobalImportManifest;
    if (parsed.request_id !== requestId || parsed.schema_version !== 1) return null;
    if (parsed.configuration_hash !== stableConfigurationHash(parsed.configuration)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function updateGlobalImportManifestStatus(
  requestId: string,
  status: GlobalImportManifestStatus,
): void {
  const manifest = loadGlobalImportManifest(requestId);
  if (!manifest) return;
  saveGlobalImportManifest({ ...manifest, status });
}

export function comparePackageWithManifest(
  value: CanonicalGlobalImportPackage,
  manifest: GlobalImportManifest,
): Array<{ path: string; message: string; code: string }> {
  const issues: Array<{ path: string; message: string; code: string }> = [];
  const received = configurationFromCanonicalPackage(value);
  const expected = manifest.configuration;

  if (value.request_id !== manifest.request_id) {
    issues.push({ path: "request_id", message: "O request_id não corresponde ao manifesto salvo.", code: "manifest.request_id" });
  }
  if (manifest.configuration_hash !== stableConfigurationHash(expected)) {
    issues.push({ path: "$", message: "O manifesto local foi alterado ou corrompido.", code: "manifest.hash" });
    return issues;
  }

  const compare = (path: string, left: unknown, right: unknown) => {
    if (left !== right) issues.push({ path, message: `Esperado ${JSON.stringify(right)}, recebido ${JSON.stringify(left)}.`, code: "manifest.mismatch" });
  };

  compare("package.title", received.title, expected.title);
  compare("package.description", received.description, expected.description);
  compare("package.expected_folder_count", received.expected_folder_count, expected.expected_folder_count);
  compare("package.expected_list_count", received.expected_list_count, expected.expected_list_count);
  compare("package.expected_card_count", received.expected_card_count, expected.expected_card_count);
  compare("package.study_settings.study_type", received.study_settings.study_type, expected.study_settings.study_type);
  compare("package.study_settings.lang_a", received.study_settings.lang_a, expected.study_settings.lang_a);
  compare("package.study_settings.lang_b", received.study_settings.lang_b, expected.study_settings.lang_b);
  compare("package.study_settings.labels_a", received.study_settings.labels_a, expected.study_settings.labels_a);
  compare("package.study_settings.labels_b", received.study_settings.labels_b, expected.study_settings.labels_b);
  compare("package.study_settings.tts_enabled", received.study_settings.tts_enabled, expected.study_settings.tts_enabled);
  compare("package.folders.length", received.folders.length, expected.folders.length);

  expected.folders.forEach((expectedFolder, folderIndex) => {
    const folder = received.folders[folderIndex];
    if (!folder) {
      issues.push({ path: `package.folders[${folderIndex}]`, message: "Pasta ausente em relação ao manifesto.", code: "manifest.folder_missing" });
      return;
    }
    const folderPath = `package.folders[${folderIndex}]`;
    compare(`${folderPath}.title`, folder.title, expectedFolder.title);
    compare(`${folderPath}.order_index`, folder.order_index, expectedFolder.order_index);
    compare(`${folderPath}.expected_list_count`, folder.expected_list_count, expectedFolder.expected_list_count);
    compare(`${folderPath}.expected_card_count`, folder.expected_card_count, expectedFolder.expected_card_count);
    compare(`${folderPath}.lists.length`, folder.lists.length, expectedFolder.lists.length);

    expectedFolder.lists.forEach((expectedList, listIndex) => {
      const list = folder.lists[listIndex];
      const listPath = `${folderPath}.lists[${listIndex}]`;
      if (!list) {
        issues.push({ path: listPath, message: "Lista ausente em relação ao manifesto.", code: "manifest.list_missing" });
        return;
      }
      compare(`${listPath}.title`, list.title, expectedList.title);
      compare(`${listPath}.order_index`, list.order_index, expectedList.order_index);
      compare(`${listPath}.expected_card_count`, list.expected_card_count, expectedList.expected_card_count);
    });
  });

  if (!issues.length && stableConfigurationHash(received) !== manifest.configuration_hash) {
    issues.push({ path: "$", message: "A configuração recebida não corresponde ao hash do manifesto.", code: "manifest.hash_mismatch" });
  }
  return issues;
}
