// Sound effects utility for the study games
// Lightweight, non-blocking audio playback

import { isSoundEnabled } from '@/hooks/useSoundSettings';

function playSound(src: string): void {
  // Check if sound is enabled before playing
  if (!isSoundEnabled()) return;
  
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
