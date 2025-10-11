// Calcula a distância de Levenshtein entre duas strings
// Retorna o número mínimo de operações (inserção, deleção, substituição) necessárias
export function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  // Matriz para armazenar distâncias
  const matrix: number[][] = [];
  
  // Inicializa a primeira linha e coluna
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
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

// Verifica se a resposta está quase correta (1 caractere de diferença)
export function isAlmostCorrect(userAnswer: string, correctAnswer: string): boolean {
  const distance = levenshteinDistance(userAnswer, correctAnswer);
  return distance === 1;
}
