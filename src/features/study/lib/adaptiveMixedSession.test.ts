import { describe, expect, it } from "vitest";
import {
  answerAdaptiveMixedCard,
  buildAdaptiveMixedInitializationSignature,
  createAdaptiveMixedSession,
  getAdaptiveMixedProgress,
  getAdaptiveRoundSize,
  persistLatestAdaptiveState,
  repairAdaptiveMixedState,
  restartAdaptiveMixedRound,
  startNextAdaptiveMixedRound,
} from "./adaptiveMixedSession";

const fixedRandom = () => 0.42;
const ids = (count: number) => Array.from({ length: count }, (_, index) => `card-${index + 1}`);

function answerCurrent(state: ReturnType<typeof createAdaptiveMixedSession>, correct: boolean) {
  return answerAdaptiveMixedCard(state, correct, false);
}

describe("adaptive mixed session", () => {
  it("isolates initialization between mastery and continuous flow formats", () => {
    expect(buildAdaptiveMixedInitializationSignature("study-key", ids(2), "mastery_rounds"))
      .not.toBe(buildAdaptiveMixedInitializationSignature("study-key", ids(2), "continuous"));
    expect(buildAdaptiveMixedInitializationSignature("study-key", ids(2), "continuous"))
      .toBe("study-key|continuous|card-1|card-2");
  });

  it("persiste novamente o snapshot mais novo quando uma gravação se sobrepõe à resposta", async () => {
    let latest: { id: string } | null = { id: "old" };
    let releaseFirstWrite: (() => void) | undefined;
    const firstWriteStarted = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const writes: string[] = [];

    const persistence = persistLatestAdaptiveState(
      () => latest,
      async (state) => {
        writes.push(state.id);
        if (state.id === "old") await firstWriteStarted;
      },
    );

    await Promise.resolve();
    latest = { id: "new" };
    releaseFirstWrite?.();
    await persistence;

    expect(writes).toEqual(["old", "new"]);
  });

  it("encerra a cadeia quando a geração deixa de ser atual", async () => {
    let latest: { id: string } | null = { id: "old" };
    const writes: string[] = [];
    await persistLatestAdaptiveState(
      () => latest,
      (state) => {
        writes.push(state.id);
        latest = null;
      },
    );
    expect(writes).toEqual(["old"]);
  });

  it("usa rodadas de até 15 cards em qualquer tamanho de lista", () => {
    expect(getAdaptiveRoundSize(8)).toBe(8);
    expect(getAdaptiveRoundSize(15)).toBe(15);
    expect(getAdaptiveRoundSize(16)).toBe(15);
    expect(getAdaptiveRoundSize(35)).toBe(15);
    expect(getAdaptiveRoundSize(36)).toBe(15);
    expect(getAdaptiveRoundSize(50)).toBe(15);
  });

  it("monta a primeira rodada sem duplicar cards", () => {
    const state = createAdaptiveMixedSession(ids(50), { random: fixedRandom });
    expect(state.currentRoundCardIds).toHaveLength(15);
    expect(new Set(state.currentRoundCardIds).size).toBe(15);
    expect(state.unseenCardIds).toHaveLength(35);
    expect(state.hearts).toBe(3);
    expect(state.roundNumber).toBe(1);
  });

  it("leva os erros para a próxima rodada e completa com cards novos", () => {
    let state = createAdaptiveMixedSession(ids(30), { random: fixedRandom });
    const round = [...state.currentRoundCardIds];

    round.forEach((_, index) => {
      state = answerCurrent(state, index !== 2 && index !== 7);
    });

    expect(state.status).toBe("round-complete");
    expect(state.pendingCardIds).toEqual(expect.arrayContaining([round[2], round[7]]));
    expect(state.masteredCardIds).toHaveLength(13);

    state = startNextAdaptiveMixedRound(state, fixedRandom);
    expect(state.currentRoundCardIds).toHaveLength(15);
    expect(state.currentRoundCardIds).toEqual(expect.arrayContaining([round[2], round[7]]));
    expect(state.currentRoundCardIds.filter((id) => state.currentRoundOrigins[id] === "new")).toHaveLength(13);
  });

  it("encerra apenas a tentativa quando os três corações acabam", () => {
    let state = createAdaptiveMixedSession(ids(20), { random: fixedRandom });
    const originalRound = [...state.currentRoundCardIds].sort();

    state = answerCurrent(state, false);
    state = answerCurrent(state, false);
    state = answerCurrent(state, false);

    expect(state.status).toBe("round-failed");
    expect(state.hearts).toBe(0);
    expect(state.roundNumber).toBe(1);

    state = restartAdaptiveMixedRound(state, fixedRandom);
    expect(state.status).toBe("active");
    expect(state.hearts).toBe(3);
    expect(state.currentIndex).toBe(0);
    expect(state.currentRoundErrors).toEqual([]);
    expect([...state.currentRoundCardIds].sort()).toEqual(originalRound);
    expect(state.attemptNumber).toBe(2);
  });

  it("mantém um card pendente até ele ser acertado em rodada concluída", () => {
    let state = createAdaptiveMixedSession(ids(12), { random: fixedRandom });
    const failedCard = state.currentRoundCardIds[0];

    state.currentRoundCardIds.forEach((_, index) => {
      state = answerCurrent(state, index !== 0);
    });
    expect(state.pendingCardIds).toContain(failedCard);

    state = startNextAdaptiveMixedRound(state, fixedRandom);
    const failedIndex = state.currentRoundCardIds.indexOf(failedCard);
    expect(failedIndex).toBeGreaterThanOrEqual(0);

    state.currentRoundCardIds.forEach(() => {
      state = answerCurrent(state, true);
    });

    expect(state.pendingCardIds).not.toContain(failedCard);
    expect(state.masteredCardIds).toContain(failedCard);
    expect(state.status).toBe("journey-complete");
  });

  it("permite refazer uma rodada concluída sem duplicar progresso", () => {
    let state = createAdaptiveMixedSession(ids(20), { random: fixedRandom });
    const completedRound = [...state.currentRoundCardIds].sort();

    state.currentRoundCardIds.forEach(() => {
      state = answerCurrent(state, true);
    });

    expect(state.status).toBe("round-complete");
    expect(state.masteredCardIds).toHaveLength(15);

    state = restartAdaptiveMixedRound(state, fixedRandom);
    expect(state.status).toBe("active");
    expect(state.masteredCardIds).toHaveLength(0);
    expect(state.pendingCardIds).toHaveLength(0);
    expect([...state.currentRoundCardIds].sort()).toEqual(completedRound);
  });

  it("calcula o progresso geral por cards dominados, não pelo tamanho da fila", () => {
    let state = createAdaptiveMixedSession(ids(20), { random: fixedRandom });
    state.currentRoundCardIds.forEach(() => {
      state = answerCurrent(state, true);
    });
    const progress = getAdaptiveMixedProgress(state);
    expect(progress.masteredCards).toBe(15);
    expect(progress.totalCards).toBe(20);
    expect(progress.overallPercent).toBe(75);
  });

  it("percorre todos os cards sem interrupção no modo contínuo", () => {
    let state = createAdaptiveMixedSession(ids(20), {
      random: fixedRandom,
      flowMode: "continuous",
    });

    expect(state.flowMode).toBe("continuous");
    expect(state.currentRoundCardIds).toHaveLength(20);
    expect(state.roundSize).toBe(20);

    state.currentRoundCardIds.forEach((_, index) => {
      state = answerCurrent(state, index % 3 !== 0);
      if (index < 19) expect(state.status).toBe("active");
    });

    expect(state.status).toBe("journey-complete");
    expect(state.pendingCardIds).toEqual([]);
    expect(state.masteredCardIds).toHaveLength(20);
  });

  it("não reinicia o percurso quando cards novos aparecem após a conclusão", () => {
    let state = createAdaptiveMixedSession(["card-1", "card-2"], {
      random: fixedRandom,
      flowMode: "continuous",
    });
    state.currentRoundCardIds.forEach(() => {
      state = answerCurrent(state, true);
    });
    expect(state.status).toBe("journey-complete");

    const repaired = repairAdaptiveMixedState(state, ["card-1", "card-2", "card-3"], "continuous");
    expect(repaired).not.toBeNull();
    expect(repaired?.masteredCardIds).toEqual(expect.arrayContaining(["card-1", "card-2"]));
    expect(repaired?.unseenCardIds).toContain("card-3");
    expect(repaired?.status).toBe("round-complete");
  });

  it("compõe uma nova rodada quando os cards da rodada salva foram removidos", () => {
    const state = createAdaptiveMixedSession(ids(16), { random: fixedRandom });
    const remainingCard = state.unseenCardIds[0];
    const repaired = repairAdaptiveMixedState(state, [remainingCard], "mastery_rounds");

    expect(repaired).not.toBeNull();
    expect(repaired?.status).toBe("active");
    expect(repaired?.currentRoundCardIds).toEqual([remainingCard]);
  });
});
