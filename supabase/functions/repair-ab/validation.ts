export const REPAIR_ACTIONS = ["swap_cards", "fix_metadata", "full_repair", "mark_reviewed", "edit_card"] as const;
export type RepairAction = (typeof REPAIR_ACTIONS)[number];
export const MAX_REPAIR_BODY_BYTES = 1_000_000;
export const MAX_REPAIR_CARD_IDS = 500;
export const MAX_REPAIR_TEXT_LENGTH = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isRepairAction(value: unknown): value is RepairAction {
  return typeof value === "string" && (REPAIR_ACTIONS as readonly string[]).includes(value);
}
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
export function normalizeCardIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_REPAIR_CARD_IDS) return null;
  const unique = [...new Set(value)];
  if (unique.length !== value.length || !unique.every(isUuid)) return null;
  return unique;
}
export function isSafeOptionalText(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length <= MAX_REPAIR_TEXT_LENGTH);
}
