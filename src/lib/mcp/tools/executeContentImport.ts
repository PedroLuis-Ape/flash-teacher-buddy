import { defineTool } from "@lovable.dev/mcp-js";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { executeContentImport, executeContentImportSchema } from "../domain/importers";

export default defineTool({
  name: "execute_content_import",
  title: "Execute official content import",
  description: "Executes the authenticated personal Smart Import 2.0 package through import_app_piteco_super_package_current with the app's index-based destination plan, stable request_id, and explicit card_conflict policy. confirm=true is mandatory. The official RPC is the only bulk content route: no direct table writes, classroom route or lossy v1 fallback is used.",
  inputSchema: executeContentImportSchema.shape,
  annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const input = executeContentImportSchema.parse(args);
      return toolSuccess(await executeContentImport(db, input));
    } catch (error) {
      return toolErrorResult(error, "execute_content_import");
    }
  },
});
