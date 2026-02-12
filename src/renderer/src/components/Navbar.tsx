import React, { useState } from 'react';
import { useUnit } from '../contexts/UnitContext';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  onRefresh?: () => void;
  loading?: boolean;
}

const navItems = [
  { href: '#/dashboard', icon: '🏠', label: 'Principal' },
  { href: '#/customers', icon: '👥', label: 'Clientes' },
  { href: '#/sell-package', icon: '🛒', label: 'Vender Pacote' },
  { href: '#/packages', icon: '📦', label: 'Gestão Pacotes', admin: true },
  { href: '#/payments', icon: '💳', label: 'Pagamentos' },
  { href: '#/history', icon: '📋', label: 'Histórico' },
  { href: '#/cash-report', icon: '📊', label: 'Caixa' },
  { href: '#/cancellations', icon: '🚫', label: 'Cancelamentos' },
  { href: '#/settings', icon: '⚙️', label: 'Configurações' },
];

const Navbar: React.FC<NavbarProps> = ({ onRefresh, loading }) => {
  const { currentUnit, isUnitLocked, getCurrentUnitInfo } = useUnit();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const currentPath = window.location.hash;
  const unitInfo = getCurrentUnitInfo();

  return (
    <aside className={`no-print fixed left-0 top-0 h-screen bg-slate-900 text-white flex flex-col transition-all duration-300 z-40 ${collapsed ? 'w-[68px]' : 'w-[240px]'}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-lg shadow-violet-500/25">
          🎮
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold tracking-tight">Flex-Kids</h1>
            <p className="text-[10px] text-slate-400 font-medium">Gestão Integrada</p>
          </div>
        )}
      </div>

      {/* Unit Display (locked) */}
      <div className="px-3 py-3 border-b border-slate-700/50">
        {collapsed ? (
          <div className="w-10 h-10 bg-violet-600/20 rounded-lg flex items-center justify-center text-xs font-bold text-violet-400 mx-auto">
            {unitInfo?.name?.charAt(0) || 'U'}
          </div>
        ) : (
          <div className="bg-violet-600/15 border border-violet-500/30 rounded-lg px-3 py-2.5 flex items-center gap-2">
            <span className="text-violet-400 text-sm">🏢</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-violet-300 truncate">{unitInfo?.name || currentUnit}</p>
              {isUnitLocked && <p className="text-[10px] text-violet-400/70">Unidade vinculada</p>}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentPath === item.href || (item.href === '#/dashboard' && currentPath === '#/');
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-violet-600/20 text-violet-300 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className={`text-lg flex-shrink-0 ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.admin && (
                <span className="ml-auto text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">ADM</span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Actions */}
      <div className="px-2 py-3 border-t border-slate-700/50 space-y-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all bg-violet-600 hover:bg-violet-500 disabled:opacity-50 ${collapsed ? 'justify-center' : ''}`}
            title="Atualizar dados"
          >
            <span className={`text-lg ${loading ? 'animate-spin' : ''}`}>{loading ? '⏳' : '🔄'}</span>
            {!collapsed && <span>Atualizar</span>}
          </button>
        )}

        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all ${collapsed ? 'justify-center' : ''}`}
          title="Sair do sistema"
        >
          <span className="text-lg">�</span>
          {!collapsed && <span>Sair</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <span className="text-base">{collapsed ? '▶' : '◀'}</span>
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
};

export default Navbar;
