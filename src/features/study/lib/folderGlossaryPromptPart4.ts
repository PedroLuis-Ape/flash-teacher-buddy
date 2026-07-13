export function folderGlossaryPromptPart4(): string {
  return `# 10. REGRAS DO CAMPO note

Use uma string curta, objetiva e pedagogicamente útil quando ela ajudar a explicar:

* sentido contextual;
* classe ou função gramatical;
* forma flexionada;
* tempo, aspecto, voz, pessoa ou número;
* registro formal, informal, técnico ou regional;
* diferença entre tradução literal e natural;
* ambiguidade ou conflito de sentidos;
* diferença entre palavra isolada e expressão;
* falso cognato;
* restrição de uso;
* nome próprio, empréstimo, sigla ou forma que permanece igual no idioma de destino;
* erro comum que o aluno provavelmente cometeria.

Use null quando nenhuma observação realmente ajudar. Nunca use string vazia, placeholder, justificativa genérica ou texto como "depende do contexto" sem dizer de que maneira depende.

A note não deve repetir translation, copiar o exemplo inteiro, inventar regra gramatical, esconder incerteza ou funcionar como uma lista desorganizada de significados.

Quando uma única entrada consolidar usos diferentes do mesmo term no mesmo lado, note deve explicar claramente qual sentido foi escolhido como principal e como as alternatives se relacionam aos demais exemplos.`;
}
