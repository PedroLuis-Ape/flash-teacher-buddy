import { useState, useEffect } from "react";

export interface StudyResult {
  flashcardId: string;
  correct: boolean;
  skipped: boolean;
  attempts: number;
}

export interface StudySession {
  collectionId: string;
  mode: "flip" | "write" | "mixed";
  direction: "pt-en" | "en-pt" | "any";
  results: StudyResult[];
  startTime: number;
  endTime?: number;
}

export function useStudyEngine(collectionId: string, flashcardsCount: number) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<StudyResult[]>([]);
  const [startTime] = useState(Date.now());
  const [isFinished, setIsFinished] = useState(false);

  const correctCount = results.filter((r) => r.correct && !r.skipped).length;
  const errorCount = results.filter((r) => !r.correct && !r.skipped).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const progress = flashcardsCount > 0 ? (currentIndex / flashcardsCount) * 100 : 0;

  const recordResult = (flashcardId: string, correct: boolean, skipped: boolean = false) => {
    setResults((prev) => {
      const existing = prev.find((r) => r.flashcardId === flashcardId);
      if (existing) {
        return prev.map((r) =>
          r.flashcardId === flashcardId
            ? { ...r, correct, skipped, attempts: r.attempts + 1 }
            : r
        );
      }
      return [...prev, { flashcardId, correct, skipped, attempts: 1 }];
    });
  };

  const goToNext = () => {
    if (currentIndex < flashcardsCount - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const saveSession = (mode: string, direction: string) => {
    const session: StudySession = {
      collectionId,
      mode: mode as "flip" | "write" | "mixed",
      direction: direction as "pt-en" | "en-pt" | "any",
      results,
      startTime,
      endTime: Date.now(),
    };

    const key = `study_session_${collectionId}_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(session));
  };

  return {
    currentIndex,
    progress,
    correctCount,
    errorCount,
    skippedCount,
    results,
    isFinished,
    recordResult,
    goToNext,
    goToPrevious,
    saveSession,
    setCurrentIndex,
  };
}
