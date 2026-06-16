import { useEffect, useMemo, useRef } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useGuestHistory } from '@/hooks/useGuestHistory';
import {
  getGuestServerSyncState,
  migrateAnonymousPortalHistoryToAccount,
  restoreAnonymousPortalHistory,
  setGuestServerSyncState,
  syncAccountPortalHistory,
  syncAnonymousPortalHistory,
} from '@/lib/portalHistorySync';

function fingerprint(items: unknown[]) {
  try {
    return JSON.stringify(items);
  } catch {
    return String(items.length);
  }
}

export function PortalHistorySyncAgent() {
  const { user, isLoading } = useAuthUser();
  const { items } = useGuestHistory();
  const modeKey = useMemo(() => user?.id || 'guest', [user?.id]);
  const readyModeRef = useRef('');
  const lastSyncedFingerprintRef = useRef('');

  useEffect(() => {
    if (isLoading || readyModeRef.current === modeKey) return;
    let cancelled = false;

    const bootstrap = async () => {
      try {
        if (user?.id) {
          const merged = await migrateAnonymousPortalHistoryToAccount(user.id);
          if (cancelled) return;
          lastSyncedFingerprintRef.current = fingerprint(merged);
          readyModeRef.current = modeKey;
          return;
        }

        const syncState = getGuestServerSyncState();
        if (syncState.enabled) {
          const restored = await restoreAnonymousPortalHistory();
          if (cancelled) return;
          lastSyncedFingerprintRef.current = fingerprint(restored);
        } else {
          lastSyncedFingerprintRef.current = fingerprint(items);
        }
        readyModeRef.current = modeKey;
      } catch (error: any) {
        if (cancelled) return;
        const current = getGuestServerSyncState();
        setGuestServerSyncState({
          ...current,
          lastError: error?.message || 'SYNC_BOOTSTRAP_FAILED',
        });
        readyModeRef.current = modeKey;
        console.warn('[PortalHistorySync] bootstrap failed:', error);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isLoading, items, modeKey, user?.id]);

  useEffect(() => {
    if (isLoading || readyModeRef.current !== modeKey) return;
    const currentFingerprint = fingerprint(items);
    if (currentFingerprint === lastSyncedFingerprintRef.current) return;

    const timer = window.setTimeout(async () => {
      try {
        if (user?.id) {
          const merged = await syncAccountPortalHistory(user.id, items);
          lastSyncedFingerprintRef.current = fingerprint(merged);
          return;
        }

        const syncState = getGuestServerSyncState();
        if (!syncState.enabled) {
          lastSyncedFingerprintRef.current = currentFingerprint;
          return;
        }
        const merged = await syncAnonymousPortalHistory(items);
        lastSyncedFingerprintRef.current = fingerprint(merged);
      } catch (error: any) {
        const current = getGuestServerSyncState();
        setGuestServerSyncState({
          ...current,
          lastError: error?.message || 'SYNC_FAILED',
        });
        console.warn('[PortalHistorySync] sync failed:', error);
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [isLoading, items, modeKey, user?.id]);

  return null;
}
