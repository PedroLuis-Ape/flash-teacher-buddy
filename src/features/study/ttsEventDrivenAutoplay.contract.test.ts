import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const FLIP = "src/features/study/components/FlipStudyView.impl.tsx";
const FLIP_WRAPPER = "src/features/study/components/FlipStudyView.tsx";
const TTS = "src/features/study/hooks/useTTS.ts";
const PRONUNCIATION = "src/features/study/components/PronunciationStudyView.impl.tsx";

describe("event-driven TTS ownership", () => {
  it("keeps a single promise/generation based speech owner", () => {
    const source = read(TTS);
    // Geração/token por request: fala antiga nunca vence fala nova.
    expect(source).toContain("sessionRef.current += 1");
    expect(source).toContain("if (settled || sessionRef.current !== session) return");
    // API baseada nos eventos reais da fala.
    expect(source).toContain("utterance.onstart");
    expect(source).toContain("utterance.onend");
    expect(source).toContain("utterance.onerror");
    // Cancelamento determinístico com motivo.
    expect(source).toContain('reason: "cancelled"');
    expect(source).toContain('reason: "error"');
    expect(source).toContain('reason: "start-timeout"');
    // Promise API.
    expect(source).toContain("Promise<SpeechPlaybackResult>");
  });

  it("flip autoplay advances on the real end of speech, not on a fixed clock", () => {
    const source = read(FLIP);
    expect(source).not.toContain("AUTO_PLAY_DELAY_MS");
    expect(source).not.toContain("7000");
    // Avanço encadeado no onend real (promessa resolvida do owner de TTS).
    expect(source).toContain("Promise.resolve(speakSide(autoPlayCurrentSide)).then");
    expect(source).toContain("autoPlayGenerationRef");
    expect(source).toContain("if (autoPlayGenerationRef.current !== generation) return");
    // Cancelamento não avança o autoplay.
    expect(source).toContain('result.reason === "cancelled"');
    // Pausa de UI e leitura silenciosa são pequenas e explícitas; failsafe existe
    // mas não é o relógio da fala.
    expect(source).toContain("AUTO_PLAY_UI_GAP_MS = 600");
    expect(source).toContain("AUTO_PLAY_SILENT_READ_MS = 3000");
    expect(source).toContain("AUTO_PLAY_FAILSAFE_MS = 20000");
  });

  it("never triggers audio through DOM clicks and never touches speechSynthesis directly in the modes", () => {
    for (const path of [FLIP, FLIP_WRAPPER, PRONUNCIATION]) {
      const source = read(path);
      expect(source).not.toContain('title="Ouvir áudio"');
      expect(source).not.toContain("speechSynthesis.cancel()");
      expect(source).not.toContain("window.speechSynthesis.cancel");
    }
  });

  it("keeps flip and pronunciation on the shared useTTS owner", () => {
    expect(read(FLIP)).toContain('from "@/features/study/hooks/useTTS"');
    const pronunciation = read(PRONUNCIATION);
    expect(pronunciation.includes("useTTS") || pronunciation.includes("usePronunciation")).toBe(true);
  });
});
