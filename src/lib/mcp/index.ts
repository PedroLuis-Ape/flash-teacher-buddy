import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import getFlashcardsTool from "./tools/getFlashcards";
import getListTool from "./tools/getList";
import getMyProfileTool from "./tools/getMyProfile";
import listFoldersTool from "./tools/listFolders";
import listListsTool from "./tools/listLists";
import searchMyContentTool from "./tools/searchMyContent";

// The auth issuer must be the direct supabase.co host of the auth server this
// app uses. Production data (and therefore auth) lives on the fixed project
// below; see docs/environment-contract.md. The fallback keeps the issuer
// well-formed during the throwaway manifest-extract eval.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "ymahldldyxvwjeruaxpr";

const instructions = [
  "Agent integration for APE Piteco (personal study library).",
  "Every tool runs as the authenticated user: identity comes from the verified OAuth token, so no tool accepts a user id and none can reach another account.",
  "Start with get_my_profile to learn which library scopes the account has (personal library plus institution hubs), then discover content with list_folders, list_lists and search_my_content.",
  "Resolve names to ids at runtime; never reuse an id from memory or from an earlier conversation.",
  "Reads are compact and paginated (limit/offset, total_count, has_more): never assume a tool returned the whole library.",
  "This phase ships read-only tools only; there are no create/update/delete tools yet.",
].join(" ");

export default defineMcp({
  name: "ape-piteco-mcp",
  title: "APE Piteco",
  version: "0.2.0",
  instructions,
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    echoTool,
    getMyProfileTool,
    listFoldersTool,
    listListsTool,
    getListTool,
    getFlashcardsTool,
    searchMyContentTool,
  ],
});
