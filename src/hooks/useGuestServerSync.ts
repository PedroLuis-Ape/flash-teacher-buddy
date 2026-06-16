import { useEffect, useState } from 'react';
import {
  getGuestServerSyncState,
  subscribeGuestServerSync,
  type GuestServerSyncState,
} from '@/lib/portalHistorySync';

export function useGuestServerSync() {
  const [state, setState] = useState<GuestServerSyncState>(() => getGuestServerSyncState());

  useEffect(() => {
    const sync = () => setState(getGuestServerSyncState());
    sync();
    return subscribeGuestServerSync(sync);
  }, []);

  return state;
}
