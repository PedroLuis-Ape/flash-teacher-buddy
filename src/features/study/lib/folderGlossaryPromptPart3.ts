export function folderGlossaryPromptPart3(): string {
  return `# 9. REGRAS DO CAMPO alternatives

Use sempre um array de strings. Use [] quando não houver alternativas úteis.

Inclua em alternatives somente traduções secundárias que sejam:

* semanticamente compatíveis com o termo;
* naturais no idioma de destino;
* sustentadas pelo material ou pedagogicamente relevantes para o mesmo uso;
* diferentes da tradução principal;
* diferentes entre si.

Não use alternatives como depósito de significados aleatórios de dicionário. Não inclua sentidos que não tenham relação com os exemplos apenas para parecer completo.

Quando o termo tiver mais de um sentido realmente presente no material, mantenha o sentido predominante em translation, coloque os demais sentidos comprovados em alternatives e explique a distinção em note.

Quando houver variação de registro, região, formalidade ou estrutura gramatical, inclua a alternativa apenas se ela ajudar o aluno. Explique a restrição em note.

Remova alternativas vazias, duplicadas, idênticas à tradução principal, no idioma errado, excessivamente literais ou semanticamente incompatíveis.`;
}
