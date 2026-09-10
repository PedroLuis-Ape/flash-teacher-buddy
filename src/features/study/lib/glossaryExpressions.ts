/** Linguistically bounded candidates, never inferred translations or approval. */
export const EXPRESSION_FORMS: Record<string, { verbs: string[]; separable: boolean }> = {
  "work out": { verbs: ["work", "works", "worked", "working"], separable: true },
  "give up": { verbs: ["give", "gives", "gave", "given", "giving"], separable: true },
  "look after": { verbs: ["look", "looks", "looked", "looking"], separable: false },
  "run into": { verbs: ["run", "runs", "ran", "running"], separable: false },
  "put off": { verbs: ["put", "puts", "putting"], separable: true },
  "turn on": { verbs: ["turn", "turns", "turned", "turning"], separable: true },
  "turn off": { verbs: ["turn", "turns", "turned", "turning"], separable: true },
  "figure out": { verbs: ["figure", "figures", "figured", "figuring"], separable: true },
  "take off": { verbs: ["take", "takes", "took", "taken", "taking"], separable: true },
};

export function expressionForms(expression: string): string[] {
  const canonical = expression.toLowerCase().trim();
  const rule = EXPRESSION_FORMS[canonical];
  return rule ? rule.verbs.map(verb => `${verb} ${canonical.split(" ")[1]}`) : [expression];
}

export interface ExpressionCandidate {
  expression: string;
  status: "pending_review";
  segments: Array<{ text: string; startIndex: number; endIndex: number }>;
}

export function discoverExpressionCandidates(text: string): ExpressionCandidate[] {
  const tokens = Array.from(text.matchAll(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu), match => ({
    text: match[0], startIndex: match.index!, endIndex: match.index! + match[0].length,
  }));
  const found: ExpressionCandidate[] = [];
  for (const [expression, rule] of Object.entries(EXPRESSION_FORMS)) {
    const particle = expression.split(" ")[1];
    tokens.forEach((verb, index) => {
      if (!rule.verbs.includes(verb.text.toLowerCase())) return;
      for (let next = index + 1; next < Math.min(tokens.length, index + (rule.separable ? 6 : 2)); next++) {
        // Never connect words across punctuation/sentences or line boundaries.
        if (!/^[\p{L}\p{M}'’ \t]*$/u.test(text.slice(verb.endIndex, tokens[next].startIndex))) break;
        if (tokens[next].text.toLowerCase() !== particle) continue;
        found.push({ expression, status: "pending_review", segments: [verb, tokens[next]] });
        break;
      }
    });
  }
  return found;
}
