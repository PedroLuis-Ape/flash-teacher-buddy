// Sound effects utility for the study games
// Lightweight, non-blocking audio playback

import { getPerfSettings } from '@/lib/performanceSettings';

function playSound(src: string): void {
  // Check performance settings first (synchronous, no React needed)
  const perf = getPerfSettings();
  if (!perf.soundEffects) return;
  
  try {
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Silently fail - audio may be blocked by browser
    });
  } catch (e) {
    // Silently fail
  }
}

export function playCorrect(): void {
  playSound('/sounds/correct.mp3');
}

export function playWrong(): void {
  playSound('/sounds/wrong.mp3');
}

export function playNext(): void {
  playSound('/sounds/next.mp3');
}

export function playRound(): void {
  playSound('/sounds/round.mp3');
}
