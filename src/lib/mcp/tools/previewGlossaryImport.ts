import { defineTool } from "@lovable.dev/mcp-js";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { previewGlossaryImport, previewGlossaryImportSchema } from "../domain/importers";

export default defineTool({
  name: "preview_glossary_import",
  title: "Preview official folder glossary import",
  description: "Resolves an authenticated owner's personal folder by UUID, reference_id or unique name and calls the official import_folder_glossary_v2 RPC in dry-run mode. It returns the backend's merge/replace counts; no v1 fallback, direct table write, classroom target or silent folder choice is allowed.",
  inputSchema: previewGlossaryImportSchema.shape,
  annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const input = previewGlossaryImportSchema.parse(args);
      return toolSuccess(await previewGlossaryImport(db, input));
    } catch (error) {
      return toolErrorResult(error, "preview_glossary_import");
    }
  },
});
