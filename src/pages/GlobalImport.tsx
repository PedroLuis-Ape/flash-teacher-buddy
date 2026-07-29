/**
 * The old page used direct browser inserts and could silently flatten rich
 * content. Keep the route for existing bookmarks, but route it through the
 * same transactional importer used by the structured entry point.
 */
export { default } from "@/features/global-import/SuperGlobalImportScreen";
