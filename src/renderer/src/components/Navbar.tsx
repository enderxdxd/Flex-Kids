import React, { useState, useEffect } from 'react';
import { useUnit } from '../contexts/UnitContext';
import { useAuth } from '../contexts/AuthContext';
import { HomeIcon, UsersIcon, ShoppingCartIcon, PackageIcon, CreditCardIcon, ClipboardIcon, GraduationCapIcon, BarChartIcon, BanIcon, DownloadIcon, SettingsIcon, BuildingIcon, RefreshIcon, BellIcon } from './icons/Icons';
import { updateChecker, UpdateInfo } from '../services/updateChecker';
import UpdateModal from './modals/UpdateModal';

interface NavbarProps {
  onRefresh?: () => void;
  loading?: boolean;
  activeVisitsCount?: number;
}

const navItems = [
  { href: '#/dashboard', icon: HomeIcon, label: 'Principal' },
  { href: '#/customers', icon: UsersIcon, label: 'Clientes' },
  { href: '#/sell-package', icon: ShoppingCartIcon, label: 'Vender Pacote' },
  { href: '#/packages', icon: PackageIcon, label: 'Gestão Pacotes' },
  { href: '#/payments', icon: CreditCardIcon, label: 'Pagamentos' },
  { href: '#/history', icon: ClipboardIcon, label: 'Histórico' },
  { href: '#/kids-plans', icon: GraduationCapIcon, label: 'Plano Kids' },
  { href: '#/cash-report', icon: BarChartIcon, label: 'Caixa' },
  { href: '#/cancellations', icon: BanIcon, label: 'Cancelamentos' },
  { href: '#/import', icon: DownloadIcon, label: 'Importar Dados', admin: true },
  { href: '#/settings', icon: SettingsIcon, label: 'Configurações' },
];

const Navbar: React.FC<NavbarProps> = ({ onRefresh, loading, activeVisitsCount }) => {
  const { currentUnit, isUnitLocked, getCurrentUnitInfo } = useUnit();
  const { isAdmin, logoutAdmin, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const currentPath = window.location.hash;
  const unitInfo = getCurrentUnitInfo();

  useEffect(() => {
    const handleUpdate = (info: UpdateInfo) => {
      if (info.hasUpdate) {
        setUpdateInfo(info);
      }
    };

    updateChecker.startAutoCheck(handleUpdate);

    return () => {
      updateChecker.stopAutoCheck();
    };
  }, []);

  return (
    <aside className={`no-print fixed left-0 top-0 h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white flex flex-col transition-all duration-300 z-40 shadow-2xl ${collapsed ? 'w-[68px]' : 'w-[240px]'}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-slate-700/30">
        <div className="w-12 h-12 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl shadow-violet-500/30 hover:scale-110 transition-transform duration-300">
          <BuildingIcon className="text-white" size={28} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">Flex-Kids</h1>
            <p className="text-[11px] text-slate-400 font-semibold">Gestão Integrada</p>
          </div>
        )}
      </div>

      {/* Unit Display (locked) */}
      <div className="px-3 py-4 border-b border-slate-700/30">
        {collapsed ? (
          <div className="w-10 h-10 bg-violet-600/20 rounded-lg flex items-center justify-center text-xs font-bold text-violet-400 mx-auto">
            {unitInfo?.name?.charAt(0) || 'U'}
          </div>
        ) : (
          <div className="bg-gradient-to-br from-violet-600/20 to-purple-600/10 border border-violet-500/40 rounded-2xl px-4 py-3 flex items-center gap-2 shadow-lg shadow-violet-500/10">
            <BuildingIcon className="text-violet-300" size={20} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-violet-200 truncate">{unitInfo?.name || currentUnit}</p>
              {isUnitLocked && <p className="text-[10px] text-violet-300/70 font-medium">Unidade vinculada</p>}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentPath === item.href || (item.href === '#/dashboard' && currentPath === '#/');
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 group ${
                isActive
                  ? 'bg-gradient-to-r from-violet-600/30 to-purple-600/20 text-violet-200 shadow-lg shadow-violet-500/20 border border-violet-500/30'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 hover:scale-105'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={`flex-shrink-0 ${isActive ? 'scale-110' : 'group-hover:scale-125'} transition-transform duration-300`} size={20} />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.href === '#/dashboard' && activeVisitsCount !== undefined && activeVisitsCount > 0 && (
                <span className="ml-auto min-w-[22px] h-6 flex items-center justify-center text-[11px] bg-gradient-to-r from-violet-500 to-purple-500 text-white px-2 rounded-full font-bold animate-pulse shadow-lg shadow-violet-500/50">{activeVisitsCount}</span>
              )}
              {!collapsed && item.admin && (
                <span className="ml-auto text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">ADM</span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Actions */}
      <div className="px-3 py-4 border-t border-slate-700/30 space-y-2">
        {/* Update Notification */}
        {updateInfo?.hasUpdate && (
          <button
            onClick={() => setShowUpdateModal(true)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white transition-all shadow-lg hover:shadow-xl relative ${collapsed ? 'justify-center' : ''}`}
            title="Nova atualização disponível"
          >
            <div className="relative">
              <BellIcon size={18} className="animate-[bounce-subtle_1s_ease-in-out_infinite]" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            </div>
            {!collapsed && <span>Nova Atualização</span>}
          </button>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all bg-violet-600 hover:bg-violet-500 disabled:opacity-50 ${collapsed ? 'justify-center' : ''}`}
            title="Atualizar dados"
          >
            <RefreshIcon className={`${loading ? 'animate-spin' : ''}`} size={18} />
            {!collapsed && <span>Atualizar</span>}
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => { logoutAdmin(); window.location.hash = '#/dashboard'; }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-all ${collapsed ? 'justify-center' : ''}`}
            title="Sair do modo administrador"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
            {!collapsed && <span>Sair do Admin</span>}
          </button>
        )}

        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all ${collapsed ? 'justify-center' : ''}`}
          title="Sair do sistema"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" /></svg>
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

      {/* Update Modal */}
      {updateInfo && (
        <UpdateModal
          isOpen={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          currentVersion={updateInfo.currentVersion}
          latestVersion={updateInfo.latestVersion}
          releaseNotes={updateInfo.releaseNotes}
        />
      )}
    </aside>
  );
};

export default Navbar;
