import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { guestSyncClient } from '@/integrations/supabase/guestSyncClient';
import {
  getGuestHistory,
  mergeGuestHistories,
  replaceGuestHistory,
  type GuestHistoryItem,
} from '@/lib/guestHistory';

export interface GuestServerSyncState {
  enabled: boolean;
  lastSyncAt?: number;
  expiresAt?: string;
  lastError?: string;
}

const SYNC_STATE_KEY = 'ape:guest-history-server-sync:v1';
const SYNC_CHANGE_EVENT = 'ape:guest-history-server-sync-change';
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function emitSyncChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYNC_CHANGE_EVENT));
}

export function getGuestServerSyncState(): GuestServerSyncState {
  if (typeof window === 'undefined') return { enabled: false };
  try {
    const raw = window.localStorage.getItem(SYNC_STATE_KEY);
    if (!raw) return { enabled: false };
    const parsed = JSON.parse(raw) as Partial<GuestServerSyncState>;
    return {
      enabled: Boolean(parsed.enabled),
      lastSyncAt: typeof parsed.lastSyncAt === 'number' ? parsed.lastSyncAt : undefined,
      expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : undefined,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : undefined,
    };
  } catch {
    return { enabled: false };
  }
}

export function setGuestServerSyncState(next: GuestServerSyncState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(next));
    emitSyncChange();
  } catch {
    // Server sync is optional; local history remains the fallback.
  }
}

export function subscribeGuestServerSync(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === SYNC_STATE_KEY) listener();
  };
  window.addEventListener(SYNC_CHANGE_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(SYNC_CHANGE_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

function normalizeRemoteHistory(value: unknown): GuestHistoryItem[] {
  return Array.isArray(value) ? (value as GuestHistoryItem[]) : [];
}

function isAnonymousUser(user: User | null | undefined) {
  return Boolean((user as User & { is_anonymous?: boolean } | null | undefined)?.is_anonymous);
}

async function getExistingAnonymousSession() {
  const { data, error } = await guestSyncClient.auth.getSession();
  if (error) throw error;
  const user = data.session?.user ?? null;
  return isAnonymousUser(user) ? data.session : null;
}

export async function ensureAnonymousHistorySession() {
  const existing = await getExistingAnonymousSession();
  if (existing) return existing;

  await guestSyncClient.auth.signOut({ scope: 'local' });
  const { data, error } = await guestSyncClient.auth.signInAnonymously();
  if (error || !data.session || !isAnonymousUser(data.user)) {
    throw error || new Error('ANONYMOUS_SIGN_IN_UNAVAILABLE');
  }
  return data.session;
}

export async function syncAnonymousPortalHistory(
  items = getGuestHistory(),
  options?: { mergeRemote?: boolean },
) {
  const session = await ensureAnonymousHistorySession();
  const expiresAt = new Date(Date.now() + NINETY_DAYS_MS).toISOString();
  const ownerId = session.user.id;

  const table = (guestSyncClient.from as any)('anonymous_portal_history');
  const { data: existing, error: readError } = await table
    .select('history')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (readError) throw readError;

  // An expired row is hidden by the SELECT policy but remains deletable by
  // its owner. Removing it allows a clean insert with a renewed expiry.
  if (!existing) {
    const { error: deleteError } = await table.delete().eq('owner_id', ownerId);
    if (deleteError) throw deleteError;
  }

  const nextHistory = options?.mergeRemote
    ? mergeGuestHistories(items, normalizeRemoteHistory(existing?.history))
    : mergeGuestHistories(items);

  const { error: writeError } = await table.upsert(
    {
      owner_id: ownerId,
      history: nextHistory,
      updated_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: 'owner_id' },
  );
  if (writeError) throw writeError;

  replaceGuestHistory(nextHistory);
  setGuestServerSyncState({ enabled: true, lastSyncAt: Date.now(), expiresAt });
  return nextHistory;
}

export async function restoreAnonymousPortalHistory() {
  const session = await getExistingAnonymousSession();
  if (!session) return getGuestHistory();

  const table = (guestSyncClient.from as any)('anonymous_portal_history');
  const { data, error } = await table
    .select('history, expires_at')
    .eq('owner_id', session.user.id)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    return syncAnonymousPortalHistory(getGuestHistory());
  }

  const merged = mergeGuestHistories(getGuestHistory(), normalizeRemoteHistory(data.history));
  replaceGuestHistory(merged);
  setGuestServerSyncState({
    enabled: true,
    lastSyncAt: Date.now(),
    expiresAt: data.expires_at,
  });
  return merged;
}

export async function disableAnonymousPortalHistorySync(options?: { deleteRemote?: boolean }) {
  const session = await getExistingAnonymousSession();
  let deleteError: unknown = null;

  if (session && options?.deleteRemote) {
    const table = (guestSyncClient.from as any)('anonymous_portal_history');
    const result = await table.delete().eq('owner_id', session.user.id);
    deleteError = result.error;
  }

  await guestSyncClient.auth.signOut({ scope: 'local' });
  setGuestServerSyncState({ enabled: false });
  if (deleteError) throw deleteError;
}

export async function readAccountPortalHistory(userId: string) {
  const table = (supabase.from as any)('user_portal_history');
  const { data, error } = await table
    .select('history')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return normalizeRemoteHistory(data?.history);
}

export async function syncAccountPortalHistory(userId: string, items = getGuestHistory()) {
  const nextHistory = mergeGuestHistories(items);
  const table = (supabase.from as any)('user_portal_history');
  const { error } = await table.upsert(
    {
      user_id: userId,
      history: nextHistory,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
  replaceGuestHistory(nextHistory);
  return nextHistory;
}

export async function migrateAnonymousPortalHistoryToAccount(userId: string) {
  const anonymousSession = await getExistingAnonymousSession();
  let anonymousHistory: GuestHistoryItem[] = [];

  if (anonymousSession) {
    const table = (guestSyncClient.from as any)('anonymous_portal_history');
    const { data, error } = await table
      .select('history')
      .eq('owner_id', anonymousSession.user.id)
      .maybeSingle();
    if (error) throw error;
    anonymousHistory = normalizeRemoteHistory(data?.history);
  }

  const accountHistory = await readAccountPortalHistory(userId);
  const merged = mergeGuestHistories(getGuestHistory(), anonymousHistory, accountHistory);
  await syncAccountPortalHistory(userId, merged);

  if (anonymousSession) {
    const table = (guestSyncClient.from as any)('anonymous_portal_history');
    const { error: deleteError } = await table.delete().eq('owner_id', anonymousSession.user.id);
    if (deleteError) console.warn('[PortalHistorySync] anonymous cleanup failed:', deleteError);
    await guestSyncClient.auth.signOut({ scope: 'local' });
  }

  setGuestServerSyncState({ enabled: false, lastSyncAt: Date.now() });
  replaceGuestHistory(merged);
  return merged;
}
