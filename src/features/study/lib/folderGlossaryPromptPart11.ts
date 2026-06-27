export function folderGlossaryPromptPart11(): string {
  return `# 18. DEDUPLICAÇÃO OBRIGATÓRIA

Compare term ignorando espaços externos e diferenças de maiúsculas. Mantenha uma única entrada por combinação side + term. Una traduções secundárias em alternatives e remova alternativas vazias, repetidas ou iguais à tradução principal.

# 19. REGRAS DE SINTAXE JSON

Use aspas duplas em chaves e strings, null sem aspas e true ou false sem aspas. Não use vírgula final, undefined, NaN, comentários, reticências, chaves sem aspas ou aspas simples como delimitador. Escape aspas internas e quebras de linha corretamente.`;
}
