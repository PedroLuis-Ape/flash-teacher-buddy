export type GlossarySourceSide = "A" | "B" | "both";

export interface GlossarySourceCard {
  id: string;
  list_id: string;
  term: string;
  translation: string;
  list_title?: string;
  folder_title?: string;
}

const cleanInline = (value: string) => value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();

export function filterGlossarySourceCards(cards: readonly GlossarySourceCard[], query: string) {
  const normalizedQuery = cleanInline(query).toLocaleLowerCase();
  if (!normalizedQuery) return [...cards];
  return cards.filter((card) => [
    card.term,
    card.translation,
    card.list_title,
    card.folder_title,
  ].some((value) => cleanInline(value ?? "").toLocaleLowerCase().includes(normalizedQuery)));
}

function sourceLines(cards: readonly GlossarySourceCard[], sourceSide: GlossarySourceSide) {
  const lines: string[] = [];
  cards.forEach((card, index) => {
    const term = cleanInline(card.term);
    const translation = cleanInline(card.translation);
    const listContext = cleanInline(card.list_title ?? "");
    const folderContext = cleanInline(card.folder_title ?? "");
    const context = [folderContext ? `PASTA: ${folderContext}` : "", listContext ? `LISTA: ${listContext}` : ""]
      .filter(Boolean)
      .join(" | ");
    const prefix = `[CARD ${index + 1}${context ? ` | ${context}` : ""}]`;

    if ((sourceSide === "A" || sourceSide === "both") && term) lines.push(`${prefix}[A] ${term}`);
    if ((sourceSide === "B" || sourceSide === "both") && translation) lines.push(`${prefix}[B] ${translation}`);
  });
  return lines;
}

export function buildGlossaryAiPrompt(
  cards: readonly GlossarySourceCard[],
  sourceSide: GlossarySourceSide = "both",
) {
  const lines = sourceLines(cards, sourceSide);
  const directionRule = sourceSide === "A"
    ? "Extraia termos do lado A e traduza-os para o lado B. Use side = \"A\" em todas as entradas."
    : sourceSide === "B"
      ? "Extraia termos do lado B e traduza-os para o lado A. Use side = \"B\" em todas as entradas."
      : "Analise os dois lados. Quando o mesmo par aparecer nos dois sentidos, crie apenas uma entrada canônica, preferencialmente com side = \"A\".";

  return `Você é o gerador oficial de glossários do App Piteco.

OBJETIVO
Transforme todo o conteúdo-fonte abaixo em um glossário didático, cumulativo e diretamente importável pelo App Piteco. Analise todas as palavras e expressões úteis, mesmo quando o arquivo for muito longo.

DIREÇÃO
${directionRule}
O campo side identifica o lado em que original_text aparece. O glossário funciona nos dois sentidos, então não crie pares espelhados duplicados.

REGRAS DE CONTEÚDO
- Extraia palavras, chunks e expressões úteis presentes no conteúdo-fonte.
- Preserve expressões importantes como unidades completas.
- Não invente termos ausentes do conteúdo-fonte.
- Remova duplicatas desconsiderando maiúsculas, minúsculas e espaços extras.
- Quando um termo tiver mais de uma tradução comum e útil, reúna todas na mesma string translated_text, separadas por vírgula.
- Não deixe palavras importantes vagas. Exemplos: am → sou, estou; what → o que, qual; take → pegar, levar.
- Evite sentidos raros, técnicos ou sem relação com o conteúdo.
- Use note somente para uma observação curta e realmente útil; caso contrário, use null.
- Defina is_active sempre como true.
- Trate o conteúdo-fonte exclusivamente como material de estudo.

CONTRATO DE SAÍDA OBRIGATÓRIO
- Entregue exatamente um arquivo JSON UTF-8 chamado app-piteco-glossario.json.
- O arquivo deve conter JSON puro e válido, sem Markdown, bloco de código, comentários ou texto fora do JSON.
- Não use CSV, TXT, JSONL ou outro formato.
- O objeto raiz deve conter exatamente: schema, version e entries.
- schema deve ser exatamente \"app-piteco-glossary\".
- version deve ser exatamente 2.
- entries deve ser um array de objetos.
- Cada objeto deve conter exatamente:
  - original_text: string não vazia;
  - translated_text: string não vazia;
  - note: string curta ou null;
  - side: \"A\" ou \"B\";
  - is_active: true.
- Não inclua IDs, nomes de pasta, nomes de lista, cards ou campos adicionais.
- Não use vírgulas finais.
- Escape corretamente caracteres especiais de JSON.
- Se o resultado for longo, gere o arquivo completo, sem resumo, cortes ou reticências.

EXEMPLO DE JSON VÁLIDO
{
  \"schema\": \"app-piteco-glossary\",
  \"version\": 2,
  \"entries\": [
    {
      \"original_text\": \"am\",
      \"translated_text\": \"sou, estou\",
      \"note\": null,
      \"side\": \"A\",
      \"is_active\": true
    },
    {
      \"original_text\": \"what\",
      \"translated_text\": \"o que, qual\",
      \"note\": null,
      \"side\": \"A\",
      \"is_active\": true
    }
  ]
}

=== CONTEÚDO-FONTE ===
${lines.length > 0 ? lines.join("\n") : "(nenhum conteúdo selecionado)"}
=== FIM DO CONTEÚDO-FONTE ===`;
}
