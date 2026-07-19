export const JSON_FILE_DELIVERY_CONTRACT = [
  "ENTREGA DO ARQUIVO",
  "Entregue prioritariamente um arquivo .json para download.",
  "Caso não seja possível gerar um arquivo, devolva somente o JSON puro no chat, sem Markdown, explicações ou cercas de código.",
  "Não entregue texto extra, mais de um objeto ou outro formato como saída principal.",
].join("\n");

export function withJsonFileDeliveryContract(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.includes("Entregue prioritariamente um arquivo .json para download.")) return trimmed;
  return `${trimmed}\n\n${JSON_FILE_DELIVERY_CONTRACT}`;
}
