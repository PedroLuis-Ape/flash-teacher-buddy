import { defineTool } from "@lovable.dev/mcp-js";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { previewContentImport, previewContentImportSchema } from "../domain/importers";

export default defineTool({
  name: "preview_content_import",
  title: "Preview official content import",
  description: "Validates Smart Import 2.0 content, resolves personal folder/list destinations by current UUID, reference_id or unique name, and returns the real index-based destination plan, counts and warnings. This is a local validation/planning preview, not a database transaction; use execute_content_import only after reviewing it. Classroom and lossy v1 fallback are not supported.",
  inputSchema: previewContentImportSchema.shape,
  annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const input = previewContentImportSchema.parse(args);
      return toolSuccess(await previewContentImport(db, input));
    } catch (error) {
      return toolErrorResult(error, "preview_content_import");
    }
  },
});
