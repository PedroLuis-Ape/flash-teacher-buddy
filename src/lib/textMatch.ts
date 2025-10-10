// Utility functions for text matching and comparison

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[.,!?;:]/g, "") // Remove light punctuation
    .replace(/\s+/g, " ") // Collapse spaces
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function isAcceptableAnswer(
  input: string,
  answers: string[],
  threshold: number = 0.1
): { isCorrect: boolean; matchedAnswer?: string } {
  const normalizedInput = normalize(input);

  for (const answer of answers) {
    const normalizedAnswer = normalize(answer);
    
    // Exact match after normalization
    if (normalizedInput === normalizedAnswer) {
      return { isCorrect: true, matchedAnswer: answer };
    }

    // Levenshtein distance check
    const distance = levenshtein(normalizedInput, normalizedAnswer);
    const maxDistance = Math.floor(normalizedAnswer.length * threshold);

    if (distance <= maxDistance) {
      return { isCorrect: true, matchedAnswer: answer };
    }
  }

  return { isCorrect: false };
}

export function getHint(answer: string, level: number): string {
  if (level === 1) {
    // First hint: first letter + length
    return `${answer[0]}${"_".repeat(answer.length - 1)} (${answer.length} letras)`;
  } else if (level === 2) {
    // Second hint: reveal 30% of letters
    const revealCount = Math.ceil(answer.length * 0.3);
    const indices = new Set<number>();
    indices.add(0); // Always show first letter
    
    while (indices.size < revealCount) {
      indices.add(Math.floor(Math.random() * answer.length));
    }
    
    return answer
      .split("")
      .map((char, idx) => (indices.has(idx) ? char : "_"))
      .join("");
  }
  
  return answer; // Level 3: full reveal
}
