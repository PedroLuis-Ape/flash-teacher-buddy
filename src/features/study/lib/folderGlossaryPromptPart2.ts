export function folderGlossaryPromptPart2(): string {
  return `# 8. REGRAS SEMÂNTICAS DO CAMPO translation

translation é a melhor tradução principal da entrada para o uso realmente apresentado no material.

Antes de preencher translation, analise silenciosamente:

1. o idioma de origem e o idioma de destino;
2. todos os exemplos em que o termo aparece;
3. a classe gramatical usada em cada exemplo;
4. a forma gramatical concreta;
5. o sentido contextual predominante;
6. número, pessoa, tempo, aspecto, voz, grau, modalidade e registro quando forem relevantes;
7. a forma mais natural de expressar esse sentido no idioma de destino.

Regras obrigatórias:

* translation deve ser uma string obrigatória e não vazia;
* coloque somente uma tradução principal;
* não coloque várias traduções separadas por vírgulas, barras ou ponto e vírgula;
* traduções secundárias devem ficar em alternatives;
* escolha o sentido sustentado pelos exemplos, não o primeiro significado de um dicionário;
* prefira equivalência natural a tradução palavra por palavra;
* preserve a função gramatical sempre que o idioma de destino permitir naturalmente;
* não transforme auxiliar em verbo lexical;
* não transforme substantivo em verbo, adjetivo em substantivo ou outra classe sem que o contexto e o idioma de destino exijam isso;
* não apague informação relevante de singular, plural, pessoa, tempo, aspecto ou voz;
* não force uma flexão artificial quando o idioma de destino precisar de outra estrutura natural; explique a diferença em note;
* não copie term como translation apenas para preencher o campo;
* não use definição longa, frase explicativa ou exemplo dentro de translation;
* não invente um sentido que não aparece nem é sustentado pelo material;
* não use tradução excessivamente literal quando ela soar artificial ou mudar o sentido;
* verifique falsos cognatos e cognatos enganosos antes de aprovar a tradução.

Exemplos de decisão contextual:

* "were" pode corresponder a "eram", "estavam" ou "foram", conforme a construção; não use automaticamente "ser/estar";
* em "Millions were enslaved", "enslaved" deve refletir o particípio passivo e o plural de forma natural, como "escravizados", e não apenas o lema "escravizar";
* "bank" pode significar "banco" ou "margem", conforme os exemplos; não escolha um sentido financeiro sem evidência;
* "actually" normalmente não significa "atualmente"; verifique o falso cognato no contexto;
* uma preposição pode exigir tradução diferente ou nenhuma palavra isolada no destino; registre a equivalência pedagógica mais útil e explique a restrição em note.

Palavras funcionais exigem o mesmo rigor das palavras lexicais. Artigos, auxiliares, pronomes, determinantes, preposições, conectores e partículas não devem receber uma tradução genérica sem considerar a função real nos exemplos.

Quando o mesmo term aparecer com mais de um sentido compatível, use em translation o sentido predominante ou mais bem sustentado. Coloque sentidos secundários realmente presentes em alternatives e explique a diferença em note.

Quando os exemplos apresentarem sentidos incompatíveis que não possam ser representados com segurança por uma única tradução principal, escolha o sentido predominante, registre os demais em alternatives e declare claramente o conflito em note. Não crie entradas duplicadas no mesmo lado para contornar a deduplicação do importador.

Quando um nome próprio, empréstimo linguístico, sigla ou cognato legítimo permanecer igual no idioma de destino, a repetição pode ser válida, mas note deve explicar por que a forma permanece inalterada. Fora desses casos, term e translation idênticos indicam provável erro.

Exemplo correto: translation contém "poderia" e alternatives contém ["podia", "conseguia"].

Exemplo incorreto: translation contém "poderia, podia, conseguia" ou repete o termo original sem justificativa.`;
}
