export function folderGlossaryPromptPart12(title: string): string {
  return `# 20. EXEMPLOS DE FORMATOS PROIBIDOS

Não use alternatives como string ou null, side como "ambos", active como texto, note como string vazia, folder.id inventado, campos original_text ou translated_text, nem texto antes ou depois do JSON.

Também é proibido:

* omitir artigos, pronomes, auxiliares, preposições, conectores ou palavras comuns;
* substituir uma palavra flexionada pelo lema sem manter a forma original;
* considerar palavras individuais cobertas apenas por estarem dentro de uma expressão;
* entregar somente palavras "importantes" ou uma amostra do material;
* cortar entries para respeitar uma quantidade aproximada;
* escolher uma tradução sem ler os exemplos disponíveis;
* usar automaticamente o primeiro significado de dicionário;
* ignorar classe gramatical, número, pessoa, tempo, aspecto ou voz quando forem relevantes;
* traduzir uma palavra isolada apenas com o significado da expressão completa que a contém;
* esconder sentidos incompatíveis dentro de alternatives;
* usar tradução artificial, excessivamente literal, no idioma errado ou sem apoio no material;
* declarar como definitivamente validada uma tradução que ainda não passou pela revisão semântica independente.

# 21. CHECKLIST INTERNO OBRIGATÓRIO

Confirme silenciosamente:

1. raiz somente com schema, version, folder e entries;
2. schema e version exatos;
3. folder.name igual a "${title}";
4. nenhuma propriedade folder.id;
5. entries não vazio;
6. oito campos por entrada;
7. strings obrigatórias preenchidas;
8. alternatives sempre array;
9. note útil ou null;
10. side A ou B;
11. idiomas coerentes;
12. active booleano;
13. sem duplicatas no mesmo lado;
14. todas as palavras únicas do material possuem entrada individual exata no mesmo lado;
15. artigos, pronomes, auxiliares, preposições, conectores e palavras comuns foram incluídos;
16. formas flexionadas encontradas no material foram preservadas;
17. cada palavra de um chunk também possui sua própria entrada individual;
18. chunks úteis coexistem com as palavras individuais;
19. nenhuma palavra foi omitida por causa de quantidade, nível ou aparente simplicidade;
20. todos os exemplos disponíveis foram lidos antes da escolha da tradução;
21. translation corresponde ao sentido realmente usado no material;
22. classe gramatical e função contextual foram verificadas;
23. singular, plural, pessoa, tempo, aspecto, voz, grau e modalidade foram preservados quando relevantes;
24. auxiliares, modais, partículas, contrações e palavras funcionais foram traduzidos pela função real no exemplo;
25. falsos cognatos, literalidade excessiva e naturalidade no idioma de destino foram verificados;
26. palavra individual e expressão completa foram avaliadas separadamente;
27. sentidos incompatíveis foram indicados claramente em note, sem serem escondidos em alternatives;
28. nenhuma tradução repete indevidamente o termo de origem quando os idiomas são diferentes;
29. nenhuma tradução foi declarada como definitivamente validada antes da revisão semântica independente;
30. JSON completo e válido para JSON.parse.

# 22. DADOS QUE O USUÁRIO VAI FORNECER

Tema, texto, palavras ou material de origem:
[COLE OU DESCREVA AQUI]

Quantidade aproximada de entradas — opcional e nunca limitadora:
[INFORME AQUI OU DEIXE EM BRANCO]

Nível do aluno:
[INFORME AQUI]

Lado de origem:
[A, B OU AMBOS]

Depois que os dados necessários forem recebidos, devolva somente o objeto JSON final.`;
}
