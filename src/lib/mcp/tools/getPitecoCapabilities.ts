import { defineTool } from "@lovable.dev/mcp-js";
import { createUserScopedDb } from "../domain/client";
import { getPitecoCapabilities } from "../domain/capabilities";
import { toolErrorResult, toolSuccess } from "../domain/errors";

export default defineTool({
  name: "get_piteco_capabilities",
  title: "Get Piteco capabilities",
  description: "Returns a compact, authenticated capability map for the real Piteco backend: basic and enriched fields, layered cards, glossary status, owner-only personal/institution destinations, importador oficial and other official routes, limits, and bulk versus granular routing. It reads get_import_capabilities_v2 and falls back to get_import_capabilities_v1, reporting the contract that answered in capability_rpc; an unavailable or unusable RPC is reported as unknown and it never invents support.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: true },
  handler: async (_args, ctx) => {
    try {
      return toolSuccess(await getPitecoCapabilities(createUserScopedDb(ctx)) as unknown as Record<string, unknown>);
    } catch (error) {
      return toolErrorResult(error, "get_piteco_capabilities");
    }
  },
});
