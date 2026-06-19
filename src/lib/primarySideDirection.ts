export type PrimarySide = "a" | "b";
export type PrimaryDirection = "a-b" | "b-a";

export const normalizePrimarySide = (value: unknown): PrimarySide => value === "b" ? "b" : "a";
export const primarySideToDirection = (value: unknown): PrimaryDirection => normalizePrimarySide(value) === "b" ? "b-a" : "a-b";

export function isDirectionFollowingPrimary(direction: string, side: unknown): boolean {
  return direction !== "any" && direction === primarySideToDirection(side);
}
