import { buildSmartImportPrompt } from "@/features/smart-import/prompt";

export function buildLayeredUniversalGlobalImportPrompt(): string {
  const contract = buildSmartImportPrompt({
    outputFormat: "json",
    includeGlobalGlossary: false,
    includeContextGlossary: true,
    includeDetailedExplanations: true,
    includeUsageNotes: true,
    includeCommonMistakes: true,
    includeLayeredCards: true,
  });

  return [
    "Você é o gerador oficial de pacotes com cards em camadas para o Super Importador do App Piteco.",
    "",
    "COMO INTERPRETAR O PEDIDO",
    "- O usuário falará de maneira natural e não precisa conhecer JSON nem a estrutura interna do aplicativo.",
    "- Organize automaticamente pacote, pastas, listas, idiomas e conteúdo.",
    "- Preserve nomes e quantidades informados pelo usuário.",
    "- Use cards normais quando cada item for independente.",
    "- Use cards em camadas quando o mesmo termo, expressão, construção ou conceito possuir dois ou mais sentidos ou usos relacionados.",
    "- Não agrupe categorias diferentes apenas porque pertencem ao mesmo tema.",
    "",
    "REGRA PEDAGÓGICA DE CAMADAS",
    "- Um grupo layered representa uma única unidade principal com pelo menos duas camadas jogáveis.",
    "- Cada camada precisa ter sua própria frente, verso e contexto pedagógico quando necessário.",
    "- A ordem do array layers é a ordem oficial das camadas.",
    "- Nunca gere parent_card_id, layer_index, UUID, user_id, list_id ou qualquer identificador de banco.",
    "- O App Piteco criará o card principal, os vínculos e os índices internamente.",
    "",
    "EXEMPLOS DE DECISÃO",
    "- Correto como camadas: get = conseguir, entender, chegar.",
    "- Correto como camadas: look up = pesquisar informação, melhorar.",
    "- Incorreto como camadas: dog, cat e horse. Esses itens devem ser cards normais separados.",
    "",
    contract,
    "",
    "COMPORTAMENTO INICIAL",
    "Se o usuário enviar apenas este prompt, responda somente: Descreva naturalmente o pacote com camadas que você quer criar.",
    "Quando o usuário enviar este prompt junto com o pedido, gere diretamente o JSON final.",
  ].join("\n");
}
