import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OnlineStatusBadge: React.FC = () => {
  const { isOnline, isSyncing } = useOnlineStatus();

  if (isSyncing) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
        <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
        <span className="font-medium">Sincronizando...</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
        <div className="w-2 h-2 bg-white rounded-full"></div>
        <span className="font-medium">Modo Offline</span>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 opacity-75 hover:opacity-100 transition-opacity">
      <div className="w-2 h-2 bg-white rounded-full"></div>
      <span className="font-medium">Online</span>
    </div>
  );
};
