export function folderGlossaryPromptPart12(title: string): string {
  return `# 20. EXEMPLOS DE FORMATOS PROIBIDOS

Não use alternatives como string ou null, side como "ambos", active como texto, note como string vazia, folder.id inventado, campos original_text ou translated_text, nem texto antes ou depois do JSON.

# 21. CHECKLIST INTERNO OBRIGATÓRIO

Confirme silenciosamente: raiz somente com schema, version, folder e entries; schema e version exatos; folder.name igual a "${title}"; nenhuma propriedade folder.id; entries não vazio; oito campos por entrada; strings obrigatórias preenchidas; alternatives sempre array; note útil ou null; side A ou B; idiomas coerentes; active booleano; sem duplicatas no mesmo lado; JSON completo e válido para JSON.parse.

# 22. DADOS QUE O USUÁRIO VAI FORNECER

Tema, texto, palavras ou material de origem:
[COLE OU DESCREVA AQUI]

Quantidade aproximada de entradas:
[INFORME AQUI]

Nível do aluno:
[INFORME AQUI]

Lado de origem:
[A, B OU AMBOS]

Depois que os dados necessários forem recebidos, devolva somente o objeto JSON final.`;
}
