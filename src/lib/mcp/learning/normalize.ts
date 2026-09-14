/**
 * Normalizacao linguistica do motor de analise de texto.
 *
 * Regra central: normalizar SEM apagar significado. A comparacao acontece em
 * tres niveis deliberadamente separados, e o nivel usado aparece sempre na
 * classificacao:
 *
 *   1. chave exata  -> casefold + pontuacao + espacos (mesma forma, mesma ordem)
 *   2. chave variante -> acento, ortografia (color/colour), contracao
 *      (don't / do not), hifen (well-known / well known)
 *   3. chave de lema -> flexao (studies/study, ran/run, casas/casa)
 *
 * O que NAO acontece: "look", "look for", "look after" e "look up to" tem
 * chaves exatas diferentes; palavras nunca sao comparadas com pedacos de
 * expressoes. Expressao e sempre comparada como sequencia inteira de tokens.
 *
 * A base da chave exata e compativel com public.normalize_term_for_check()
 * (lower + btrim + colapso de espacos) usada pelo checker de duplicatas do app:
 * tudo que aquela funcao considera o mesmo termo tambem colide aqui, e este
 * motor acrescenta os niveis 2 e 3 por cima.
 */

import type { AnalysisLanguage } from "./types";

export interface TextToken {
  /** Superficie original no texto. */
  raw: string;
  /** Chave normalizada (casefold, pontuacao dobrada, espacos colapsados). */
  key: string;
  /** Chave sem acentos (variante ortografica de digitacao). */
  folded: string;
  /** Variantes de token: sem acento, ortografia, contracao, hifen. */
  variants: string[];
  /** Offset inicial no texto original. */
  start: number;
  /** Offset final (exclusivo) no texto original. */
  end: number;
}

const CASE_FOLD_SPECIALS: Record<string, string> = {
  "ß": "ss", // sharp s
  "æ": "ae",
  "œ": "oe",
  "ø": "o",
  "đ": "d",
  "ð": "d",
  "þ": "th",
  "ł": "l",
  "ı": "i",
};

const APOSTROPHES = /[‘’ʼ´`]/g;
const DASHES = /[‐‑‒–—―]/g;
/** Mantem letras, numeros, espaco, apostrofo e hifen; o resto vira espaco. */
const NON_WORD = /[^\p{L}\p{N}\s'\-]/gu;
const COMBINING_MARKS = /\p{M}+/gu;

export function casefold(value: string): string {
  const lowered = value.normalize("NFKC").toLowerCase();
  let out = "";
  for (const char of lowered) out += CASE_FOLD_SPECIALS[char] ?? char;
  return out;
}

export function foldApostrophes(value: string): string {
  return value.replace(APOSTROPHES, "'").replace(DASHES, "-");
}

/**
 * Remove acentos. Usado apenas como chave de VARIANTE (nunca como chave exata):
 * em portugues "esta" e "esta" sao coisas diferentes, entao a diferenca precisa
 * continuar visivel na classificacao (KNOWN_VARIANT, com motivo).
 */
export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").normalize("NFC");
}

export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Chave de superficie: casefold + pontuacao dobrada + espacos normalizados. */
export function normalizeSurface(value: string): string {
  const cleaned = foldApostrophes(String(value ?? ""))
    .replace(NON_WORD, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^['\-]+/, "")
    .replace(/['\-]+$/, "");
  return collapseSpaces(casefold(cleaned));
}

export function normalizeTerm(value: string): string {
  return collapseSpaces(foldApostrophes(String(value ?? "")).replace(/\s+/g, " ").trim());
}

const EN_CONTRACTIONS: Record<string, string> = {
  "can't": "cannot",
  cant: "cannot",
  "won't": "will not",
  wont: "will not",
  "ain't": "is not",
  aint: "is not",
  "i'm": "i am",
  im: "i am",
  "let's": "let us",
  lets: "let us",
  "y'all": "you all",
  yall: "you all",
  gonna: "going to",
  wanna: "want to",
  gotta: "got to",
  dunno: "do not know",
};

const EN_CONTRACTION_REVERSE: Record<string, string> = {
  "cannot": "can't",
  "will not": "won't",
  "i am": "i'm",
  "let us": "let's",
  "going to": "gonna",
  "want to": "wanna",
  "do not": "don't",
  "is not": "isn't",
  "are not": "aren't",
  "was not": "wasn't",
  "were not": "weren't",
  "did not": "didn't",
  "does not": "doesn't",
  "have not": "haven't",
  "has not": "hasn't",
  "had not": "hadn't",
  "would not": "wouldn't",
  "could not": "couldn't",
  "should not": "shouldn't",
};

const PT_CONTRACTIONS: Record<string, string> = {
  do: "de o",
  da: "de a",
  dos: "de os",
  das: "de as",
  no: "em o",
  na: "em a",
  nos: "em os",
  nas: "em as",
  pelo: "por o",
  pela: "por a",
  pelos: "por os",
  pelas: "por as",
  num: "em um",
  numa: "em uma",
  duma: "de uma",
  dum: "de um",
  ao: "a o",
  aos: "a os",
  à: "a a",
  às: "a as",
  deste: "de este",
  desta: "de esta",
  destes: "de estes",
  destas: "de estas",
  neste: "em este",
  nesta: "em esta",
  nestes: "em estes",
  nestas: "em estas",
  daquele: "de aquele",
  daquela: "de aquela",
  naquele: "em aquele",
  naquela: "em aquela",
  disso: "de isso",
  nisso: "em isso",
  disto: "de isto",
  nisto: "em isto",
};

const PT_CONTRACTION_REVERSE: Record<string, string> = {
  "de o": "do",
  "de a": "da",
  "de os": "dos",
  "de as": "das",
  "em o": "no",
  "em a": "na",
  "em os": "nos",
  "em as": "nas",
  "por o": "pelo",
  "por a": "pela",
  "em um": "num",
  "em uma": "numa",
  "de um": "dum",
  "de uma": "duma",
  "a o": "ao",
  "a os": "aos",
  "a a": "à",
  "de este": "deste",
  "em este": "neste",
  "de aquele": "daquele",
  "em aquele": "naquele",
};

/** Expansao canonica de um token de contracao ("" quando nao ha contracao). */
export function expandContractionToken(key: string, language: AnalysisLanguage): string {
  if (language === "en") {
    if (EN_CONTRACTIONS[key]) return EN_CONTRACTIONS[key];
    // regra generica: n't -> " not"
    if (key.length > 3 && key.endsWith("n't")) return key.slice(0, -3) + " not";
    if (key.length > 3 && key.endsWith("nt") && EN_CONTRACTIONS[key]) return EN_CONTRACTIONS[key];
    if (key.endsWith("'re")) return key.slice(0, -3) + " are";
    if (key.endsWith("'ve")) return key.slice(0, -3) + " have";
    if (key.endsWith("'ll")) return key.slice(0, -3) + " will";
    if (key.endsWith("'m")) return key.slice(0, -2) + " am";
    return "";
  }
  return PT_CONTRACTIONS[key] ?? "";
}

/** Contracao reversa: forma expandida -> forma contrata ("" quando nao ha). */
export function contractPhrase(key: string, language: AnalysisLanguage): string {
  if (language === "en") return EN_CONTRACTION_REVERSE[key] ?? "";
  return PT_CONTRACTION_REVERSE[key] ?? "";
}

/** Pares ortograficos conservadores (variante legitima, nao erro de digitacao). */
const ORTHOGRAPHIC_PAIRS: Array<[string, string]> = [
  ["colour", "color"],
  ["favourite", "favorite"],
  ["honour", "honor"],
  ["behaviour", "behavior"],
  ["centre", "center"],
  ["theatre", "theater"],
  ["metre", "meter"],
  ["litre", "liter"],
  ["realise", "realize"],
  ["organise", "organize"],
  ["recognise", "recognize"],
  ["analyse", "analyze"],
  ["travelled", "traveled"],
  ["travelling", "traveling"],
  ["cancelled", "canceled"],
  ["grey", "gray"],
  ["licence", "license"],
  ["practise", "practice"],
  ["programme", "program"],
  ["catalogue", "catalog"],
  ["dialogue", "dialog"],
  ["judgement", "judgment"],
  ["jewellery", "jewelry"],
  ["aeroplane", "airplane"],
  ["aluminium", "aluminum"],
  ["towards", "toward"],
  ["whilst", "while"],
  ["learnt", "learned"],
  ["spelt", "spelled"],
  ["burnt", "burned"],
  ["dreamt", "dreamed"],
  ["defence", "defense"],
  ["offence", "offense"],
  ["ideia", "idéia"],
  ["voo", "vôo"],
  ["jiboia", "jibóia"],
];

const ORTHOGRAPHIC_FORWARD = new Map<string, string>();
for (const [a, b] of ORTHOGRAPHIC_PAIRS) {
  ORTHOGRAPHIC_FORWARD.set(normalizeSurface(a), normalizeSurface(b));
}

/** Pares ja normalizados: evita re-normalizar 35 pares a cada token/entrada. */
const ORTHOGRAPHIC_NORMALIZED: Array<[string, string]> = ORTHOGRAPHIC_PAIRS.map(([a, b]): [string, string] => [
  normalizeSurface(a),
  normalizeSurface(b),
]).filter(([a, b]) => a.length > 0 && b.length > 0 && a !== b);

/** Troca de variantes ortograficas conhecidas dentro de uma chave. */
export function orthographicVariants(key: string): string[] {
  const out = new Set<string>();
  const direct = ORTHOGRAPHIC_FORWARD.get(key);
  if (direct) out.add(direct);
  for (const [left, right] of ORTHOGRAPHIC_NORMALIZED) {
    if (key === right) out.add(left);
  }
  for (const [left, right] of ORTHOGRAPHIC_NORMALIZED) {
    if (key.includes(left) && key !== left) out.add(key.split(left).join(right));
    if (key.includes(right) && key !== right) out.add(key.split(right).join(left));
  }
  return [...out].filter((value) => value && value !== key);
}

/**
 * Variantes de um token isolado. Nao gera combinacoes: cada variante e uma
 * chave equivalente do MESMO item lexical.
 */
export function tokenVariants(key: string, language: AnalysisLanguage): string[] {
  const out = new Set<string>();
  const folded = stripAccents(key);
  if (folded !== key) out.add(folded);
  const noApostrophe = key.replace(/'/g, "");
  if (noApostrophe !== key && noApostrophe) out.add(noApostrophe);
  const hyphenAsSpace = key.replace(/-/g, " ");
  if (hyphenAsSpace !== key) out.add(hyphenAsSpace);
  const hyphenRemoved = key.replace(/-/g, "");
  if (hyphenRemoved !== key) out.add(hyphenRemoved);
  const expanded = expandContractionToken(key, language);
  if (expanded) out.add(expanded);
  for (const variant of orthographicVariants(key)) out.add(variant);
  out.delete(key);
  return [...out].filter(Boolean);
}

/**
 * Variantes de uma sequencia de tokens (expressao ou palavra unica):
 * contracao canonica, hifen, apostrofo, acento e ortografia - sempre na
 * sequencia inteira, nunca em pedacos soltos.
 */
export function phraseVariants(keys: string[], language: AnalysisLanguage): string[] {
  const out = new Set<string>();
  const joined = keys.join(" ");
  const expanded = keys
    .map((key) => expandContractionToken(key, language) || key)
    .join(" ");
  if (expanded !== joined) out.add(expanded);
  const contracted = contractPhrase(joined, language);
  if (contracted) out.add(contracted);
  const contractedExpanded = contractPhrase(expanded, language);
  if (contractedExpanded) out.add(contractedExpanded);
  const noApostrophe = joined.replace(/'/g, "");
  if (noApostrophe !== joined && noApostrophe) out.add(noApostrophe);
  const folded = stripAccents(joined);
  if (folded !== joined) out.add(folded);
  const hyphenJoined = joined.replace(/\s+/g, "-");
  if (keys.length > 1) out.add(hyphenJoined);
  const hyphenAsSpace = joined.replace(/-/g, " ");
  if (hyphenAsSpace !== joined) out.add(hyphenAsSpace);
  const hyphenRemoved = joined.replace(/-/g, "");
  if (hyphenRemoved !== joined) out.add(hyphenRemoved);
  for (const variant of orthographicVariants(joined)) out.add(variant);
  // Substituto ortografico token a token (nao e produto cartesiano).
  keys.forEach((key, index) => {
    for (const variant of orthographicVariants(key)) {
      const copy = [...keys];
      copy[index] = variant;
      out.add(copy.join(" "));
    }
    const foldedToken = stripAccents(key);
    if (foldedToken !== key) {
      const copy = [...keys];
      copy[index] = foldedToken;
      out.add(copy.join(" "));
    }
  });
  out.delete(joined);
  out.delete("");
  return [...out].filter(Boolean);
}

const TOKEN_PATTERN = /\p{L}[\p{L}\p{N}]*(?:['\-]\p{L}[\p{L}\p{N}]*)*/gu;

export function tokenizeText(text: string, language: AnalysisLanguage): TextToken[] {
  const tokens: TextToken[] = [];
  const normalized = foldApostrophes(text);
  // Regex nova por chamada: o motor precisa ser reentrante e deterministico.
  const pattern = new RegExp(TOKEN_PATTERN.source, "gu");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized)) !== null) {
    const raw = match[0];
    const key = normalizeSurface(raw);
    if (!key) continue;
    tokens.push({
      raw,
      key,
      folded: stripAccents(key),
      variants: tokenVariants(key, language),
      start: match.index,
      end: match.index + raw.length,
    });
  }
  return tokens;
}

export const SENTENCE_BOUNDARY = /[.!?\n;:]+\s*/;

/** Sentenca (limitada) que contem o intervalo informado. */
export function sentenceAround(text: string, start: number, end: number, maxLength = 200): string {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));
  let left = 0;
  for (let i = safeStart - 1; i >= 0; i -= 1) {
    if (text[i] === "." || text[i] === "!" || text[i] === "?" || text[i] === "\n") {
      left = i + 1;
      break;
    }
  }
  let right = text.length;
  for (let i = safeEnd; i < text.length; i += 1) {
    if (text[i] === "." || text[i] === "!" || text[i] === "?" || text[i] === "\n") {
      right = i + 1;
      break;
    }
  }
  const sentence = text.slice(left, right).replace(/\s+/g, " ").trim();
  if (sentence.length <= maxLength) return sentence;
  return sentence.slice(0, maxLength - 1) + "…";
}

/**
 * Distancia de Damerau-Levenshtein com corte antecipado.
 * Usada apenas para sinalizar POSSIBLE_DUPLICATE (erro de digitacao), nunca
 * para declarar um termo como conhecido.
 */
export function editDistanceAtMost(a: string, b: string, max: number): number | null {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return null;
  if (!a || !b) return Math.max(a.length, b.length) <= max ? Math.max(a.length, b.length) : null;
  let previousPrevious: number[] | null = null;
  let previous: number[] = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      if (
        previousPrevious &&
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        value = Math.min(value, (previousPrevious[j - 2] ?? 0) + 1);
      }
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return null;
    previousPrevious = previous;
    previous = current;
  }
  return (previous[b.length] ?? max + 1) <= max ? previous[b.length] : null;
}
