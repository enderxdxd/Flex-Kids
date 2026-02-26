import { useState, useEffect } from 'react';
import { syncService } from '../../../shared/database/syncService';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const unsubscribe = syncService.onConnectionChange((online) => {
      setIsOnline(online);
      if (online) {
        setIsSyncing(true);
        // syncAll is already triggered by setupOnlineListener in syncService
        // Just wait a bit and update the syncing state
        setTimeout(() => setIsSyncing(false), 5000);
      }
    });

    const unsubPending = syncService.onPendingCountChange((count) => {
      setPendingCount(count);
    });

    // Load initial pending count
    syncService.getPendingSyncCount().then(setPendingCount).catch(() => {});

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      unsubPending();
    };
  }, []);

  return { isOnline, isSyncing, pendingCount };
};
