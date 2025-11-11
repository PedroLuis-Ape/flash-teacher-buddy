/**
 * Utilitários para parsing de CSV do Modo Reino
 * 
 * Regras:
 * - () = hint (não conta na correção/TTS)
 * - [] com | = alternativas aceitas
 * - * marca resposta correta em multiple choice
 */

export interface ParsedActivity {
  kingdom_code: string;
  level_code: string;
  unit: string;
  activity_type: string;
  prompt: string;
  hint: string | null;
  canonical_answer: string;
  alt_answers: string[];
  choices: any[] | null;
  lang: string;
  points: number | null;
  tags: string[];
}

/**
 * Extrai hint de texto entre parênteses
 */
export function extractHint(text: string): { text: string; hint: string | null } {
  const hintRegex = /\(([^)]+)\)/g;
  const matches = text.match(hintRegex);
  
  if (!matches) return { text, hint: null };
  
  const hint = matches.map(m => m.slice(1, -1)).join(" ");
  const cleanText = text.replace(hintRegex, "").trim().replace(/\s+/g, " ");
  
  return { text: cleanText, hint };
}

/**
 * Extrai alternativas de texto entre colchetes
 */
export function extractAlternatives(text: string): { text: string; alternatives: string[] } {
  const altRegex = /\[([^\]]+)\]/g;
  const matches = text.match(altRegex);
  
  if (!matches) return { text, alternatives: [] };
  
  const alternatives: string[] = [];
  matches.forEach(match => {
    const content = match.slice(1, -1);
    const parts = content.split("|").map(p => p.trim()).filter(Boolean);
    alternatives.push(...parts);
  });
  
  const cleanText = text.replace(altRegex, "").trim().replace(/\s+/g, " ");
  
  return { text: cleanText, alternatives };
}

/**
 * Parse de choices para multiple choice
 */
export function parseChoices(choicesStr: string, answer: string): any[] {
  if (!choicesStr) return [];
  
  const parts = choicesStr.split("||").map(p => p.trim()).filter(Boolean);
  const choices: any[] = [];
  
  parts.forEach((part, idx) => {
    const isCorrect = part.startsWith("*");
    const text = isCorrect ? part.slice(1).trim() : part.trim();
    
    choices.push({
      id: `choice_${idx}`,
      text,
      is_correct: isCorrect || text === answer
    });
  });
  
  return choices;
}

/**
 * Normaliza resposta para comparação
 */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[.,!?;:]+/g, "") // remove punctuation
    .replace(/\s+/g, " "); // collapse spaces
}

/**
 * Verifica se resposta do usuário está correta
 */
export function checkAnswer(
  userAnswer: string,
  canonical: string,
  alternatives: string[]
): boolean {
  const normalized = normalizeAnswer(userAnswer);
  const validAnswers = [canonical, ...alternatives].map(normalizeAnswer);
  
  return validAnswers.includes(normalized);
}

/**
 * Parse de uma linha do CSV
 */
export function parseCSVRow(row: any, lineNumber: number): ParsedActivity {
  const errors: string[] = [];
  
  // Validar campos obrigatórios
  if (!row.kingdom_code || !["K1", "K2", "K3"].includes(row.kingdom_code)) {
    errors.push(`Linha ${lineNumber}: kingdom_code inválido (deve ser K1, K2 ou K3)`);
  }
  
  if (!row.level_code) {
    errors.push(`Linha ${lineNumber}: level_code obrigatório`);
  }
  
  if (!row.activity_type) {
    errors.push(`Linha ${lineNumber}: activity_type obrigatório`);
  }
  
  const validTypes = ["translate", "multiple_choice", "dictation", "fill_blank", "order_words", "match"];
  if (row.activity_type && !validTypes.includes(row.activity_type)) {
    errors.push(`Linha ${lineNumber}: activity_type inválido (deve ser um de: ${validTypes.join(", ")})`);
  }
  
  if (!row.prompt) {
    errors.push(`Linha ${lineNumber}: prompt obrigatório`);
  }
  
  if (!row.answer) {
    errors.push(`Linha ${lineNumber}: answer obrigatório`);
  }
  
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  
  // Extrair hint e alternativas
  const { text: promptClean, hint: promptHint } = extractHint(row.prompt || "");
  const { text: answerClean, alternatives } = extractAlternatives(row.answer || "");
  const finalHint = promptHint || (row.hint ? extractHint(row.hint).text : null);
  
  // Parse choices se for multiple choice
  let choices = null;
  if (row.activity_type === "multiple_choice" && row.choices) {
    choices = parseChoices(row.choices, answerClean);
  }
  
  // Parse tags
  const tags = row.tags ? row.tags.split(";").map((t: string) => t.trim()).filter(Boolean) : [];
  
  return {
    kingdom_code: row.kingdom_code,
    level_code: row.level_code,
    unit: row.unit || "Outros",
    activity_type: row.activity_type,
    prompt: promptClean,
    hint: finalHint,
    canonical_answer: answerClean,
    alt_answers: alternatives,
    choices,
    lang: row.lang || "en-US",
    points: row.points ? parseInt(row.points) : null,
    tags
  };
}

/**
 * Pontos base por tipo de atividade (antes do multiplicador x2)
 */
export const BASE_POINTS: Record<string, number> = {
  translate: 10,
  multiple_choice: 8,
  dictation: 12,
  fill_blank: 10,
  order_words: 10,
  match: 12
};

/**
 * Calcula pontos para uma atividade (base x2)
 */
export function calculatePoints(activityType: string, customPoints?: number | null): number {
  if (customPoints) return customPoints * 2;
  return (BASE_POINTS[activityType] || 10) * 2;
}
