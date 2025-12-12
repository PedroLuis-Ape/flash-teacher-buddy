// Sound effects utility for the study games
// Lightweight, non-blocking audio playback

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext not supported');
      return null;
    }
  }
  return audioContext;
}

function playSound(src: string): void {
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
