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
import { cn } from './ui';

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

  // Trilho em tinta chapada. O gradiente violeta com brilho radial dava ar de
  // material promocional e competia com o conteúdo; aqui ele só precisa separar
  // a navegação do papel e marcar onde o funcionário está.
  return (
    <aside
      className="no-print fixed left-0 top-0 h-screen flex flex-col transition-[width] duration-200 z-40 bg-ink-900 text-ink-300 border-r border-black/20"
      style={{ width: 'var(--sidebar-w-current)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 h-14 border-b border-white/10">
        <div className="w-7 h-7 bg-brand-600 rounded-md flex items-center justify-center flex-shrink-0">
          <BuildingIcon className="text-white" size={16} />
        </div>
        {!collapsed && (
          <h1 className="text-sm font-bold tracking-tight text-white truncate">Flex-Kids</h1>
        )}
      </div>

      {/* Unit Display */}
      <div className="px-3 py-2.5 border-b border-white/10">
        {collapsed ? (
          <div
            className="w-8 h-8 bg-paper-raised/10 rounded-md flex items-center justify-center text-xs font-bold text-ink-200 mx-auto"
            title={unitInfo?.name || currentUnit}
          >
            {unitInfo?.name?.charAt(0) || 'U'}
          </div>
        ) : (
          <div className="px-1">
            <p className="text-caption uppercase text-ink-500">Unidade</p>
            <p className="text-sm font-semibold text-white truncate mt-0.5">{unitInfo?.name || currentUnit}</p>
            {isUnitLocked && <p className="text-[11px] text-ink-500">vinculada a este terminal</p>}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto" aria-label="Navegação principal">
        {navItems.map((item) => {
          const isActive = currentPath === item.href || (item.href === '#/dashboard' && currentPath === '#/');
          const showVisits = item.href === '#/dashboard' && activeVisitsCount !== undefined && activeVisitsCount > 0;
          return (
            <a
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm font-medium transition-colors duration-100',
                'focus-visible:outline-none focus-visible:shadow-focus',
                isActive
                  ? 'bg-paper-raised/10 text-white'
                  : 'text-ink-400 hover:bg-paper-raised/5 hover:text-ink-100',
              )}
              title={collapsed ? item.label : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-brand-400" aria-hidden="true" />
              )}
              <item.icon className="flex-shrink-0" size={16} />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && showVisits && (
                <span
                  className={cn(
                    'min-w-[18px] h-[18px] inline-flex items-center justify-center rounded text-[10px] font-bold px-1 tabular-nums',
                    isActive ? 'bg-paper-raised/20 text-white' : 'bg-paper-raised/10 text-ink-200',
                  )}
                >
                  {activeVisitsCount}
                </span>
              )}
              {!collapsed && item.admin && (
                <span className="text-[10px] font-semibold text-ink-500 tracking-wide">ADM</span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Actions */}
      <div className="px-2 py-2 border-t border-white/10 space-y-0.5">
        {updateInfo?.hasUpdate && (
          <button
            onClick={() => setShowUpdateModal(true)}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm font-medium bg-brand-600 text-white hover:bg-brand-500 transition-colors',
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
              'w-full flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm font-medium transition-colors',
              'text-ink-400 hover:bg-paper-raised/5 hover:text-ink-100 disabled:opacity-50',
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
              'w-full flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm font-medium transition-colors',
              'text-ink-400 hover:bg-paper-raised/5 hover:text-ink-100',
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
            'w-full flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm font-medium transition-colors',
            'text-ink-400 hover:bg-paper-raised/5 hover:text-ink-100',
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
            'w-full flex items-center gap-2.5 px-2.5 h-8 rounded-md text-xs font-medium transition-colors',
            'text-ink-500 hover:bg-paper-raised/5 hover:text-ink-300',
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
