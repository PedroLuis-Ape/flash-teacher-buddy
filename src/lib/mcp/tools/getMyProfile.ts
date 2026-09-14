import { defineTool } from "@lovable.dev/mcp-js";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { getMyProfile } from "../domain/profile";

export default defineTool({
  name: "get_my_profile",
  title: "Get my APE Piteco account",
  description:
    "Returns the authenticated APE Piteco account: user id, minimal profile fields, and the library scopes available (personal library plus every institution hub the account owns). " +
    "Call this first to answer 'where am I' before listing or searching content. Read-only, no arguments. " +
    "Response: {ok:true,user_id,profile,scopes} or {ok:false,error:{code,message,hint}}.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (_args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await getMyProfile(db);
      return toolSuccess({ scope: "personal", ...result });
    } catch (error) {
      return toolErrorResult(error, "get_my_profile");
    }
  },
});
