// Bulk import utilities for flashcards

export type FlashcardPair = {
  en?: string;
  pt?: string;
};

function guessLang(s: string): "en" | "pt" {
  const t = ` ${s.toLowerCase()} `;
  
  // Check for Portuguese accents
  if (/[áéíóúâêîôûãõç]/.test(t)) return "pt";
  
  // Check for common English words
  const enHits = [
    " the ", " a ", " an ", " to ", " of ", " in ", 
    " on ", " for ", " with ", " is ", " are "
  ].filter(w => t.includes(w)).length;
  
  return enHits >= 1 ? "en" : "pt";
}

export function parsePastedFlashcards(input: string): FlashcardPair[] {
  return input
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      // Try to split by " / " separator
      const parts = line.split("/").map(s => s.trim());
      
      if (parts.length >= 2) {
        const a = parts[0];
        const b = parts.slice(1).join(" / ");
        const langA = guessLang(a);
        const langB = guessLang(b);
        
        // Assign based on detected language
        if (langA === "en" || langB === "pt") {
          return { en: a, pt: b };
        } else {
          return { en: b, pt: a };
        }
      }
      
      // Single text, try to detect language
      const lang = guessLang(line);
      return lang === "en" ? { en: line } : { pt: line };
    });
}

export function deduplicateFlashcards(
  pairs: FlashcardPair[],
  existingCards: { term: string; translation: string }[]
): FlashcardPair[] {
  const seen = new Set<string>();
  
  // Add existing cards to seen set
  existingCards.forEach(card => {
    const key = `${card.term.toLowerCase().trim()}|${card.translation.toLowerCase().trim()}`;
    seen.add(key);
  });
  
  // Filter out duplicates
  return pairs.filter(pair => {
    if (!pair.en || !pair.pt) return true; // Keep incomplete for review
    
    const key = `${pair.en.toLowerCase().trim()}|${pair.pt.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    
    seen.add(key);
    return true;
  });
}
