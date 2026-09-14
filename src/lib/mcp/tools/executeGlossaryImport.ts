import { defineTool } from "@lovable.dev/mcp-js";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { executeGlossaryImport, executeGlossaryImportSchema } from "../domain/importers";

export default defineTool({
  name: "execute_glossary_import",
  title: "Execute official folder glossary import",
  description: "Executes the authenticated owner's folder glossary import through import_folder_glossary_v2 with explicit merge or replace mode and confirm=true. Folder ownership is resolved through the OAuth-scoped client; no direct table writes, v1 fallback or classroom destination is exposed.",
  inputSchema: executeGlossaryImportSchema.shape,
  annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const input = executeGlossaryImportSchema.parse(args);
      return toolSuccess(await executeGlossaryImport(db, input));
    } catch (error) {
      return toolErrorResult(error, "execute_glossary_import");
    }
  },
});
