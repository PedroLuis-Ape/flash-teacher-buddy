export const GLOBAL_IMPORT_CSV_SCHEMA = "app-piteco-csv-v1" as const;
export const GLOBAL_IMPORT_PROMPT_VERSION = "APP_PITECO_SUPER_IMPORT_PROMPT_V1" as const;
export const GLOBAL_IMPORT_CSV_COLUMNS = ["folder_name", "list_name", "front", "back"] as const;
export const GLOBAL_IMPORT_CSV_HEADER = GLOBAL_IMPORT_CSV_COLUMNS.map((column) => `"${column}"`).join(",");
