/**
 * Types for Realms (Reinos) system
 */

export interface Realm {
  id: string;
  index: number;
  title: string;
  iconUrl: string | null;
  locked: boolean;
}

export interface RealmProgress {
  userId: string;
  currentRealmIndex: number;
  unlockedRealmIndexes: number[];
}

export interface RealmApiResponse {
  success: boolean;
  realms?: Realm[];
  progress?: RealmProgress;
  error?: string;
  message?: string;
}
