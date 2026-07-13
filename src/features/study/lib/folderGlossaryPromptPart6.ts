export function folderGlossaryPromptPart6(): string {
  return `# 12. REGRAS DOS CAMPOS DE IDIOMA

Use exatamente os rótulos definidos para a pasta.

Para uma entrada com side "A":

* source_language deve ser "${'${sideA}'}" no prompt final gerado;
* target_language deve ser o rótulo do lado B.

Para uma entrada com side "B":

* source_language deve ser o rótulo do lado B;
* target_language deve ser o rótulo do lado A.

Como esta função não recebe os rótulos diretamente, siga os valores já impressos nas seções iniciais do prompt e no exemplo canônico.

Regras obrigatórias:

* não traduza para o mesmo idioma por engano;
* não troque os rótulos por códigos como en, pt ou fr, salvo se esses forem os rótulos exatos da pasta;
* não invente nomes de idioma;
* não use "A", "B", "origem", "destino" ou "ambos" como valor de source_language ou target_language;
* quando side mudar, inverta corretamente origem e destino;
* confirme que translation está escrita no target_language correspondente.

Se o material contiver nome próprio, sigla, empréstimo ou cognato que permaneça graficamente igual no destino, mantenha os campos de idioma corretos e explique a permanência em note. Não use a igualdade gráfica como motivo para trocar a direção dos idiomas.`;
}
