export interface ReadableImportFile {
  name: string;
  size: number;
  text: () => Promise<string>;
}

/** Reads text without repairing, trimming or changing any parser's contract. */
export async function readImportFile(
  file: ReadableImportFile,
  maxBytes: number,
): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`O arquivo excede ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error("Não foi possível ler o arquivo. Selecione-o novamente e tente outra vez.");
  }
  if (!text.trim()) throw new Error("O arquivo está vazio. Selecione um arquivo com conteúdo.");
  return text;
}
