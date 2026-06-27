export function folderGlossaryPromptPart2(): string {
  return `# 8. REGRAS DO CAMPO translation

translation é a tradução principal da entrada.

* deve ser uma string obrigatória e não vazia;
* use a tradução mais natural ou adequada ao contexto;
* coloque somente uma tradução principal;
* não coloque várias traduções separadas por vírgulas;
* traduções secundárias devem ficar em alternatives.

Exemplo correto: translation contém "poderia" e alternatives contém ["podia", "conseguia"].
Exemplo incorreto: colocar "poderia, podia, conseguia" inteiro dentro de translation.`;
}
