import { z } from "zod";
import { isReferenceIdentifier, type ReferenceKind } from "../domain/referenceIds";

export function identifierSchema(kind?: ReferenceKind) {
  return z.string().min(1).refine(
    (value) => isReferenceIdentifier(value, kind),
    kind
      ? `Use um UUID ou uma referência ${kind === "folder" ? "F-XXXXXX" : "L-XXXXXX"}.`
      : "Use um UUID ou uma referência F-/L- válida.",
  );
}

export const folderIdentifierSchema = identifierSchema("folder");
export const listIdentifierSchema = identifierSchema("list");
export const anyResourceIdentifierSchema = identifierSchema();
