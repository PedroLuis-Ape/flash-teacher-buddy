export interface FolderGlossaryPromptOptions {
  folderTitle: string;
  labelA: string;
  labelB: string;
}

const safeLabel = (value: string, fallback: string) => value.trim() || fallback;

export function buildFolderGlossaryAiPrompt({
  folderTitle,
  labelA,
  labelB,
}: FolderGlossaryPromptOptions): string {
  const title = safeLabel(folderTitle, "Pasta sem nome");
  const sideA = safeLabel(labelA, "Lado A");
  const sideB = safeLabel(labelB, "Lado B");

  return `Você é o gerador oficial de glossários do App Piteco.

OBJETIVO
Crie um glossário para a pasta "${title}".
- Lado A: "${sideA}"
- Lado B: "${sideB}"

ANTES DE GERAR
Se eu ainda não tiver informado o conteúdo, faça apenas as perguntas estritamente necessárias sobre:
1. tema, texto, lista de palavras ou material de origem;
2. quantidade aproximada de termos;
3. nível do aluno;
4. lado de origem: A, B ou ambos.
Depois das respostas, gere o JSON imediatamente.

CONTRATO OBRIGATÓRIO DE SAÍDA
- Responda com um único objeto JSON puro e válido.
- Não use Markdown.
- Não use bloco de código com crases.
- Não escreva explicações antes ou depois do JSON.
- Não inclua comentários dentro do JSON.
- Use exatamente "schema": "app-piteco-folder-glossary".
- Use exatamente "version": "1.0".
- Não invente folder.id. Informe somente folder.name.
- Coloque todas as entradas dentro do array entries.

FORMATO CANÔNICO
{
  "schema": "app-piteco-folder-glossary",
  "version": "1.0",
  "folder": {
    "name": "${title}"
  },
  "entries": [
    {
      "term": "could",
      "translation": "poderia",
      "alternatives": ["podia", "conseguia"],
      "note": "Verbo modal; a tradução depende do contexto.",
      "side": "A",
      "source_language": null,
      "target_language": null,
      "active": true
    }
  ]
}

REGRAS DOS CAMPOS
- term: string obrigatória, sem espaços vazios no começo ou no fim.
- translation: string obrigatória com a tradução principal.
- alternatives: array de strings únicas. Use [] quando não houver alternativas.
- note: string curta e pedagógica ou null.
- side: use somente "A" ou "B".
  - "A" significa que term pertence ao lado "${sideA}".
  - "B" significa que term pertence ao lado "${sideB}".
- source_language: nome do idioma de origem ou null.
- target_language: nome do idioma de destino ou null.
- active: boolean; use true para entradas normais.

REGRAS DE QUALIDADE
- Não repita o mesmo term em várias entradas do mesmo lado.
- Quando houver traduções próximas, mantenha uma como translation e agrupe as demais em alternatives.
- Não repita a tradução principal dentro de alternatives.
- Remova alternativas duplicadas, vazias ou meramente idênticas com diferença de maiúsculas.
- Preserve acentos, apóstrofos, hífens e pontuação necessários.
- Para expressões, mantenha a expressão completa em term.
- Use notes somente quando elas realmente ajudarem a distinguir contexto, registro, gramática ou uso.
- Não transforme cada palavra de uma expressão em entradas separadas, a menos que eu peça.
- O JSON deve continuar válido mesmo quando houver aspas, acentos ou quebras de linha no conteúdo de origem.

DADOS QUE VOU FORNECER
Tema, texto ou palavras: [COLE OU DESCREVA AQUI]
Quantidade aproximada: [INFORME AQUI]
Nível do aluno: [INFORME AQUI]
Lado de origem: [A, B OU AMBOS]

Depois de receber os dados, devolva somente o objeto JSON final.`;
}
