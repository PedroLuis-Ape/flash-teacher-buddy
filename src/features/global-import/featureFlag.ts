const configuredValue = import.meta.env.VITE_GLOBAL_IMPORT_V2_ENABLED;

/**
 * Kill switch for the canonical protocol. Setting
 * VITE_GLOBAL_IMPORT_V2_ENABLED=false keeps the existing importer available and
 * routes normalized packages through the legacy transactional RPC.
 */
export const GLOBAL_IMPORT_V2_ENABLED = configuredValue !== "false";
