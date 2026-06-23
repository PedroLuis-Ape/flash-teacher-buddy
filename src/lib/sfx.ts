// Subtle sound effects for study games.
// Uses the Web Audio API so the feedback does not depend on external MP3 files.

import { getPerfSettings } from '@/lib/performanceSettings';

type SoundName = 'correct' | 'wrong' | 'next' | 'round';

type AudioContextConstructor = typeof AudioContext;

interface ToneStep {
  delay: number;
  duration: number;
  frequency: number;
  endFrequency?: number;
  gain: number;
  type?: OscillatorType;
}

const SOUND_PATTERNS: Record<SoundName, ToneStep[]> = {
  correct: [
    { delay: 0, duration: 0.09, frequency: 660, endFrequency: 720, gain: 0.035, type: 'sine' },
    { delay: 0.08, duration: 0.12, frequency: 880, endFrequency: 940, gain: 0.03, type: 'sine' },
  ],
  wrong: [
    { delay: 0, duration: 0.18, frequency: 230, endFrequency: 175, gain: 0.028, type: 'triangle' },
  ],
  next: [
    { delay: 0, duration: 0.075, frequency: 520, endFrequency: 620, gain: 0.014, type: 'sine' },
  ],
  round: [
    { delay: 0, duration: 0.13, frequency: 523.25, gain: 0.032, type: 'sine' },
    { delay: 0.11, duration: 0.13, frequency: 659.25, gain: 0.034, type: 'sine' },
    { delay: 0.22, duration: 0.18, frequency: 783.99, endFrequency: 830, gain: 0.038, type: 'sine' },
  ],
};

const MIN_GAP_MS: Record<SoundName, number> = {
  correct: 90,
  wrong: 120,
  next: 110,
  round: 500,
};

let audioContext: AudioContext | null = null;
let lastFeedbackAt = 0;
const lastPlayedAt: Partial<Record<SoundName, number>> = {};

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor: AudioContextConstructor | undefined =
    window.AudioContext
    || (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;

  if (!AudioContextCtor) return null;

  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextCtor();
  }

  return audioContext;
}

function scheduleTone(context: AudioContext, step: ToneStep): void {
  const startAt = context.currentTime + step.delay;
  const endAt = startAt + step.duration;
  const attackEnd = Math.min(startAt + 0.012, endAt);

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = step.type ?? 'sine';
  oscillator.frequency.setValueAtTime(step.frequency, startAt);
  if (step.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(step.endFrequency, endAt);
  }

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(step.gain, attackEnd);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.01);
}

function playPattern(name: SoundName): void {
  if (!getPerfSettings().soundEffects) return;

  const timestamp = nowMs();
  const previous = lastPlayedAt[name] ?? 0;
  if (timestamp - previous < MIN_GAP_MS[name]) return;

  // Avoid a second navigation sound immediately after correct/incorrect feedback.
  if (name === 'next' && timestamp - lastFeedbackAt < 260) return;

  if (name === 'correct' || name === 'wrong') {
    lastFeedbackAt = timestamp;
  }
  lastPlayedAt[name] = timestamp;

  try {
    const context = getAudioContext();
    if (!context) return;

    const play = () => {
      SOUND_PATTERNS[name].forEach((step) => scheduleTone(context, step));
    };

    if (context.state === 'suspended') {
      void context.resume().then(play).catch(() => undefined);
    } else {
      play();
    }
  } catch {
    // Sound is decorative. Never interrupt the activity if the browser blocks it.
  }
}

export function playCorrect(): void {
  playPattern('correct');
}

export function playWrong(): void {
  playPattern('wrong');
}

export function playNext(): void {
  playPattern('next');
}

export function playRound(): void {
  playPattern('round');
}
