import { useState, useEffect, useCallback } from 'react';

const SOUND_SETTINGS_KEY = 'ape-sound-enabled';
const NOTIFICATIONS_SETTINGS_KEY = 'ape-notifications-enabled';

export function useSoundSettings() {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(SOUND_SETTINGS_KEY);
    return stored === null ? true : stored === 'true';
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(NOTIFICATIONS_SETTINGS_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(SOUND_SETTINGS_KEY, String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem(NOTIFICATIONS_SETTINGS_KEY, String(notificationsEnabled));
  }, [notificationsEnabled]);

  const toggleSound = () => setSoundEnabled((prev) => !prev);

  const toggleNotifications = useCallback(async () => {
    if (!notificationsEnabled) {
      // Trying to enable - request permission
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationsEnabled(true);
        } else {
          // Permission denied - keep disabled
          console.log('[Settings] Notification permission denied');
          setNotificationsEnabled(false);
        }
      }
    } else {
      // Disabling
      setNotificationsEnabled(false);
    }
  }, [notificationsEnabled]);

  return { 
    soundEnabled, 
    setSoundEnabled, 
    toggleSound,
    notificationsEnabled,
    setNotificationsEnabled,
    toggleNotifications
  };
}

// Global getter for sfx.ts to check if sound is enabled
export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(SOUND_SETTINGS_KEY);
  return stored === null ? true : stored === 'true';
}

// Global getter for notifications
export function isNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(NOTIFICATIONS_SETTINGS_KEY);
  return stored === 'true';
}
