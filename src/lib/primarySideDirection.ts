export type PrimarySide = "a" | "b";
export const normalizePrimarySide = (side: unknown): PrimarySide => side === "b" ? "b" : "a";
export const primarySideToDirection = (side: unknown) => normalizePrimarySide(side) === "b" ? "b-a" : "a-b";
