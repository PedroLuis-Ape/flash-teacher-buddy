/**
 * Lematizacao deterministica (sem dependencia externa e sem rede).
 *
 * Estrategia: dicionario curto de formas irregulares + regras conservadoras.
 * Cada funcao devolve CONJUNTO de lemas candidatos, nunca um unico palpite:
 * o lookup usa "qualquer candidato", e candidatos impossiveis (ex.: "hous"
 * em "houses") nao encontram nada na biblioteca.
 *
 * Limite consciente: nao ha analise morfossintatica. Um lema errado so entra
 * quando a biblioteca realmente tem aquela forma, e o candidato sempre sai
 * como KNOWN_LEMMA (evidencia mais fraca), nunca como KNOWN_EXACT.
 */

import type { AnalysisLanguage } from "./types";

const EN_VERB_IRREGULAR: Record<string, string[]> = {
  am: ["be"], is: ["be"], are: ["be"], was: ["be"], were: ["be"], been: ["be"], being: ["be"],
  has: ["have"], had: ["have"], having: ["have"],
  does: ["do"], did: ["do"], done: ["do"], doing: ["do"],
  went: ["go"], gone: ["go"], goes: ["go"],
  made: ["make"], making: ["make"],
  took: ["take"], taken: ["take"],
  got: ["get"], gotten: ["get"],
  gave: ["give"], given: ["give"],
  came: ["come"],
  saw: ["see"], seen: ["see"],
  knew: ["know"], known: ["know"],
  thought: ["think"],
  said: ["say"],
  found: ["find"],
  told: ["tell"],
  became: ["become"],
  left: ["leave"],
  felt: ["feel"],
  brought: ["bring"],
  began: ["begin"], begun: ["begin"],
  kept: ["keep"],
  held: ["hold"],
  wrote: ["write"], written: ["write"],
  stood: ["stand"],
  heard: ["hear"],
  meant: ["mean"],
  met: ["meet"],
  ran: ["run"],
  paid: ["pay"],
  sat: ["sit"],
  spoke: ["speak"], spoken: ["speak"],
  led: ["lead"],
  read: ["read"],
  grew: ["grow"], grown: ["grow"],
  lost: ["lose"],
  fell: ["fall"], fallen: ["fall"],
  sent: ["send"],
  built: ["build"],
  understood: ["understand"],
  drew: ["draw"], drawn: ["draw"],
  broke: ["break"], broken: ["break"],
  spent: ["spend"],
  rose: ["rise"], risen: ["rise"],
  drove: ["drive"], driven: ["drive"],
  bought: ["buy"],
  wore: ["wear"], worn: ["wear"],
  chose: ["choose"], chosen: ["choose"],
  ate: ["eat"], eaten: ["eat"],
  drank: ["drink"], drunk: ["drink"],
  slept: ["sleep"],
  swam: ["swim"], swum: ["swim"],
  taught: ["teach"],
  caught: ["catch"],
  fought: ["fight"],
  flew: ["fly"], flown: ["fly"],
  forgot: ["forget"], forgotten: ["forget"],
  hid: ["hide"], hidden: ["hide"],
  won: ["win"],
  sold: ["sell"],
  sang: ["sing"], sung: ["sing"],
  stole: ["steal"], stolen: ["steal"],
  threw: ["throw"], thrown: ["throw"],
  woke: ["wake"], woken: ["wake"],
  beat: ["beat"], beaten: ["beat"],
  bent: ["bend"],
  bit: ["bite"], bitten: ["bite"],
  blew: ["blow"], blown: ["blow"],
  burnt: ["burn"], burned: ["burn"],
  dealt: ["deal"],
  dug: ["dig"],
  fed: ["feed"],
  froze: ["freeze"], frozen: ["freeze"],
  hung: ["hang"],
  laid: ["lay"],
  lent: ["lend"],
  lit: ["light"],
  rode: ["ride"], ridden: ["ride"],
  rang: ["ring"], rung: ["ring"],
  sought: ["seek"],
  shook: ["shake"], shaken: ["shake"],
  shone: ["shine"],
  shot: ["shoot"],
  showed: ["show"], shown: ["show"],
  shut: ["shut"],
  sank: ["sink"], sunk: ["sink"],
  slid: ["slide"],
  smelt: ["smell"], smelled: ["smell"],
  spread: ["spread"],
  stuck: ["stick"],
  struck: ["strike"],
  swept: ["sweep"],
  tore: ["tear"], torn: ["tear"],
  put: ["put"], cut: ["cut"], hit: ["hit"], hurt: ["hurt"], set: ["set"],
  let: ["let"], cost: ["cost"], quit: ["quit"],
};

const EN_NOUN_IRREGULAR: Record<string, string[]> = {
  children: ["child"],
  men: ["man"],
  women: ["woman"],
  people: ["person"],
  teeth: ["tooth"],
  feet: ["foot"],
  mice: ["mouse"],
  geese: ["goose"],
  oxen: ["ox"],
  criteria: ["criterion"],
  phenomena: ["phenomenon"],
  analyses: ["analysis"],
  theses: ["thesis"],
  crises: ["crisis"],
  indices: ["index"],
  matrices: ["matrix"],
  data: ["datum", "data"],
  media: ["medium", "media"],
};

const EN_COMPARATIVE_IRREGULAR: Record<string, string[]> = {
  better: ["good", "well"],
  best: ["good", "well"],
  worse: ["bad"],
  worst: ["bad"],
  more: ["much", "many"],
  most: ["much", "many"],
  less: ["little"],
  least: ["little"],
};

const PT_VERB_IRREGULAR: Record<string, string[]> = {
  foi: ["ser", "ir"],
  foram: ["ser", "ir"],
  era: ["ser"],
  eram: ["ser"],
  é: ["ser"],
  são: ["ser"],
  sou: ["ser"],
  fui: ["ser", "ir"],
  será: ["ser"],
  serão: ["ser"],
  está: ["estar"],
  estão: ["estar"],
  estou: ["estar"],
  estava: ["estar"],
  estavam: ["estar"],
  estive: ["estar"],
  tem: ["ter"],
  têm: ["ter"],
  tinha: ["ter"],
  tinham: ["ter"],
  tive: ["ter"],
  teve: ["ter"],
  há: ["haver"],
  havia: ["haver"],
  houve: ["haver"],
  vai: ["ir"],
  vão: ["ir"],
  vou: ["ir"],
  veio: ["vir"],
  vieram: ["vir"],
  viu: ["ver"],
  viram: ["ver"],
  deu: ["dar"],
  deram: ["dar"],
  fez: ["fazer"],
  fizeram: ["fazer"],
  disse: ["dizer"],
  disseram: ["dizer"],
  pôs: ["pôr"],
  quis: ["querer"],
  quiseram: ["querer"],
  soube: ["saber"],
  souberam: ["saber"],
  trouxe: ["trazer"],
  trouxeram: ["trazer"],
  pôde: ["poder"],
  puderam: ["poder"],
  faz: ["fazer"],
  fazem: ["fazer"],
  diz: ["dizer"],
  dizem: ["dizer"],
  vem: ["vir"],
  vêm: ["vir"],
  dá: ["dar"],
  dão: ["dar"],
  vê: ["ver"],
  veem: ["ver"],
};

const PT_NOUN_IRREGULAR: Record<string, string[]> = {
  homens: ["homem"],
  mulheres: ["mulher"],
  cães: ["cão"],
  pães: ["pão"],
  mães: ["mãe"],
  pais: ["pai"],
};

function unique(values: Array<string | undefined>): string[] {
  const out = new Set<string>();
  for (const value of values) if (value) out.add(value);
  return [...out];
}

/** Regras de plural de substantivo (ingles). */
function englishNounLemmas(key: string): string[] {
  const out: string[] = [];
  if (key.length > 3 && key.endsWith("ies")) out.push(key.slice(0, -3) + "y");
  if (key.length > 3 && key.endsWith("ves")) {
    out.push(key.slice(0, -3) + "f");
    out.push(key.slice(0, -3) + "fe");
  }
  if (key.length > 3 && (key.endsWith("ches") || key.endsWith("shes") || key.endsWith("xes") || key.endsWith("zes"))) {
    out.push(key.slice(0, -2));
    out.push(key.slice(0, -1));
  }
  if (key.length > 3 && key.endsWith("ses")) {
    out.push(key.slice(0, -2));
    out.push(key.slice(0, -1));
  }
  if (key.length > 3 && key.endsWith("oes")) out.push(key.slice(0, -2));
  if (key.length > 2 && key.endsWith("s") && !key.endsWith("ss") && !key.endsWith("us") && !key.endsWith("is")) {
    out.push(key.slice(0, -1));
  }
  return out;
}

/** Regras de flexao verbal (ingles). */
function englishVerbLemmas(key: string): string[] {
  const out: string[] = [];
  if (key.length > 4 && key.endsWith("ied")) out.push(key.slice(0, -3) + "y");
  if (key.length > 3 && key.endsWith("ed")) {
    const stem = key.slice(0, -2);
    out.push(stem);
    out.push(key.slice(0, -1));
    if (stem.length > 2 && stem.at(-1) === stem.at(-2)) out.push(stem.slice(0, -1));
  }
  if (key.length > 4 && key.endsWith("ing")) {
    const stem = key.slice(0, -3);
    out.push(stem);
    out.push(stem + "e");
    if (stem.length > 2 && stem.at(-1) === stem.at(-2)) out.push(stem.slice(0, -1));
    if (stem.endsWith("y")) out.push(stem);
  }
  if (key.length > 3 && key.endsWith("es")) out.push(key.slice(0, -2));
  if (key.length > 2 && key.endsWith("s") && !key.endsWith("ss")) out.push(key.slice(0, -1));
  if (key.length > 3 && key.endsWith("ier")) out.push(key.slice(0, -3) + "y");
  if (key.length > 4 && key.endsWith("iest")) out.push(key.slice(0, -4) + "y");
  if (key.length > 3 && key.endsWith("er")) {
    const stem = key.slice(0, -2);
    out.push(stem);
    if (stem.length > 2 && stem.at(-1) === stem.at(-2)) out.push(stem.slice(0, -1));
    out.push(stem + "e");
  }
  if (key.length > 4 && key.endsWith("est")) {
    const stem = key.slice(0, -3);
    out.push(stem);
    if (stem.length > 2 && stem.at(-1) === stem.at(-2)) out.push(stem.slice(0, -1));
    out.push(stem + "e");
  }
  return out;
}

/** Regras de plural/flexao (portugues), conservadoras. */
function portugueseLemmas(key: string): string[] {
  const out: string[] = [];
  const pluralEndings: Array<[string, string[]]> = [
    ["ões", ["ão", "om"]],
    ["ães", ["ão"]],
    ["ais", ["al"]],
    ["eis", ["el"]],
    ["ois", ["ol"]],
    ["uis", ["ul"]],
    ["is", ["il"]],
    ["ns", ["m"]],
    ["res", ["r"]],
    ["zes", ["z"]],
    ["ses", ["s"]],
  ];
  for (const [suffix, stems] of pluralEndings) {
    if (key.length > suffix.length && key.endsWith(suffix)) {
      for (const stem of stems) out.push(key.slice(0, -suffix.length) + stem);
    }
  }
  if (key.length > 2 && key.endsWith("s") && !key.endsWith("ss") && !key.endsWith("us")) {
    out.push(key.slice(0, -1));
  }
  if (key.length > 4 && key.endsWith("ando")) out.push(key.slice(0, -4) + "ar");
  if (key.length > 4 && key.endsWith("endo")) out.push(key.slice(0, -4) + "er");
  if (key.length > 4 && key.endsWith("indo")) out.push(key.slice(0, -4) + "ir");
  if (key.length > 4 && key.endsWith("ado")) {
    out.push(key.slice(0, -3) + "ar");
  }
  if (key.length > 4 && key.endsWith("ada")) {
    out.push(key.slice(0, -3) + "ar");
  }
  if (key.length > 4 && (key.endsWith("ados") || key.endsWith("adas"))) {
    out.push(key.slice(0, -4) + "ar");
  }
  if (key.length > 4 && key.endsWith("ido")) {
    out.push(key.slice(0, -3) + "er");
    out.push(key.slice(0, -3) + "ir");
  }
  if (key.length > 4 && key.endsWith("ida")) {
    out.push(key.slice(0, -3) + "er");
    out.push(key.slice(0, -3) + "ir");
  }
  if (key.length > 4 && (key.endsWith("idos") || key.endsWith("idas"))) {
    out.push(key.slice(0, -4) + "er");
    out.push(key.slice(0, -4) + "ir");
  }
  if (key.length > 4 && key.endsWith("ou")) {
    const stem = key.slice(0, -2);
    out.push(stem + "ar");
    out.push(stem + "er");
    out.push(stem + "ir");
  }
  return out;
}

/**
 * Lemas candidatos de uma chave. Sempre inclui a propria chave.
 * Expressoes nao usam esta funcao (elas sao comparadas por chave de frase).
 */
export function lemmaKeys(key: string, language: AnalysisLanguage): string[] {
  if (!key) return [];
  if (language === "en") {
    const irregular = [
      ...(EN_VERB_IRREGULAR[key] ?? []),
      ...(EN_NOUN_IRREGULAR[key] ?? []),
      ...(EN_COMPARATIVE_IRREGULAR[key] ?? []),
    ];
    return unique([key, ...irregular, ...englishNounLemmas(key), ...englishVerbLemmas(key)]).filter(
      (value) => value && value !== key,
    );
  }
  const irregularPt = [
    ...(PT_VERB_IRREGULAR[key] ?? []),
    ...(PT_NOUN_IRREGULAR[key] ?? []),
  ];
  return unique([...irregularPt, ...portugueseLemmas(key)]).filter((value) => value && value !== key);
}

/**
 * Lemas de uma sequencia de tokens: produto cartesiano limitado.
 * Usado para casar "got over" com a expressao conhecida "get over".
 */
export function phraseLemmaKeys(keys: string[], language: AnalysisLanguage, maxCombinations = 48): string[] {
  if (!keys.length) return [];
  const options = keys.map((key) => [key, ...lemmaKeys(key, language)]);
  const out = new Set<string>();
  const walk = (index: number, current: string[]) => {
    if (out.size >= maxCombinations) return;
    if (index === options.length) {
      out.add(current.join(" "));
      return;
    }
    for (const option of options[index]) {
      if (out.size >= maxCombinations) break;
      walk(index + 1, [...current, option]);
    }
  };
  walk(0, []);
  return [...out];
}
