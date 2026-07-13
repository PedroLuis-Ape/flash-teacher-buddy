export function folderGlossaryPromptPart10(): string {
  return `# 16. QUANTIDADE DE ENTRADAS

A quantidade depende do modo de origem.

## No modo de extração exata

Quando o usuário fornecer material concreto, a quantidade final deve ser suficiente para incluir:

1. uma entrada para cada palavra única de cada lado solicitado;
2. todas as formas flexionadas distintas que realmente aparecem no material;
3. chunks, phrasal verbs, collocations e expressões úteis como entradas adicionais.

Uma quantidade aproximada é apenas referência. Ela nunca pode limitar, cortar, resumir ou substituir o inventário real.

## No modo de geração por tema

Quando houver somente tema, a quantidade pedida orienta a escala. Se o usuário não informar quantidade, gere um conjunto prático, equilibrado e suficiente para o nível e para o tema, sem preencher o resultado com termos aleatórios.

Em qualquer modo:

* não corte o resultado;
* não use reticências;
* não entregue amostra parcial;
* não omita palavras para caber em um número;
* não invente termos desconectados apenas para alcançar uma meta;
* no modo ambos, conte o total combinado dos lados A e B;
* expressões adicionais contam como entradas próprias, mas não substituem palavras.

# 17. ADEQUAÇÃO AO NÍVEL DO ALUNO SEM PERDER PRECISÃO

O nível altera a profundidade da explicação, não a verdade da tradução nem a cobertura estrutural.

Para iniciantes:

* use tradução principal direta e natural;
* mantenha notes curtas e claras;
* priorize alternativas frequentes;
* explique palavras funcionais sem jargão desnecessário.

Para intermediários:

* inclua sentidos contextuais relevantes;
* registre alternativas frequentes;
* destaque chunks, phrasal verbs e diferenças gramaticais úteis;
* sinalize falsos cognatos e usos não literais.

Para avançados:

* inclua nuances de sentido;
* registre formalidade, registro, collocations e restrições de uso;
* explique diferenças semânticas relevantes;
* preserve precisão de tempo, aspecto, voz, modalidade e função sintática.

Mesmo para iniciantes, não use uma tradução incorreta apenas por parecer mais simples. Simplifique a explicação, não o sentido.

O nível nunca autoriza:

* omitir palavras do inventário;
* substituir formas flexionadas por lemas;
* misturar palavra e expressão;
* usar tradução genérica incompatível com o contexto;
* alterar a estrutura do JSON.`;
}
