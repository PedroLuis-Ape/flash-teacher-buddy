import { useState, useEffect } from 'react';

const SOUND_SETTINGS_KEY = 'ape-sound-enabled';

export function useSoundSettings() {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(SOUND_SETTINGS_KEY);
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(SOUND_SETTINGS_KEY, String(soundEnabled));
  }, [soundEnabled]);

  const toggleSound = () => setSoundEnabled((prev) => !prev);

  return { soundEnabled, setSoundEnabled, toggleSound };
}

// Global getter for sfx.ts to check if sound is enabled
export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(SOUND_SETTINGS_KEY);
  return stored === null ? true : stored === 'true';
}
