export type GuestHistoryItemType = 'teacher' | 'folder' | 'list' | 'study' | 'activity';

export interface GuestHistoryItem {
  id: string;
  type: GuestHistoryItemType;
  path: string;
  title: string;
  subtitle?: string;
  teacherSlug?: string;
  entityId?: string;
  visitedAt: number;
  scrollY?: number;
  progressLabel?: string;
}

interface GuestHistoryStore {
  version: 1;
  guestId: string;
  updatedAt: number;
  items: GuestHistoryItem[];
}

const STORAGE_KEY = 'ape:guest-history:v1';
const RESUME_KEY = 'ape:guest-history:resume';
const CHANGE_EVENT = 'ape:guest-history-change';
const MAX_ITEMS = 12;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function createGuestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyStore(): GuestHistoryStore {
  return {
    version: 1,
    guestId: createGuestId(),
    updatedAt: Date.now(),
    items: [],
  };
}

function sanitizePath(path: string) {
  if (!path.startsWith('/portal')) return '/portal';
  return path.slice(0, 500);
}

function prune(items: GuestHistoryItem[]) {
  const cutoff = Date.now() - MAX_AGE_MS;
  return items
    .filter((item) => item.visitedAt >= cutoff && item.path.startsWith('/portal'))
    .sort((a, b) => b.visitedAt - a.visitedAt)
    .slice(0, MAX_ITEMS);
}

function readStore(): GuestHistoryStore {
  if (typeof window === 'undefined') return emptyStore();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = emptyStore();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }

    const parsed = JSON.parse(raw) as Partial<GuestHistoryStore>;
    const store: GuestHistoryStore = {
      version: 1,
      guestId: typeof parsed.guestId === 'string' && parsed.guestId ? parsed.guestId : createGuestId(),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      items: Array.isArray(parsed.items) ? prune(parsed.items as GuestHistoryItem[]) : [],
    };

    return store;
  } catch {
    return emptyStore();
  }
}

function emitChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function writeStore(store: GuestHistoryStore) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...store, updatedAt: Date.now(), items: prune(store.items) }),
    );
    emitChange();
  } catch {
    // Browsing must keep working when storage is disabled or full.
  }
}

export function getGuestHistory() {
  return readStore().items;
}

export function getGuestId() {
  return readStore().guestId;
}

export function recordGuestHistory(
  item: Omit<GuestHistoryItem, 'id' | 'visitedAt'> & { id?: string; visitedAt?: number },
) {
  if (typeof window === 'undefined') return;

  const store = readStore();
  const path = sanitizePath(item.path);
  const existing = store.items.find((entry) => entry.path === path);
  const next: GuestHistoryItem = {
    id: item.id || existing?.id || `${item.type}:${item.entityId || path}`,
    type: item.type,
    path,
    title: item.title.trim().slice(0, 120) || 'Material público',
    subtitle: item.subtitle?.trim().slice(0, 160) || existing?.subtitle,
    teacherSlug: item.teacherSlug || existing?.teacherSlug,
    entityId: item.entityId || existing?.entityId,
    visitedAt: item.visitedAt || Date.now(),
    scrollY: item.scrollY ?? existing?.scrollY ?? 0,
    progressLabel: item.progressLabel || existing?.progressLabel,
  };

  writeStore({
    ...store,
    items: [next, ...store.items.filter((entry) => entry.path !== path)],
  });
}

export function updateGuestHistoryPosition(path: string, scrollY: number, progressLabel?: string) {
  if (typeof window === 'undefined') return;
  const safePath = sanitizePath(path);
  const store = readStore();
  const index = store.items.findIndex((item) => item.path === safePath);
  if (index < 0) return;

  const items = [...store.items];
  items[index] = {
    ...items[index],
    scrollY: Math.max(0, Math.round(scrollY)),
    progressLabel: progressLabel || items[index].progressLabel,
  };
  writeStore({ ...store, items });
}

export function removeGuestHistoryItem(id: string) {
  const store = readStore();
  writeStore({ ...store, items: store.items.filter((item) => item.id !== id) });
}

export function clearGuestHistory() {
  if (typeof window === 'undefined') return;
  const current = readStore();
  writeStore({ ...current, items: [] });
  window.sessionStorage.removeItem(RESUME_KEY);
}

export function requestGuestResume(path: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RESUME_KEY, sanitizePath(path));
  } catch {
    // Resume remains optional when sessionStorage is unavailable.
  }
}

export function consumeGuestResume(path: string) {
  if (typeof window === 'undefined') return false;
  try {
    const requested = window.sessionStorage.getItem(RESUME_KEY);
    if (requested !== sanitizePath(path)) return false;
    window.sessionStorage.removeItem(RESUME_KEY);
    return true;
  } catch {
    return false;
  }
}

export function subscribeGuestHistory(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', handleStorage);
  };
}
