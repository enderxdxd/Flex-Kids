import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useUnit } from '../contexts/UnitContext';
import { Visit, Child, KidsPlan, Package } from '../../../shared/types';
import { format, differenceInMinutes } from 'date-fns';
import { visitsServiceOffline } from '../../../shared/firebase/services/visits.service.offline';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';
import { kidsPlansServiceOffline } from '../../../shared/firebase/services/kidsPlans.service.offline';
import { packagesServiceOffline } from '../../../shared/firebase/services/packages.service.offline';
import { getChildAge } from '../../../shared/utils/age';
import {
  calculateKidsPlanCoverage,
  calculateMultiPackageCoverage,
  calculatePrincipalValue,
} from '../../../shared/utils/billing';
import {
  Card, Button, PageHeader, EmptyState, Skeleton, Badge, cn,
} from '../components/ui';
import { RefreshIcon, PlusIcon, GamepadIcon } from '../components/icons/Icons';
import CheckOutModal from '../components/modals/CheckOutModal';

const CheckInOut: React.FC = () => {
  const { currentUnit } = useUnit();
  const [activeVisits, setActiveVisits] = useState<Visit[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(30);
  const [minimumTime, setMinimumTime] = useState(30);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [kidsPlans, setKidsPlans] = useState<KidsPlan[]>([]);
  const [activePackages, setActivePackages] = useState<Package[]>([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);

    const handleVisitsUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.visits && (!detail.unitId || detail.unitId === currentUnit)) {
        setActiveVisits(detail.visits);
      }
    };
    window.addEventListener('visits-updated', handleVisitsUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visits-updated', handleVisitsUpdated);
    };
  }, [currentUnit]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [visits, allChildren, settings, activePlans, pkgs] = await Promise.all([
        visitsServiceOffline.getActiveVisits(currentUnit),
        customersServiceOffline.getAllChildren(currentUnit),
        settingsServiceOffline.getSettings(currentUnit),
        kidsPlansServiceOffline.getActivePlans(currentUnit),
        packagesServiceOffline.getActivePackages(undefined, currentUnit),
      ]);
      setActiveVisits(visits);
      setChildren(allChildren);
      setHourlyRate(settings.hourlyRate || 30);
      setMinimumTime(settings.minimumTime || 30);
      setKidsPlans(activePlans);
      setActivePackages(pkgs);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedChild) {
      toast.warning('Selecione uma criança');
      return;
    }

    const alreadyCheckedIn = activeVisits.some(v => v.childId === selectedChild);
    if (alreadyCheckedIn) {
      toast.error('Esta criança já está com check-in ativo!');
      return;
    }

    try {
      const child = children.find(c => c.id === selectedChild);
      const plan = kidsPlans.find(p =>
        p.childId === selectedChild ||
        (!!child?.enrollmentCode && p.enrollmentCode === child.enrollmentCode)
      );

      await visitsServiceOffline.checkIn({
        childId: selectedChild,
        unitId: currentUnit,
        kidsPlanId: plan?.id,
      });
      toast.success(plan ? 'Check-in realizado (Plano Kids)!' : 'Check-in realizado com sucesso!');
      setSelectedChild('');
      setSearchTerm('');
      loadData();
    } catch (error) {
      console.error('Error during check-in:', error);
      toast.error('Erro ao realizar check-in');
    }
  };

  const handleCheckOut = (visit: Visit) => {
    setSelectedVisit(visit);
    setShowCheckOutModal(true);
  };

  const calculateDuration = (checkIn: Date) => {
    const minutes = Math.max(0, differenceInMinutes(new Date(), new Date(checkIn)));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Estimativa coerente com o cálculo real do checkout (billing.ts).
  // Não conhece desconto colaborador nem inclusão de irmãos — esses ajustes
  // acontecem no CheckOutModal.
  const estimateVisitCost = (visit: Visit): { value: number; mode: 'kids' | 'package' | 'avulso' } => {
    const minutes = Math.max(0, differenceInMinutes(new Date(), new Date(visit.checkIn)));

    if (visit.kidsPlanId) {
      const cov = calculateKidsPlanCoverage(minutes, minimumTime);
      const value = cov.billableExcessMin > 0
        ? Math.round((cov.billableExcessMin / 60) * hourlyRate * 100) / 100
        : 0;
      return { value, mode: 'kids' };
    }

    const child = children.find(c => c.id === visit.childId);
    const customerId = child?.customerId;
    const customerPackages = customerId
      ? activePackages.filter(p => p.customerId === customerId && (p.hours - p.usedHours) > 0)
      : [];

    if (customerPackages.length > 0) {
      const cov = calculateMultiPackageCoverage(
        customerPackages.map(p => ({ id: p.id, type: p.type, hours: p.hours, usedHours: p.usedHours })),
        minutes,
        minimumTime,
      );
      const value = calculatePrincipalValue({
        isKidsPlan: false,
        usePackages: true,
        durationMin: minutes,
        minimumTime,
        hourlyRate,
        multiCoverage: cov,
      });
      return { value, mode: 'package' };
    }

    const billableMinutes = Math.max(minutes, minimumTime);
    const value = Math.round((billableMinutes / 60) * hourlyRate * 100) / 100;
    return { value, mode: 'avulso' };
  };

  const filteredChildren = children.filter(child =>
    child.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-In / Check-Out"
        subtitle={`Gerenciar entradas e saídas · ${activeVisits.length} visitas ativas`}
        actions={
          <Button variant="outline" onClick={loadData} loading={loading} iconLeft={<RefreshIcon size={16} />}>
            Atualizar
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card padding="lg" className="relative overflow-hidden bg-brand-gradient text-white border-0 shadow-brand">
            <h2 className="text-2xl font-bold mb-5 flex items-center gap-2">
              <PlusIcon size={20} /> Novo Check-In
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-white/80 uppercase tracking-wider">
                  Buscar Criança
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Digite o nome..."
                  className="w-full h-11 px-3 rounded-lg text-slate-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-white/60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-white/80 uppercase tracking-wider">
                  Selecione a Criança
                </label>
                <select
                  value={selectedChild}
                  onChange={(e) => setSelectedChild(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg text-slate-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-white/60"
                >
                  <option value="">Selecione...</option>
                  {filteredChildren.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name} ({getChildAge(child)} anos)
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCheckIn}
                disabled={!selectedChild || loading}
                className="w-full h-12 bg-white text-brand-700 rounded-lg font-bold hover:bg-brand-50 disabled:bg-white/40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Realizar Check-In
              </button>
            </div>
          </Card>

          <Card padding="md">
            <h3 className="text-heading text-slate-900 mb-3">Estatísticas</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-3 rounded-lg bg-gradient-to-br from-blue-50 to-sky-50">
                <span className="text-sm text-slate-700">Visitas Ativas</span>
                <span className="text-2xl font-bold text-blue-700 tabular-nums">{activeVisits.length}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50">
                <span className="text-sm text-slate-700">Crianças Cadastradas</span>
                <span className="text-2xl font-bold text-emerald-700 tabular-nums">{children.length}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card padding="none" accent>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-brand-50/50 to-transparent">
              <h2 className="text-heading bg-brand-gradient bg-clip-text text-transparent">Visitas Ativas</h2>
              <Badge tone="brand">{activeVisits.length}</Badge>
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : activeVisits.length === 0 ? (
              <EmptyState
                icon={<GamepadIcon size={28} />}
                title="Nenhuma visita ativa"
                description="Faça o primeiro check-in do dia!"
              />
            ) : (
              <div className="p-5 space-y-3">
                {activeVisits.map((visit) => {
                  const child = children.find((c) => c.id === visit.childId);
                  const duration = calculateDuration(visit.checkIn);
                  const estimate = estimateVisitCost(visit);
                  const estimateLabel = estimate.mode === 'kids'
                    ? (estimate.value > 0 ? 'Plano Kids (excedente)' : 'Plano Kids')
                    : estimate.mode === 'package'
                      ? (estimate.value > 0 ? 'Pacote (excedente)' : 'Coberto pelo pacote')
                      : 'Estimativa';

                  return (
                    <div
                      key={visit.id}
                      className={cn(
                        'border border-slate-200 rounded-card p-4 transition-all duration-200',
                        'hover:border-brand-300 hover:shadow-card-hover hover:-translate-y-0.5',
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-brand-gradient rounded-full flex items-center justify-center text-white text-xl font-bold shadow-brand-sm">
                              {child?.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-lg text-slate-900">
                                {child?.name || 'Criança não encontrada'}
                              </h3>
                              <p className="text-sm text-slate-500">
                                {child ? getChildAge(child) : 0} anos
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mt-3">
                            <div className="bg-gradient-to-br from-blue-50 to-sky-50 p-3 rounded-lg border border-blue-100">
                              <p className="text-[10px] text-blue-700/70 mb-0.5 font-semibold uppercase">Check-in</p>
                              <p className="font-bold text-blue-700 tabular-nums">
                                {format(new Date(visit.checkIn), 'HH:mm')}
                              </p>
                            </div>
                            <div className="bg-gradient-to-br from-brand-50 to-fuchsia-50 p-3 rounded-lg border border-brand-100">
                              <p className="text-[10px] text-brand-700/70 mb-0.5 font-semibold uppercase">Duração</p>
                              <p className="font-bold text-brand-700 tabular-nums">{duration}</p>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-3 rounded-lg border border-emerald-100">
                              <p className="text-[10px] text-emerald-700/70 mb-0.5 font-semibold uppercase">{estimateLabel}</p>
                              <p className="font-bold text-emerald-700 tabular-nums">R$ {estimate.value.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="danger"
                          onClick={() => handleCheckOut(visit)}
                          aria-label={`Check-out de ${child?.name || 'Criança'}`}
                          className="ml-4"
                        >
                          Check-Out
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
      {selectedVisit && (
        <CheckOutModal
          isOpen={showCheckOutModal}
          onClose={() => {
            setShowCheckOutModal(false);
            setSelectedVisit(null);
          }}
          onSuccess={() => {
            setShowCheckOutModal(false);
            setSelectedVisit(null);
            loadData();
          }}
          visit={selectedVisit}
          activeVisits={activeVisits}
        />
      )}
    </div>
  );
};

export default CheckInOut;
