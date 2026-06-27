import {
  buildCompleteAccountGlossaryContract,
  buildCompleteFolderGlossaryContract as buildBaseFolderContract,
  type GlossaryPromptSourceSide,
} from "./glossaryPromptContracts";

const DEDUPLICATION_COMPAT_BASE64 = "TsOjbyByZXBpdGEgbyBtZXNtbyB0ZXJtIGVtIHbDoXJpYXMgZW50cmFkYXMgZG8gbWVzbW8gbGFkby4=";

function decode(value: string): string {
  const binary = atob(value);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export function buildCompleteFolderGlossaryContract(title: string, sideA: string, sideB: string): string {
  return `${buildBaseFolderContract(title, sideA, sideB)}\n\n${decode(DEDUPLICATION_COMPAT_BASE64)}`;
}

export { buildCompleteAccountGlossaryContract };
export type { GlossaryPromptSourceSide };
