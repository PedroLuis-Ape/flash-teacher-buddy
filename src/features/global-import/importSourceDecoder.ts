export type ImportSourceEncoding = "utf-8" | "utf-16le" | "utf-16be" | "windows-1252";

export interface DecodedImportSource {
  text: string;
  encoding: ImportSourceEncoding;
  warnings: string[];
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

function decode(bytes: Uint8Array, encoding: ImportSourceEncoding, fatal = false): string {
  return stripBom(new TextDecoder(encoding, { fatal }).decode(bytes));
}

export function decodeImportBytes(buffer: ArrayBuffer): DecodedImportSource {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      text: decode(bytes, "utf-16le"),
      encoding: "utf-16le",
      warnings: ["Arquivo UTF-16 LE convertido para texto compatível antes da validação."],
    };
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return {
      text: decode(bytes, "utf-16be"),
      encoding: "utf-16be",
      warnings: ["Arquivo UTF-16 BE convertido para texto compatível antes da validação."],
    };
  }

  try {
    return { text: decode(bytes, "utf-8", true), encoding: "utf-8", warnings: [] };
  } catch {
    return {
      text: decode(bytes, "windows-1252"),
      encoding: "windows-1252",
      warnings: [
        "O arquivo não estava em UTF-8. Ele foi convertido de Windows-1252/ISO-8859-1 antes da importação.",
      ],
    };
  }
}

export async function decodeImportFile(file: File): Promise<DecodedImportSource> {
  return decodeImportBytes(await file.arrayBuffer());
}
