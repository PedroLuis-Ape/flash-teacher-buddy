export function folderGlossaryPromptPart11(): string {
  return `# 18. DEDUPLICAÇÃO OBRIGATÓRIA SEM PERDER INFORMAÇÃO

Compare term ignorando espaços externos e diferenças de maiúsculas e minúsculas. Mantenha uma única entrada por combinação side + term.

Quando encontrar duplicatas no mesmo lado:

1. preserve a forma canônica mais adequada do term;
2. escolha a tradução principal mais bem sustentada pelos exemplos;
3. una traduções secundárias válidas em alternatives;
4. remova alternativas vazias, repetidas, idênticas à tradução principal ou no idioma errado;
5. consolide em note diferenças de sentido, gramática ou registro que sejam realmente úteis;
6. não descarte um sentido comprovado apenas para eliminar a duplicata;
7. não crie duas entradas iguais para separar classe gramatical, sentido ou capitalização.

Palavra e expressão não são duplicatas. Por exemplo, "because", "of" e "because of" são três terms diferentes e podem coexistir no mesmo side.

Formas flexionadas diferentes também não são duplicatas quando aparecem de fato no material. Por exemplo, "work", "worked" e "working" podem coexistir como entradas distintas.

# 19. REGRAS DE SINTAXE JSON

Use aspas duplas em chaves e strings, null sem aspas e true ou false sem aspas.

Não use:

* vírgula final;
* undefined;
* NaN ou Infinity;
* comentários;
* reticências;
* chaves sem aspas;
* aspas simples como delimitador;
* bloco Markdown;
* texto antes ou depois do objeto;
* múltiplos objetos JSON separados.

Escape corretamente aspas internas, barras invertidas, caracteres especiais e quebras de linha. O objeto inteiro precisa ser aceito diretamente por JSON.parse sem limpeza ou correção manual.`;
}
