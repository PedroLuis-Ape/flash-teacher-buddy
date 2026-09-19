/**
 * Fonte canônica única da regra pedagógica de composição de flashcards do
 * App Piteco. Todo gerador oficial de cards (Smart Import 2.0, Super Importador
 * 1.0/2.0, presets, final, owner/canário, layered e canonical) reaproveita este
 * mesmo texto. Nunca copie estas linhas para dentro de outro builder: prompts
 * compostos passariam a repetir o contrato e sofreriam drift.
 */
export const FLASHCARD_COMPOSITION_MARKERS = [
  "MÁXIMO DE VOCABULÁRIO ÚTIL",
  "densidade lexical",
  "POLISSEMIA",
  "família lexical",
  "fidelidade ao vocabulário-alvo",
  "naturalidade",
] as const;

export const FLASHCARD_COMPOSITION_RULES = `MÁXIMO DE VOCABULÁRIO ÚTIL DENTRO DE UMA FRASE NATURAL, ENXUTA E FÁCIL DE REVISAR
Máximo de vocabulário útil dentro de uma frase natural e fácil de revisar. Não queremos palavra solta sem contexto e não queremos um livro em cada flashcard.

OBJETIVO DOS FLASHCARDS
- Aprender mais vocabulário útil com menos redundância, sem transformar cada card em um parágrafo.
- Sempre que fizer sentido, combine 2 ou 3 palavras, expressões ou unidades lexicais importantes na mesma frase.
- Não existe obrigação de sempre usar 2 ou 3 termos.
- Prioridade, nesta ordem: naturalidade, clareza, valor pedagógico e densidade lexical.
- Nunca sacrifique a naturalidade apenas para colocar mais palavras no card.

DENSIDADE LEXICAL
- Quando 2 ou 3 termos importantes combinarem naturalmente, prefira uma única frase que ensine esses termos juntos.
- Exemplo de qualidade (não é template obrigatório): The new method substantially reduced the evaluation bottleneck.
- Exemplo de qualidade (não é template obrigatório): He resigned to study abroad and improve his English.
- Se três termos juntos produzirem frase artificial, improvável, semanticamente estranha, excessivamente longa ou confusa, use 1 ou 2 termos e distribua o restante em outros cards.

TAMANHO IDEAL
- Não crie frase sem contexto, como He resigned., nem mini-parágrafos cheios de informação lateral.
- A frase deve ser curta ou média, autossuficiente, semanticamente clara, rápida de ler, rápida de recordar e suficientemente contextualizada.
- Não imponha limite rígido de palavras que prejudique a linguagem natural.
- Heurística: FLASHCARD não é palavra isolada e FLASHCARD não é parágrafo. Prefira uma sentença simples ou moderadamente composta.
- Se a frase exigir várias orações subordinadas, muitos detalhes, contexto histórico, explicações ou múltiplas ideias independentes, quebre em mais de um card.

UMA IDEIA PRINCIPAL POR CARD
- Mesmo com 2 ou 3 termos importantes, o card deve ensinar uma situação ou ideia coerente.
- Evite juntar conceitos que exigiriam três contextos diferentes.
- A densidade precisa vir de vocabulário que realmente mereça ser aprendido, combine semanticamente, seja reutilizável e apareça naturalmente na construção.
- Palavras triviais podem compor a frase, mas não devem ser tratadas artificialmente como alvo.

FAMÍLIAS LEXICAIS E VERBOS
- Quando houver família lexical pedagogicamente relevante, mantenha as formas relacionadas conectadas: psychology, psychologist, psychological.
- Vale também para verbos e formas relacionadas: solicit, solicited, soliciting, solicitation.
- Quando o modo atual permitir cards layered, famílias lexicais e formas verbais intimamente relacionadas podem ser organizadas em camadas, quando semanticamente adequado.
- Respeite o modo atual: se ele aceitar somente cards normais, não introduza type=layered, mantenha as formas relacionadas coerentes na mesma lista e preserve contexto suficiente para futura mesclagem.
- Não transforme sinônimos independentes em camadas automaticamente. Use relação morfológica ou semântica real.

POLISSEMIA
- Quando a mesma palavra tiver sentidos diferentes, cada sentido deve aparecer em contexto inequívoco.
- Nunca crie um único card ambíguo como charge → cobrar / carregar / taxa quando o objetivo é ensinar usos distintos.
- O contexto é o que resolve o sentido.

PHRASES, COLLOCATIONS E CHUNKS
- Preserve unidades lexicais úteis como uma unidade pedagógica: study abroad, take at face value, follow suit, walk away from, evaluation bottleneck.
- Não desmonte expressão útil em tradução palavra por palavra quando a unidade completa tem valor lexical próprio.
- Também não invente expressão onde ela não existe.

TRADUÇÃO
- Otimize ao mesmo tempo fidelidade ao significado e à estrutura relevante do idioma de origem e naturalidade no idioma de destino.
- Prioridade: fidelidade ao vocabulário-alvo somada a tradução natural.
- Evite paráfrases desnecessariamente interpretativas: She walked away from the job. → Ela deixou o emprego. (e não uma interpretação que perca a relação lexical com walk away from).
- Fidelidade não significa tradução palavra por palavra quando isso soa errado: use o equivalente natural mais próximo, preservando o sentido pedagógico.
- Frente e verso devem continuar alinhados: não adicione informação importante apenas na tradução e não omita o vocabulário-alvo quando ele puder ser representado naturalmente.

CONTEXTO E CAMPOS ENRIQUECIDOS
- O contexto deve esclarecer sentido, regência, collocation, phrasal verb, classe ou função e uso típico, sem virar explicação.
- Quando o schema permitir detalhes, use detailed_explanation, usage_notes, common_mistakes, short_observation, hint, example e word_hints.
- Não despeje essas explicações em front e back: front e back precisam continuar rápidos de revisar.

REDUNDÂNCIA
- Evite vários cards praticamente iguais só para ensinar uma palavra diferente em cada um quando os termos podem coexistir naturalmente.
- Card não é glossário: glossário é consulta lexical rápida, flashcard é uso contextual e recuperação ativa.
- Não transforme card em termo seguido de lista de cinco traduções quando o contexto for necessário.
- Os exemplos deste contrato são exemplos de qualidade, não categorias fixas. Não repita sempre os mesmos termos em todos os pacotes.

RESUMO OPERACIONAL
1. identificar o vocabulário realmente importante;
2. agrupar termos que combinem naturalmente;
3. preferir 2 ou 3 termos úteis por frase quando apropriado;
4. reduzir para 1 ou 2 se a naturalidade exigir;
5. criar frase curta ou média;
6. garantir contexto suficiente;
7. traduzir com fidelidade e naturalidade;
8. separar sentidos polissêmicos;
9. organizar famílias lexicais e formas relacionadas;
10. usar layers quando o modo suportar e for apropriado;
11. não duplicar cards quase iguais;
12. não transformar card em parágrafo.

LIMITES DESTE CONTRATO
- Esta regra é para CONTEÚDO GERADO. Se o usuário já forneceu cards, frases ou glossário e pediu apenas organização, importação, conversão ou reestruturação técnica, NÃO reescreva o conteúdo para encaixar 2 ou 3 palavras.
- Pedidos explícitos do usuário têm prioridade sobre a otimização de densidade.
- Aplique a regra somente dentro das capacidades do formato atual. Se o schema não permitir glossário, word_hints, explicações ou camadas, respeite o schema e não invente campos; aplique o contrato a front e back.`;

/**
 * Anexa o contrato canônico sem duplicá-lo. Use uma única vez por prompt
 * final: builders compostos (final → preset, owner → final, layered → smart)
 * já herdam o contrato do builder de base.
 */
export function withFlashcardCompositionRules(prompt: string): string {
  if (prompt.includes(FLASHCARD_COMPOSITION_MARKERS[0])) return prompt;
  return [
    prompt,
    "",
    "CONTRATO PEDAGÓGICO DE COMPOSIÇÃO DOS FLASHCARDS",
    FLASHCARD_COMPOSITION_RULES,
  ].join("\n");
}
