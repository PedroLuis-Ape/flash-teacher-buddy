export function folderGlossaryPromptPart9(): string {
  return `# 14. PROCESSO OBRIGATÓRIO PARA TRANSFORMAR O MATERIAL EM GLOSSÁRIO

Execute silenciosamente estas etapas, nesta ordem:

## Etapa 1 — separar os lados

Identifique quais textos pertencem ao lado A e quais pertencem ao lado B. Nunca misture os idiomas nem use o texto do lado oposto para decidir side.

## Etapa 2 — inventariar todas as palavras

No modo de extração exata, tokenize o material por lado e construa um inventário de todas as palavras individuais únicas. Inclua artigos, pronomes, determinantes, auxiliares, preposições, conectores, partículas, números escritos, formas flexionadas e palavras comuns.

Palavras repetidas aparecem uma única vez por lado, mas nenhuma pode ser omitida. Preserve a forma encontrada quando ela tiver valor de estudo: "were" continua "were", "enslaved" continua "enslaved" e "millions" continua "millions".

## Etapa 3 — reunir os contextos de cada termo

Antes de traduzir, reúna silenciosamente todos os exemplos em que cada term aparece. Não decida a tradução olhando apenas para a palavra isolada quando houver contexto disponível.

## Etapa 4 — analisar função e sentido

Para cada term, identifique:

* classe gramatical em cada ocorrência;
* forma gramatical concreta;
* sentido predominante;
* possíveis sentidos secundários realmente usados;
* número, pessoa, tempo, aspecto, voz, grau e modalidade quando relevantes;
* registro e naturalidade no idioma de destino;
* risco de falso cognato ou literalidade inadequada.

## Etapa 5 — preencher a entrada individual

Escolha uma tradução principal natural e contextual. Use alternatives apenas para sentidos secundários comprovados e note apenas para informação pedagógica útil.

## Etapa 6 — adicionar expressões como camada adicional

Depois de concluir o inventário individual, identifique chunks, phrasal verbs, collocations, locuções, expressões idiomáticas e combinações fixas que possuam significado próprio.

Essas expressões são aditivas. "because", "of" e "because of" podem e devem coexistir quando aparecem no material. Uma expressão completa nunca substitui as entradas individuais das palavras que a compõem.

Não transforme frases comuns inteiras em entradas apenas para inflar o glossário. Uma expressão deve possuir unidade semântica, gramatical ou pedagógica real.

## Etapa 7 — deduplicar sem perder sentidos

Mantenha uma única entrada por combinação side + term. Quando o mesmo termo aparecer com usos diferentes, consolide o sentido principal, alternatives e note sem criar duplicatas incompatíveis com o importador.

## Etapa 8 — validar antes de responder

Compare o inventário original com entries e confirme que:

* toda palavra individual possui entrada exata no mesmo lado;
* toda expressão adicionada também possui entrada própria;
* as palavras que formam cada expressão continuam presentes individualmente;
* nenhuma tradução foi escolhida sem considerar os exemplos disponíveis;
* nenhuma entrada está vazia, duplicada, no idioma errado ou fora do schema.

# 15. POLISSEMIA, AMBIGUIDADE E CONFLITO DE SENTIDOS

Quando todos os exemplos compartilharem um sentido principal, use esse sentido em translation e inclua em alternatives somente variações úteis e compatíveis.

Quando o mesmo term aparecer com sentidos diferentes:

1. determine qual sentido é predominante ou mais bem sustentado;
2. use esse sentido em translation;
3. coloque os outros sentidos realmente presentes em alternatives;
4. explique a diferença em note;
5. não esconda o conflito usando uma tradução genérica que não corresponda bem a nenhum exemplo;
6. não invente uma entrada duplicada no mesmo lado.

Se o contexto for insuficiente para decidir com segurança, escolha a equivalência mais neutra e pedagogicamente defensável, declare a limitação em note e evite confiança artificial. Ainda assim, preencha o schema canônico sem adicionar campos extras.

A tradução principal deve corresponder ao uso mais frequente, mais central ou mais bem sustentado pelo material — nunca apenas ao significado mais conhecido da palavra.`;
}
