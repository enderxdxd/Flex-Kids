import React, { useEffect, useState } from 'react';
import { useUnit } from '../contexts/UnitContext';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import {
  HomeIcon, UsersIcon, ShoppingCartIcon, PackageIcon, CreditCardIcon,
  ClipboardIcon, GraduationCapIcon, BarChartIcon, BanIcon, DownloadIcon,
  SettingsIcon, BuildingIcon, RefreshIcon, BellIcon, LogOutIcon,
} from './icons/Icons';
import { updateChecker, UpdateInfo } from '../services/updateChecker';
import UpdateModal from './modals/UpdateModal';
import { Badge, cn } from './ui';

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
  const { collapsed, toggle } = useSidebar();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const currentPath = window.location.hash;
  const unitInfo = getCurrentUnitInfo();

  useEffect(() => {
    const handleUpdate = (info: UpdateInfo) => {
      if (info.hasUpdate) setUpdateInfo(info);
    };
    updateChecker.startAutoCheck(handleUpdate);
    return () => updateChecker.stopAutoCheck();
  }, []);

  return (
    <aside
      className="no-print fixed left-0 top-0 h-screen flex flex-col transition-[width] duration-200 z-40 text-slate-200 border-r border-slate-900/50 shadow-2xl"
      style={{
        width: 'var(--sidebar-w-current)',
        backgroundImage:
          'radial-gradient(circle at top right, rgba(124, 58, 237, 0.25) 0%, transparent 60%), linear-gradient(180deg, #0f172a 0%, #020617 100%)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="w-10 h-10 bg-brand-gradient rounded-xl flex items-center justify-center flex-shrink-0 shadow-brand-sm">
          <BuildingIcon className="text-white" size={22} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Flex-Kids</h1>
            <p className="text-[11px] text-slate-400 font-medium">Gestão Integrada</p>
          </div>
        )}
      </div>

      {/* Unit Display */}
      <div className="px-3 py-3 border-b border-white/5">
        {collapsed ? (
          <div
            className="w-10 h-10 bg-brand-500/20 ring-1 ring-brand-400/30 rounded-lg flex items-center justify-center text-xs font-bold text-brand-200 mx-auto"
            title={unitInfo?.name || currentUnit}
          >
            {unitInfo?.name?.charAt(0) || 'U'}
          </div>
        ) : (
          <div className="bg-gradient-to-br from-brand-500/15 to-accent-600/10 ring-1 ring-brand-400/25 rounded-lg px-3 py-2 flex items-center gap-2">
            <BuildingIcon className="text-brand-300 flex-shrink-0" size={16} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{unitInfo?.name || currentUnit}</p>
              {isUnitLocked && (
                <p className="text-[10px] text-brand-200/80 font-medium">Unidade vinculada</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto" aria-label="Navegação principal">
        {navItems.map((item) => {
          const isActive = currentPath === item.href || (item.href === '#/dashboard' && currentPath === '#/');
          const showVisits = item.href === '#/dashboard' && activeVisitsCount !== undefined && activeVisitsCount > 0;
          return (
            <a
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-gradient text-white shadow-brand-sm'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )}
              title={collapsed ? item.label : undefined}
            >
              {isActive && !collapsed && (
                <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-accent-500 shadow-[0_0_12px_rgba(217,70,239,0.7)]" aria-hidden="true" />
              )}
              <item.icon className="flex-shrink-0" size={18} />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && showVisits && (
                <span
                  className={cn(
                    'min-w-[20px] h-5 inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-accent-500 text-white shadow-[0_0_10px_rgba(217,70,239,0.5)] animate-pulse',
                  )}
                >
                  {activeVisitsCount}
                </span>
              )}
              {!collapsed && item.admin && (
                <Badge tone="amber" size="sm">ADM</Badge>
              )}
            </a>
          );
        })}
      </nav>

      {/* Actions */}
      <div className="px-2 py-3 border-t border-white/5 space-y-1">
        {updateInfo?.hasUpdate && (
          <button
            onClick={() => setShowUpdateModal(true)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-brand-gradient text-white shadow-brand-sm hover:brightness-110 transition-all',
              collapsed && 'justify-center',
            )}
            title="Nova atualização disponível"
            aria-label="Nova atualização disponível"
          >
            <div className="relative flex-shrink-0">
              <BellIcon size={16} className="animate-bounce-subtle" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-accent-500 rounded-full animate-pulse" />
            </div>
            {!collapsed && <span>Nova Atualização</span>}
          </button>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              'text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50',
              collapsed && 'justify-center',
            )}
            title="Atualizar dados"
            aria-label="Atualizar dados"
          >
            <RefreshIcon className={loading ? 'animate-spin' : ''} size={16} />
            {!collapsed && <span>Atualizar</span>}
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => { logoutAdmin(); window.location.hash = '#/dashboard'; }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              'text-amber-300 hover:bg-amber-500/10',
              collapsed && 'justify-center',
            )}
            title="Sair do modo administrador"
            aria-label="Sair do modo administrador"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            {!collapsed && <span>Sair do Admin</span>}
          </button>
        )}

        <button
          onClick={logout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            'text-red-300 hover:bg-red-500/10',
            collapsed && 'justify-center',
          )}
          title="Sair do sistema"
          aria-label="Sair do sistema"
        >
          <LogOutIcon size={16} />
          {!collapsed && <span>Sair</span>}
        </button>

        <button
          onClick={toggle}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
            'text-slate-500 hover:bg-white/5 hover:text-slate-300',
            collapsed && 'justify-center',
          )}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <span className="text-base leading-none">{collapsed ? '▶' : '◀'}</span>
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>

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
