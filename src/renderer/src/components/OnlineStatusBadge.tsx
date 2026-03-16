import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OnlineStatusBadge: React.FC = () => {
  const { isOnline, isSyncing, pendingCount } = useOnlineStatus();
  const [visible, setVisible] = useState(true);

  // Quando online e sem pendências, esconde após 4s
  useEffect(() => {
    if (isOnline && !isSyncing && pendingCount === 0) {
      const timer = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(timer);
    }
    setVisible(true);
  }, [isOnline, isSyncing, pendingCount]);

  if (isSyncing) {
    return (
      <div className="fixed bottom-3 right-3 z-50 bg-blue-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full shadow-md flex items-center gap-2 text-xs animate-pulse">
        <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
        <span className="font-medium">Sincronizando</span>
        {pendingCount > 0 && <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{pendingCount}</span>}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="fixed bottom-3 right-3 z-50 bg-orange-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full shadow-md flex items-center gap-2 text-xs">
        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
        <span className="font-medium">Offline</span>
        {pendingCount > 0 && <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{pendingCount} pendentes</span>}
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="fixed bottom-3 right-3 z-50 bg-amber-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full shadow-md flex items-center gap-2 text-xs">
        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
        <span className="font-medium">Online</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{pendingCount} pendentes</span>
      </div>
    );
  }

  return (
    <div
      className={`fixed bottom-3 right-3 z-50 bg-emerald-500/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 text-xs transition-all duration-500 hover:opacity-100 ${visible ? 'opacity-60' : 'opacity-0 pointer-events-none'}`}
      onMouseEnter={() => setVisible(true)}
    >
      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
      <span className="font-medium">Online</span>
    </div>
  );
};
