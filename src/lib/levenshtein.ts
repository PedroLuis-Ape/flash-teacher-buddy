/**
 * Calcula a distância de Levenshtein entre duas strings
 * Retorna o número mínimo de operações (inserção, deleção, substituição) necessárias
 * IMPORTANTE: Recebe strings já normalizadas para comparação justa
 */
export function levenshteinDistance(str1: string, str2: string): number {
  // Valida entrada
  if (!str1 || !str2 || typeof str1 !== 'string' || typeof str2 !== 'string') {
    return Math.max(str1?.length || 0, str2?.length || 0);
  }
  
  // Normaliza para comparação (minúsculas e trim)
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  // Casos especiais
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  // Matriz para armazenar distâncias
  const matrix: number[][] = Array(len1 + 1);
  
  // Inicializa a primeira linha e coluna
  for (let i = 0; i <= len1; i++) {
    matrix[i] = Array(len2 + 1);
    matrix[i][0] = i;
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Calcula as distâncias
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deleção
        matrix[i][j - 1] + 1,      // inserção
        matrix[i - 1][j - 1] + cost // substituição
      );
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Verifica se a resposta está quase correta (1 caractere de diferença)
 * Aplica normalização completa antes da comparação
 */
export function isAlmostCorrect(userAnswer: string, correctAnswer: string): boolean {
  if (!userAnswer || !correctAnswer) return false;
  
  // Normaliza completamente para comparação justa
  const normalizedUser = userAnswer
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
    
  const normalizedCorrect = correctAnswer
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  
  const distance = levenshteinDistance(normalizedUser, normalizedCorrect);
  return distance === 1;
}

