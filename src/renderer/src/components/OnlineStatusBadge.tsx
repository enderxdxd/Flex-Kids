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
      <div className={`${baseClasses} bg-orange-50/90 border-orange-200/60 text-orange-700`}>
        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
        <span>Offline</span>
        {pendingCount > 0 && <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full text-[10px]">{pendingCount} pendentes</span>}
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className={`${baseClasses} bg-amber-50/90 border-amber-200/60 text-amber-700`}>
        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
        <span>Online</span>
        <span className="bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full text-[10px]">{pendingCount} pendentes</span>
      </div>
    );
  }

  return (
    <div className={`${baseClasses} bg-white/80 border-emerald-200/60 text-emerald-700`}>
      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
      <span>Online</span>
    </div>
  );
};
