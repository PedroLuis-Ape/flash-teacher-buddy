import { useEffect, useRef } from 'react';
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
  const bootstrappedRef = useRef(false);
  const lastSyncedFingerprintRef = useRef('');

  useEffect(() => {
    if (isLoading || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const bootstrap = async () => {
      try {
        if (user?.id) {
          await migrateAnonymousPortalHistoryToAccount(user.id);
          lastSyncedFingerprintRef.current = fingerprint(items);
          return;
        }

        const syncState = getGuestServerSyncState();
        if (syncState.enabled) {
          const restored = await restoreAnonymousPortalHistory();
          lastSyncedFingerprintRef.current = fingerprint(restored);
        }
      } catch (error: any) {
        const current = getGuestServerSyncState();
        setGuestServerSyncState({
          ...current,
          lastError: error?.message || 'SYNC_BOOTSTRAP_FAILED',
        });
        console.warn('[PortalHistorySync] bootstrap failed:', error);
      }
    };

    void bootstrap();
  }, [isLoading, items, user?.id]);

  useEffect(() => {
    if (isLoading || !bootstrappedRef.current) return;
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
        if (!syncState.enabled) return;
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
  }, [isLoading, items, user?.id]);

  return null;
}
