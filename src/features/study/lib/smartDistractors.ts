/**
 * Smart distractors — pick plausible wrong answers using Levenshtein similarity.
 *
 * Pure functions. Caller controls when to use them (FEATURE_FLAGS.intelligent_study_engine).
 *
 * Strategy: rank candidates by *moderate* similarity to the correct answer.
 * Too-similar (edit distance 0–1, just casing/accent) are demoted; very-far
 * candidates are also demoted. Bias to candidates of similar length.
 */

/** Classic iterative Levenshtein. O(n*m) — fine for short strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;

  const prev = new Array<number>(m + 1);
  const curr = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;

  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= m; j++) prev[j] = curr[j];
  }
  return prev[m];
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/**
 * Pick `count` distractors from `candidates` for `correctAnswer`.
 * Excludes exact matches (case/accent-insensitive). Returns original-cased strings.
 *
 * Score: prefers candidates with edit-distance ratio in [0.2, 0.7]
 * (similar but not near-duplicates). Also prefers similar length.
 */
export function pickSmartDistractors(
  correctAnswer: string,
  candidates: string[],
  count: number,
): string[] {
  const target = normalize(correctAnswer);
  if (!target) return candidates.slice(0, count);

  const seen = new Set<string>([target]);
  const scored: { value: string; score: number }[] = [];

  for (const c of candidates) {
    const norm = normalize(c);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);

    const dist = levenshtein(norm, target);
    const maxLen = Math.max(norm.length, target.length);
    const ratio = dist / Math.max(1, maxLen);

    // Sweet spot: ratio in [0.2, 0.7] → high score (1.0 at center 0.45)
    let simScore: number;
    if (ratio < 0.2) simScore = ratio / 0.2 * 0.6;            // demote near-duplicates
    else if (ratio > 0.7) simScore = Math.max(0, 1 - (ratio - 0.7) / 0.6) * 0.6;
    else simScore = 1 - Math.abs(ratio - 0.45) / 0.25;        // peak at 0.45

    // Length affinity: prefer candidates of similar length
    const lenDelta = Math.abs(norm.length - target.length);
    const lenScore = Math.max(0, 1 - lenDelta / Math.max(4, target.length));

    const score = simScore * 0.75 + lenScore * 0.25;
    scored.push({ value: c, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((s) => s.value);
}