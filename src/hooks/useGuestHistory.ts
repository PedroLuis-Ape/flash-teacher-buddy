import { useEffect, useState } from 'react';
import {
  clearGuestHistory,
  getGuestHistory,
  removeGuestHistoryItem,
  subscribeGuestHistory,
  type GuestHistoryItem,
} from '@/lib/guestHistory';

export function useGuestHistory() {
  const [items, setItems] = useState<GuestHistoryItem[]>(() => getGuestHistory());

  useEffect(() => {
    const sync = () => setItems(getGuestHistory());
    sync();
    return subscribeGuestHistory(sync);
  }, []);

  return {
    items,
    clear: clearGuestHistory,
    remove: removeGuestHistoryItem,
  };
}
