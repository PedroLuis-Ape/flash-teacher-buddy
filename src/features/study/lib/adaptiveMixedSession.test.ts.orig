import { describe, expect, it } from "vitest";
import {
  answerAdaptiveMixedCard,
  createAdaptiveMixedSession,
  getAdaptiveMixedProgress,
  getAdaptiveRoundSize,
  restartAdaptiveMixedRound,
  startNextAdaptiveMixedRound,
} from "./adaptiveMixedSession";

const fixedRandom = () => 0.42;
const ids = (count: number) => Array.from({ length: count }, (_, index) => `card-${index + 1}`);

function answerCurrent(state: ReturnType<typeof createAdaptiveMixedSession>, correct: boolean) {
  return answerAdaptiveMixedCard(state, correct, false);
}

describe("adaptive mixed session", () => {
  it("escolhe 10 ou 15 cards conforme o tamanho da lista", () => {
    expect(getAdaptiveRoundSize(8)).toBe(8);
    expect(getAdaptiveRoundSize(15)).toBe(15);
    expect(getAdaptiveRoundSize(16)).toBe(10);
    expect(getAdaptiveRoundSize(35)).toBe(10);
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
    expect(state.masteredCardIds).toHaveLength(8);

    state = startNextAdaptiveMixedRound(state, fixedRandom);
    expect(state.currentRoundCardIds).toHaveLength(10);
    expect(state.currentRoundCardIds).toEqual(expect.arrayContaining([round[2], round[7]]));
    expect(state.currentRoundCardIds.filter((id) => state.currentRoundOrigins[id] === "new")).toHaveLength(8);
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

    state.currentRoundCardIds.forEach((_, index) => {
      state = answerCurrent(state, index === failedIndex || true);
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
    expect(state.masteredCardIds).toHaveLength(10);

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
    expect(progress.masteredCards).toBe(10);
    expect(progress.totalCards).toBe(20);
    expect(progress.overallPercent).toBe(50);
  });
});
