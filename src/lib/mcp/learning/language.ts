/**
 * Conhecimento linguistico por idioma: palavras funcionais basicas, particulas
 * de phrasal verbs e expressoes basicas que NAO devem virar candidato.
 *
 * Regra de produto (requisito explicito): artigos, particulas e preposicoes
 * muito basicas sao ignorados por padrao, MAS a expressao que contem essas
 * palavras continua sendo analisada ("look after", "get over", "run into").
 * Por isso a deteccao de expressao roda ANTES do filtro de palavra funcional.
 */

import type { AnalysisLanguage, LanguageDetection } from "./types";
import { normalizeSurface, type TextToken } from "./normalize";

const EN_FUNCTION_WORDS = [
  "a", "an", "the", "of", "to", "in", "on", "at", "for", "with", "from", "by", "as", "is", "are",
  "was", "were", "be", "been", "being", "am", "do", "does", "did", "done", "and", "or", "but", "if",
  "so", "than", "that", "this", "these", "those", "there", "here", "it", "its", "i", "you", "he",
  "she", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "their", "our", "not",
  "no", "yes", "will", "would", "can", "could", "shall", "should", "may", "might", "must", "have",
  "has", "had", "just", "very", "too", "also", "then", "when", "where", "which", "who", "whom",
  "whose", "what", "how", "why", "while", "into", "over", "up", "down", "out", "off", "about",
  "after", "before", "again", "all", "any", "some", "each", "every", "both", "few", "more", "most",
  "other", "such", "only", "own", "same", "am", "s", "t", "d", "ll", "re", "ve", "m",
];

const PT_FUNCTION_WORDS = [
  "o", "a", "os", "as", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das", "em", "no",
  "na", "nos", "nas", "por", "pelo", "pela", "pelos", "pelas", "para", "pra", "com", "sem", "sob",
  "sobre", "entre", "até", "desde", "que", "qual", "quais", "quem", "quando", "onde", "como",
  "porque", "se", "e", "ou", "mas", "também", "não", "sim", "é", "são", "era",
  "eram", "foi", "foram", "ser", "estar", "está", "estão", "estou", "tem", "têm",
  "tinha", "havia", "há", "eu", "tu", "ele", "ela", "nós", "vós", "eles", "elas",
  "você", "vocês", "me", "te", "lhe", "vos", "lhes", "meu", "minha", "seu", "sua", "nosso",
  "nossa", "dele", "dela", "isso", "isto", "aquilo", "esse", "essa", "este", "esta", "aquele",
  "aquela", "muito", "mais", "menos", "já", "ainda", "só", "apenas", "bem", "mal", "aqui",
  "ali", "lá", "então", "portanto", "pois", "ao", "aos", "à", "às", "num",
  "numa", "dum", "duma", "cujo", "cuja", "nem", "tambem",
];

export const BASIC_FUNCTION_WORDS: Record<AnalysisLanguage, Set<string>> = {
  en: new Set(EN_FUNCTION_WORDS.map((word) => normalizeSurface(word))),
  pt: new Set(PT_FUNCTION_WORDS.map((word) => normalizeSurface(word))),
};

export function isBasicFunctionWord(key: string, language: AnalysisLanguage): boolean {
  return BASIC_FUNCTION_WORDS[language].has(key);
}

export function isBasicFunctionWordInAnyLanguage(key: string): boolean {
  return BASIC_FUNCTION_WORDS.en.has(key) || BASIC_FUNCTION_WORDS.pt.has(key);
}

/**
 * Particulas que podem formar phrasal verb / multi-word expression com um verbo.
 * A lista e do PRODUCT (nao "toda preposicao"): evita que "read books in" vire
 * expressao, mantendo "look after", "get over", "run into", "take care of".
 */
export const PHRASAL_PARTICLES: Record<AnalysisLanguage, Set<string>> = {
  en: new Set([
    "up", "down", "out", "off", "on", "in", "over", "into", "through", "along", "across", "around",
    "about", "away", "back", "forward", "for", "after", "to", "with", "at", "against", "upon",
    "apart", "together", "ahead", "by",
  ]),
  pt: new Set(["de", "em", "com", "por", "para", "a", "ao", "sobre", "até", "contra"]),
};

/**
 * Combinacoes sintaticas basicas que NAO sao unidades lexicais.
 * Sem esta lista, "look at" e "go to" virariam "vocabulario novo".
 */
export const BASIC_MWE: Record<AnalysisLanguage, Set<string>> = {
  en: new Set([
    "look at", "look like", "go to", "come to", "come in", "get in", "be in", "arrive at",
    "listen to", "talk to", "speak to", "walk to", "live in", "work in", "sit in", "stand in",
    "wait in", "stay in", "be at", "be on", "be for", "go on", "go in", "come on", "get to",
    "get on", "get off", "put on", "take on", "try to", "want to", "need to", "have to",
  ]),
  pt: new Set([
    "olhar para", "ir a", "ir para", "vir de", "estar em", "ficar em", "morar em", "trabalhar em",
    "chegar a", "chegar em", "gostar de", "precisar de", "acabar de", "deixar de", "começar a",
  ]),
};

export function isBasicMwe(phraseKey: string, language: AnalysisLanguage): boolean {
  return BASIC_MWE[language].has(phraseKey);
}

/**
 * Particulas "fortes": quando aparecem depois de um verbo, a combinacao tem
 * alta chance de ser uma unidade lexical propria (get over, run into, give up).
 */
export const STRONG_PARTICLES: Record<AnalysisLanguage, Set<string>> = {
  en: new Set([
    "up", "out", "off", "over", "into", "through", "away", "back", "apart", "together", "ahead",
    "along", "across", "around", "down", "forward", "upon",
  ]),
  pt: new Set(["de", "em", "com", "por", "para"]),
};

/**
 * Particulas "fracas" (preposicoes muito comuns). So viram candidato quando a
 * combinacao esta na lista curada abaixo: evita inventar "bank of", "read in"
 * e outros falsos phrasal verbs.
 */
export const COMMON_PHRASAL: Record<AnalysisLanguage, Set<string>> = {
  en: new Set([
    "look for", "look after", "look into", "look up to", "look forward to", "look out for",
    "wait for", "ask for", "care for", "call for", "hope for", "search for", "reach for",
    "deal with", "agree with", "disagree with", "reason with", "cope with", "stick with",
    "depend on", "rely on", "focus on", "work on", "count on", "insist on", "base on",
    "belong to", "refer to", "listen to", "lead to", "add to", "adapt to", "object to",
    "laugh at", "point at", "smile at", "glance at", "wonder at",
    "take after", "take care of", "take part in", "make fun of", "make sure of",
    "pay attention to", "get rid of", "get away with", "come up with", "put up with",
    "catch up with", "keep up with", "run out of", "end up with", "deal in",
  ]),
  pt: new Set([
    "gostar de", "precisar de", "contar com", "depender de", "cuidar de", "lembrar de",
    "esquecer de", "precisar de", "acreditar em", "pensar em", "sonhar com", "preocupar com",
    "concordar com", "discordar de", "duvidar de", "pertencer a", "assistir a", "chegar a",
  ]),
};

const EN_MARKERS = [
  "the", "of", "and", "to", "is", "are", "was", "were", "you", "that", "this", "with", "for",
  "have", "has", "will", "would", "but", "not", "they", "there", "from", "what", "when", "which",
  "who", "how", "why", "she", "his", "her", "their", "it", "as", "at", "if", "or", "an", "be",
];

const PT_MARKERS = [
  "que", "não", "uma", "um", "com", "para", "por", "mais", "como", "mas", "seu", "sua",
  "isso", "este", "esta", "são", "foi", "ser", "estar", "tem", "têm", "você", "ele",
  "ela", "nós", "eles", "elas", "também", "muito", "quando", "onde", "porque", "dos", "das",
  "nas", "nos", "pelo", "pela", "aos", "ao", "é", "há", "já", "só",
];

const EN_MARKER_SET = new Set(EN_MARKERS);
const PT_MARKER_SET = new Set(PT_MARKERS);

/**
 * Deteccao de idioma por evidencia observavel: palavras funcionais
 * inequivocas + acentos tipicos do portugues. Sem evidencia suficiente o motor
 * declara a confianca BAIXA em vez de adivinhar (o chamador marca palavra
 * funcional como AMBIGUOUS nesse caso).
 */
export function detectLanguage(tokens: TextToken[]): LanguageDetection {
  let en = 0;
  let pt = 0;
  for (const token of tokens) {
    if (EN_MARKER_SET.has(token.folded)) en += 1;
    if (PT_MARKER_SET.has(token.folded)) pt += 1;
    if (/[ãõç]/.test(token.folded)) pt += 2;
    if (token.folded === "o" || token.folded === "a") en += 1;
    if (/(ção|ções|ão)$/.test(token.folded)) pt += 1;
  }
  const best = Math.max(en, pt);
  const second = Math.min(en, pt);
  // Evidencia minima: 4 tokens e dois marcadores inequivocos. Com pouco texto
  // (ou marcadores equilibrados) a confianca e baixa de proposito, e nesse caso
  // palavra funcional vira AMBIGUOUS em vez de ser descartada em silencio.
  const confidence: LanguageDetection["confidence"] =
    tokens.length >= 4 && best >= 2 && (second === 0 || best >= second * 2) ? "high" : "low";
  const language: AnalysisLanguage = pt > en ? "pt" : "en";
  return {
    language,
    source: "detected",
    confidence,
    scores: { en, pt },
  };
}

export function explicitLanguage(language: AnalysisLanguage): LanguageDetection {
  return { language, source: "explicit", confidence: "high", scores: { en: 0, pt: 0 } };
}

export function fallbackLanguage(): LanguageDetection {
  return { language: "en", source: "fallback", confidence: "low", scores: { en: 0, pt: 0 } };
}

/** Conteudo real: nao e palavra funcional basica em nenhum dos idiomas. */
export function isContentToken(token: TextToken, language: AnalysisLanguage): boolean {
  if (isBasicFunctionWord(token.key, language)) return false;
  return token.key.length > 0;
}
