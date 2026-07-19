export const JSON_FILE_DELIVERY_HEADING = "FORMA DE ENTREGA PRIORITARIA";

function normalizeJsonFilename(filename: string): string {
  const value = filename.trim() || "app-piteco-importacao";
  return value.toLowerCase().endsWith(".json") ? value : `${value}.json`;
}

export function buildPreferredJsonFileDelivery(filename: string): string {
  const safeFilename = normalizeJsonFilename(filename);
  return [
    JSON_FILE_DELIVERY_HEADING,
    `- Entregue prioritariamente o resultado como um arquivo JSON para download chamado "${safeFilename}".`,
    "- O arquivo deve conter exatamente o objeto JSON exigido neste prompt, completo e em UTF-8.",
    "- Valide silenciosamente que o conteúdo abre com JSON.parse e que nenhum item foi cortado.",
    "- Não entregue PDF, DOCX, CSV, TXT ou outro formato quando o contrato de retorno for JSON.",
    "- Se a interface não permitir criar ou anexar arquivos, responda somente com o JSON puro no chat, sem Markdown, sem bloco de código e sem texto adicional.",
  ].join("\n");
}

export function appendPreferredJsonFileDelivery(prompt: string, filename: string): string {
  if (prompt.includes(JSON_FILE_DELIVERY_HEADING)) return prompt;
  return `${prompt.trimEnd()}\n\n${buildPreferredJsonFileDelivery(filename)}`;
}
