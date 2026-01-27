import { useState, useEffect } from 'react';
import { syncService } from '../../../shared/database/syncService';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

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
        syncService.syncAll().finally(() => {
          setIsSyncing(false);
        });
      }
    });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  return { isOnline, isSyncing };
};
