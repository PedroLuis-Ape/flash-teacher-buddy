import { auth, defineMcp } from "@lovable.dev/mcp-js";
import analyzeTextTool from "./tools/analyzeText";
import echoTool from "./tools/echo";
import getFlashcardsTool from "./tools/getFlashcards";
import getListTool from "./tools/getList";
import getMyProfileTool from "./tools/getMyProfile";
import listFoldersTool from "./tools/listFolders";
import listListsTool from "./tools/listLists";
import searchMyContentTool from "./tools/searchMyContent";
import addFlashcardsTool from "./tools/addFlashcards";
import confirmDeleteFolderTool from "./tools/confirmDeleteFolder";
import confirmDeleteListTool from "./tools/confirmDeleteList";
import createFolderTool from "./tools/createFolder";
import createListTool from "./tools/createList";
import duplicateListTool from "./tools/duplicateList";
import moveListTool from "./tools/moveList";
import previewDeleteFolderTool from "./tools/previewDeleteFolder";
import previewDeleteListTool from "./tools/previewDeleteList";
import removeFlashcardsTool from "./tools/removeFlashcards";
import reorderListsTool from "./tools/reorderLists";
import restoreFromTrashTool from "./tools/restoreFromTrash";
import updateFlashcardsTool from "./tools/updateFlashcards";
import updateFolderTool from "./tools/updateFolder";
import updateListTool from "./tools/updateList";
import createStudyMaterialTool from "./tools/createStudyMaterial";
import { withAudit } from "./domain/audit";

const auditedToolNames = new Set([
  "create_folder",
  "update_folder",
  "create_list",
  "update_list",
  "move_list",
  "reorder_lists",
  "duplicate_list",
  "add_flashcards",
  "update_flashcards",
  "remove_flashcards",
  "preview_delete_list",
  "confirm_delete_list",
  "preview_delete_folder",
  "confirm_delete_folder",
  "restore_from_trash",
  "create_study_material",
]);

function publishedTool(tool: typeof echoTool) {
  const annotations = {
    readOnlyHint: tool.annotations?.readOnlyHint ?? false,
    idempotentHint: tool.annotations?.idempotentHint ?? false,
    destructiveHint: tool.annotations?.destructiveHint ?? false,
    openWorldHint: tool.annotations?.openWorldHint ?? true,
  };
  const normalized = { ...tool, annotations };
  return auditedToolNames.has(tool.name) ? withAudit(normalized) : normalized;
}

// The auth issuer must be the direct supabase.co host of the auth server this
// app uses. Production data (and therefore auth) lives on the fixed project
// below; see docs/environment-contract.md. The fallback keeps the issuer
// well-formed during the throwaway manifest-extract eval.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "ymahldldyxvwjeruaxpr";

const instructions = [
  "Agent integration for APE Piteco (personal study library).",
  "Every tool runs as the authenticated user: identity comes from the verified OAuth token, so no tool accepts a user id and none can reach another account.",
  "Operational sequence: discover -> resolve each name or id at runtime -> act -> re-confirm by reading the affected object. get_my_profile returns the scopes (personal library plus the institution hubs the account owns), list_folders/list_lists/search_my_content return current ids, and get_list/get_flashcards return content.",
  "Ids never come from memory or an earlier conversation: resolve them again from a current read, and treat ambiguous names as an actionable choice among candidates.",
  "Reads are compact and paginated (limit/offset, total_count, has_more): never assume a tool returned the whole library; continue with the next page when has_more is true.",
  "Write in batches: add_flashcards inserts many cards in one call and update_flashcards accepts many cards per call, instead of one call per card.",
  "Deletion is always two-step and recoverable: preview_delete_list/preview_delete_folder (and remove_flashcards with dry_run=true when many cards are involved) return the real consequences plus a short-lived confirmation_token; only confirm_delete_* applies it. Never read a vague request such as organize this as authorization to delete.",
  "Every removal is a soft delete that stays 7 days in the product trash and can be undone with restore_from_trash; automatic collections (Reforco / Pontos de atencao) and classroom content are out of reach and fail safely.",
  "create_study_material resolves folder/list by current name or id, supports dry_run/preview, and inserts cards in one batch; it is not the analysis tool and must never be used to satisfy an analysis-only request.",
].join(" ");

const registeredTools = [
  echoTool,
  getMyProfileTool,
  listFoldersTool,
  listListsTool,
  getListTool,
  getFlashcardsTool,
  searchMyContentTool,
  analyzeTextTool,
  createFolderTool,
  updateFolderTool,
  createListTool,
  updateListTool,
  moveListTool,
  reorderListsTool,
  duplicateListTool,
  addFlashcardsTool,
  updateFlashcardsTool,
  removeFlashcardsTool,
  previewDeleteListTool,
  confirmDeleteListTool,
  previewDeleteFolderTool,
  confirmDeleteFolderTool,
  restoreFromTrashTool,
  createStudyMaterialTool,
].map(publishedTool);

export default defineMcp({
  name: "ape-piteco-mcp",
  title: "APE Piteco",
  version: "0.3.0",
  instructions,
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: registeredTools,
});
