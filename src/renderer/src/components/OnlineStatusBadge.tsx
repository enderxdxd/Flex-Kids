import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OnlineStatusBadge: React.FC = () => {
  const { isOnline, isSyncing, pendingCount } = useOnlineStatus();

  const baseClasses = "fixed bottom-4 left-[252px] z-50 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm border flex items-center gap-2 text-[11px] font-medium transition-all duration-300";

  if (isSyncing) {
    return (
      <div className={`${baseClasses} bg-blue-50/90 border-blue-200/60 text-blue-700`}>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
        <span>Sincronizando</span>
        {pendingCount > 0 && <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-[10px]">{pendingCount}</span>}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className={`${baseClasses} bg-state-warn-soft border-state-warn/30 text-state-warn`}>
        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
        <span>Offline</span>
        {pendingCount > 0 && <span className="bg-orange-100 text-state-warn px-1.5 py-0.5 rounded-full text-[10px]">{pendingCount} pendentes</span>}
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className={`${baseClasses} bg-state-warn-soft border-state-warn/30 text-state-warn`}>
        <div className="w-2 h-2 bg-state-warn rounded-full"></div>
        <span>Online</span>
        <span className="bg-state-warn-soft text-state-warn px-1.5 py-0.5 rounded-full text-[10px]">{pendingCount} pendentes</span>
      </div>
    );
  }

  return (
    <div className={`${baseClasses} bg-paper-raised/80 border-state-ok/30 text-state-ok`}>
      <div className="w-2 h-2 bg-state-ok rounded-full"></div>
      <span>Online</span>
    </div>
  );
};
