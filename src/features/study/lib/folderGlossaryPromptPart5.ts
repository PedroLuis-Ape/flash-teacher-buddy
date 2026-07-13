export function folderGlossaryPromptPart5(): string {
  return `# 11. REGRAS DO CAMPO side

Use somente os valores "A" ou "B".

side indica em qual lado da pasta o term existe como texto de origem:

* use "A" para palavras e expressões extraídas ou geradas para o lado A;
* use "B" para palavras e expressões extraídas ou geradas para o lado B;
* não escolha side com base apenas no idioma que você acha que reconheceu;
* respeite os rótulos e a organização fornecidos pelo usuário;
* não coloque uma palavra do lado A no lado B apenas porque sua tradução aparece lá;
* no modo ambos, faça inventários independentes para A e B.

Entradas espelhadas são permitidas em lados diferentes quando cada termo pertence legitimamente ao respectivo lado. O mesmo term não pode se repetir dentro do mesmo side, mesmo que apareça com sentidos diferentes ou diferença de capitalização.`;
}
