import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Simple language detection heuristics ──────────────────────────────
const LANG_PATTERNS: Record<string, { chars: RegExp; words: string[] }> = {
  pt: {
    chars: /[ãõçáéíóúâêôà]/i,
    words: ["de", "que", "não", "para", "uma", "com", "ele", "ela", "você", "eu", "nós", "são", "está", "ter", "ser", "fazer", "como", "mais", "muito", "bem", "mas", "por"],
  },
  en: {
    chars: /\b(the|is|are|was|were|have|has|had|will|would|could|should|can|do|does|did|don't|doesn't|didn't|won't|wouldn't|couldn't|shouldn't|can't|it's|that's|there's|what's|he's|she's|I'm|you're|we're|they're|I've|you've|we've|they've)\b/i,
    words: ["the", "is", "are", "was", "were", "have", "has", "had", "will", "would", "could", "should", "can", "this", "that", "with", "from", "they", "been", "some", "what", "when", "your", "which"],
  },
  fr: {
    chars: /[éèêëàâùûüîïôœæç]/i,
    words: ["le", "la", "les", "des", "est", "sont", "une", "dans", "pour", "avec", "que", "qui", "sur", "par", "pas", "mais", "nous", "vous", "ils", "elles", "être", "avoir", "faire", "cette", "ces", "tout", "c'est", "j'ai", "je"],
  },
  es: {
    chars: /[ñ¿¡áéíóúü]/i,
    words: ["el", "la", "los", "las", "es", "son", "una", "con", "que", "para", "por", "está", "pero", "como", "más", "todo", "esta", "cuando", "también", "puede", "hace", "desde", "donde", "tiene"],
  },
  de: {
    chars: /[äöüß]/i,
    words: ["der", "die", "das", "ist", "und", "ein", "eine", "nicht", "mit", "auf", "für", "sich", "den", "dem", "ich", "wir", "sie", "haben", "werden", "sein"],
  },
  it: {
    chars: /[àèéìíòóùú]/i,
    words: ["il", "la", "che", "di", "non", "una", "per", "sono", "con", "gli", "questo", "anche", "come", "della", "più", "fatto", "essere", "hanno", "quando", "tutto"],
  },
};

interface LangScore {
  lang: string;
  score: number;
  confidence: "high" | "medium" | "low";
}

function detectLanguage(text: string): LangScore | null {
  if (!text || text.trim().length < 3) return null;

  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/);

  const scores: Record<string, number> = {};

  for (const [lang, patterns] of Object.entries(LANG_PATTERNS)) {
    let score = 0;

    // Character pattern match
    if (patterns.chars.test(normalized)) {
      score += 3;
    }

    // Word frequency match
    for (const word of words) {
      if (patterns.words.includes(word)) {
        score += 2;
      }
    }

    scores[lang] = score;
  }

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0 || entries[0][1] === 0) return null;

  const topScore = entries[0][1];
  const secondScore = entries.length > 1 ? entries[1][1] : 0;

  let confidence: "high" | "medium" | "low" = "low";
  if (topScore >= 6 && topScore > secondScore * 2) confidence = "high";
  else if (topScore >= 3 && topScore > secondScore) confidence = "medium";

  return { lang: entries[0][0], score: topScore, confidence };
}

interface FlaggedCard {
  id: string;
  term: string;
  translation: string;
  detected_lang_term: LangScore | null;
  detected_lang_translation: LangScore | null;
  reason: string;
}

interface FlaggedList {
  list_id: string;
  list_title: string;
  folder_title: string | null;
  owner_id: string;
  lang_a: string | null;
  lang_b: string | null;
  labels_a: string | null;
  labels_b: string | null;
  study_type: string;
  total_cards: number;
  suspicious_cards: number;
  sample_cards: FlaggedCard[];
  reasons: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const ownerFilter = body.owner_id || user.id; // default: audit own lists
    const maxCardsPerList = body.max_sample || 10;

    // Fetch all language lists for this owner
    const { data: lists, error: listsError } = await supabase
      .from("lists")
      .select("id, title, folder_id, owner_id, lang_a, lang_b, labels_a, labels_b, study_type, folders(title)")
      .eq("owner_id", ownerFilter)
      .is("deleted_at", null)
      .in("study_type", ["language", ""])
      .order("created_at", { ascending: false });

    if (listsError) throw listsError;

    const flaggedLists: FlaggedList[] = [];
    let totalCardsChecked = 0;
    let totalSuspiciousCards = 0;

    for (const list of (lists || [])) {
      // Also include lists with null/empty study_type (legacy)
      const langA = list.lang_a || "en";
      const langB = list.lang_b || "pt";

      // Fetch cards for this list (up to 500 for audit)
      const { data: cards, error: cardsError } = await supabase
        .from("flashcards")
        .select("id, term, translation")
        .eq("list_id", list.id)
        .is("deleted_at", null)
        .limit(500);

      if (cardsError) continue;
      if (!cards || cards.length === 0) continue;

      totalCardsChecked += cards.length;

      const flaggedCards: FlaggedCard[] = [];

      for (const card of cards) {
        const detectedTerm = detectLanguage(card.term);
        const detectedTranslation = detectLanguage(card.translation);

        const reasons: string[] = [];

        // Check: term should match lang_a, translation should match lang_b
        if (
          detectedTerm &&
          detectedTerm.confidence !== "low" &&
          detectedTerm.lang !== langA &&
          detectedTerm.lang === langB
        ) {
          reasons.push(
            `term parece ser ${detectedTerm.lang} (esperado: ${langA})`
          );
        }

        if (
          detectedTranslation &&
          detectedTranslation.confidence !== "low" &&
          detectedTranslation.lang !== langB &&
          detectedTranslation.lang === langA
        ) {
          reasons.push(
            `translation parece ser ${detectedTranslation.lang} (esperado: ${langB})`
          );
        }

        // Both sides detected as same language (and it matches one of the list langs)
        if (
          detectedTerm &&
          detectedTranslation &&
          detectedTerm.confidence !== "low" &&
          detectedTranslation.confidence !== "low" &&
          detectedTerm.lang === detectedTranslation.lang
        ) {
          reasons.push(
            `ambos os lados parecem ser ${detectedTerm.lang}`
          );
        }

        // Cross-swap detection: term looks like lang_b AND translation looks like lang_a
        if (
          detectedTerm &&
          detectedTranslation &&
          detectedTerm.confidence !== "low" &&
          detectedTranslation.confidence !== "low" &&
          detectedTerm.lang === langB &&
          detectedTranslation.lang === langA
        ) {
          reasons.push("conteúdo aparenta estar invertido (A↔B)");
        }

        if (reasons.length > 0) {
          flaggedCards.push({
            id: card.id,
            term: card.term,
            translation: card.translation,
            detected_lang_term: detectedTerm,
            detected_lang_translation: detectedTranslation,
            reason: reasons.join("; "),
          });
        }
      }

      if (flaggedCards.length > 0) {
        totalSuspiciousCards += flaggedCards.length;

        const listReasons: string[] = [];
        const swapCount = flaggedCards.filter((c) =>
          c.reason.includes("invertido")
        ).length;
        if (swapCount > cards.length * 0.3) {
          listReasons.push(
            `${swapCount}/${cards.length} cards parecem invertidos`
          );
        }
        if (flaggedCards.length > cards.length * 0.5) {
          listReasons.push(
            `${flaggedCards.length}/${cards.length} cards suspeitos`
          );
        }

        flaggedLists.push({
          list_id: list.id,
          list_title: list.title,
          folder_title: (list as any).folders?.title || null,
          owner_id: list.owner_id,
          lang_a: list.lang_a,
          lang_b: list.lang_b,
          labels_a: list.labels_a,
          labels_b: list.labels_b,
          study_type: list.study_type || "language",
          total_cards: cards.length,
          suspicious_cards: flaggedCards.length,
          sample_cards: flaggedCards.slice(0, maxCardsPerList),
          reasons: listReasons.length > 0 ? listReasons : ["Cards com idioma suspeito detectados"],
        });
      }
    }

    const report = {
      success: true,
      audited_by: user.id,
      total_lists_checked: (lists || []).length,
      total_suspicious_lists: flaggedLists.length,
      total_cards_checked: totalCardsChecked,
      total_suspicious_cards: totalSuspiciousCards,
      flagged_lists: flaggedLists,
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
