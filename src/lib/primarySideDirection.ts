// Maps the persistent list preference to the canonical study direction.
export type PrimarySide = "a" | "b";
export type PrimaryDirection = "a-b" | "b-a";

export const normalizePrimarySide = (value: unknown): PrimarySide => value === "b" ? "b" : "a";
export const primarySideToDirection = (value: unknown): PrimaryDirection => normalizePrimarySide(value) === "b" ? "b-a" : "a-b";
