export function folderGlossaryPromptPart12(title: string): string {
  return `# 20. FORMATOS E COMPORTAMENTOS PROIBIDOS

Não use alternatives como string ou null, side como "ambos", active como texto, note como string vazia, folder.id inventado, campos original_text ou translated_text, nem texto antes ou depois do JSON.

Também é proibido:

* omitir artigos, pronomes, determinantes, auxiliares, preposições, conectores, partículas ou palavras comuns;
* substituir uma palavra flexionada pelo lema sem manter a forma original;
* considerar palavras individuais cobertas apenas por estarem dentro de uma expressão;
* entregar somente palavras "importantes", palavras difíceis ou uma amostra do material;
* cortar entries para respeitar uma quantidade aproximada;
* misturar palavras dos lados A e B;
* traduzir para o idioma errado;
* escolher automaticamente o primeiro significado de dicionário;
* ignorar os exemplos disponíveis;
* usar falso cognato por semelhança gráfica;
* usar tradução excessivamente literal que soe artificial ou altere o sentido;
* traduzir auxiliar como verbo lexical sem apoio contextual;
* perder singular, plural, pessoa, tempo, aspecto ou voz quando forem semanticamente relevantes;
* copiar term em translation como placeholder;
* colocar vários significados separados por vírgula dentro de translation;
* despejar significados não usados dentro de alternatives;
* criar duplicatas no mesmo side para separar sentidos;
* transformar frases comuns inteiras em terms sem unidade semântica real;
* inventar examples, IDs, confiança, status de revisão ou campos fora do schema;
* afirmar que a tradução foi semanticamente certificada; esta é a geração inicial e poderá passar por revisão independente.

# 21. CHECKLIST INTERNO OBRIGATÓRIO

Antes de responder, confirme silenciosamente todos os itens abaixo.

## Estrutura

1. a raiz contém somente schema, version, folder e entries;
2. schema é exatamente "app-piteco-folder-glossary";
3. version é exatamente "1.0";
4. folder.name é exatamente "${title}";
5. não existe folder.id;
6. entries não está vazio;
7. cada entrada contém exatamente oito campos;
8. todas as strings obrigatórias estão preenchidas;
9. alternatives é sempre array;
10. note é uma string útil ou null;
11. side é somente A ou B;
12. source_language e target_language usam os rótulos exatos da pasta;
13. active é booleano;
14. o JSON completo passa em JSON.parse.

## Cobertura estrutural

15. no modo de extração exata, todas as palavras únicas do material possuem entrada individual exata no mesmo lado;
16. artigos, pronomes, determinantes, auxiliares, preposições, conectores, partículas, numerais e palavras comuns foram incluídos;
17. formas flexionadas encontradas no material foram preservadas;
18. contrações, apóstrofos e hífens pertencentes ao termo foram preservados;
19. cada palavra de um chunk também possui sua própria entrada individual;
20. chunks úteis coexistem com as palavras individuais;
21. nenhuma palavra foi omitida por quantidade, nível, frequência ou aparente simplicidade;
22. não existem duplicatas por side + term;
23. formas flexionadas realmente distintas não foram deduplicadas como se fossem o mesmo term.

## Qualidade semântica

24. todos os exemplos disponíveis de cada term foram considerados;
25. translation corresponde ao sentido realmente usado;
26. a classe e a função gramatical foram verificadas;
27. número, pessoa, tempo, aspecto, voz, grau e modalidade foram preservados quando relevantes;
28. a tradução é natural no idioma de destino;
29. falsos cognatos e literalidade inadequada foram verificados;
30. palavras funcionais foram traduzidas conforme a função contextual, não por regra genérica;
31. translation contém uma única proposta principal;
32. alternatives contém somente propostas secundárias úteis, compatíveis e não repetidas;
33. note explica ambiguidades, conflitos, restrições ou diferenças importantes;
34. termos com sentidos diferentes foram consolidados sem esconder o conflito;
35. term e translation não são idênticos por erro ou placeholder;
36. nomes próprios, siglas, empréstimos ou cognatos inalterados possuem justificativa em note;
37. nenhuma expressão foi usada como tradução automática das palavras isoladas que a compõem;
38. nenhuma tradução foi simplificada a ponto de ficar incorreta para o nível do aluno.

## Resposta final

39. não existe Markdown, comentário, introdução ou conclusão;
40. não existem campos de revisão semântica, confiança, evidência ou status;
41. não existem reticências, amostras ou conteúdo cortado;
42. a resposta contém exatamente um objeto JSON puro, completo e importável.

Se qualquer item falhar, corrija silenciosamente antes de responder.

# 22. DADOS QUE O USUÁRIO VAI FORNECER

Tema, texto, palavras ou material de origem:
[COLE OU DESCREVA AQUI]

Quantidade aproximada de entradas — opcional; no modo de extração nunca limita a cobertura:
[INFORME AQUI OU DEIXE EM BRANCO]

Nível do aluno:
[INFORME AQUI]

Lado de origem:
[A, B OU AMBOS]

Depois que os dados necessários forem recebidos, devolva somente o objeto JSON final.`;
}
