import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("PiteCOIN frontend integration", () => {
  it("records explicit card results and settles before completing the session", () => {
    const engine = read("src/features/study/hooks/useStudyEngine.ts");
    const recordIndex = engine.indexOf("recordStudyAnswer(sessionId, flashcardId, correct, skipped)");
    const settleIndex = engine.indexOf("settleStudySession(sessionId, true)");
    const completeIndex = engine.indexOf(".update({ completed: true");

    expect(recordIndex).toBeGreaterThan(-1);
    expect(settleIndex).toBeGreaterThan(recordIndex);
    expect(completeIndex).toBeGreaterThan(settleIndex);
    expect(engine).toContain("Promise.allSettled(Array.from(pitecoinWritesRef.current))");
    expect(engine).toContain("Recompensa recebida:");
  });

  it("does not request duplicate rewards from the Flip view", () => {
    const flip = read("src/features/study/components/FlipStudyView.impl.tsx");
    expect(flip).not.toContain("awardPoints");
    expect(flip).not.toContain("REWARD_AMOUNTS");
    expect(flip).not.toContain("supabase.auth.getSession");
  });

  it("does not mint a separate fake login reward", () => {
    const initializer = read("src/components/EconomyInitializer.tsx");
    expect(initializer).not.toContain("checkDailyLogin");
    expect(initializer).toContain("getEconomyProfile");
    expect(initializer).toContain("conversion_cron_enabled");
  });

  it("makes balance, progression and manual exchange visible", () => {
    const home = read("src/pages/Index.tsx");
    const statistics = read("src/components/StatisticsTab.tsx");

    expect(home).toContain("balance_pitecoin");
    expect(home).toContain("PiteCOIN");
    expect(home).toContain("navigate('/store')");
    expect(statistics).toContain("XP Total");
    expect(statistics).toContain("PTS disponíveis");
    expect(statistics).toContain("Câmbio manual");
    expect(statistics).toContain('navigate("/store/exchange")');
  });
});
