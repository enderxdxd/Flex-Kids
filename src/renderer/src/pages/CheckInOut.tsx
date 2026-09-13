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
  Card, Button, PageHeader, SectionHeader, EmptyState, Skeleton, Badge, Input,
  Clock, ClockStripe, cn,
} from '../components/ui';
import { formatBRL } from '../../../shared/utils/currency';
import { RefreshIcon, GamepadIcon, SearchIcon } from '../components/icons/Icons';
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
      toast.error('Não foi possível carregar clientes e visitas. Verifique a conexão e recarregue a página.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedChild) {
      toast.warning('Selecione a criança que vai entrar.');
      return;
    }

    const alreadyCheckedIn = activeVisits.some(v => v.childId === selectedChild);
    if (alreadyCheckedIn) {
      toast.error('Esta criança já tem um check-in aberto. Faça o check-out antes de registrar uma nova entrada.');
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
      toast.error('Não foi possível registrar o check-in. Tente de novo em alguns segundos.');
    }
  };

  const handleCheckOut = (visit: Visit) => {
    setSelectedVisit(visit);
    setShowCheckOutModal(true);
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
    <div className="space-y-4">
      <PageHeader
        title="Check-in / Check-out"
        subtitle={`Entradas e saídas do turno · ${activeVisits.length} no espaço`}
        actions={
          <Button variant="outline" onClick={loadData} loading={loading} iconLeft={<RefreshIcon size={16} />}>
            Atualizar
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          {/* Registrar entrada é o trabalho principal desta tela: ganha o
              primeiro lugar e o único botão primário. */}
          <Card padding="none">
            <SectionHeader title="Registrar entrada" />
            <div className="p-4 space-y-3">
              <div>
                <label htmlFor="ci-busca" className="block text-caption uppercase text-ink-500 mb-1.5">
                  Buscar criança
                </label>
                <Input
                  id="ci-busca"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Digite o nome…"
                  iconLeft={<SearchIcon size={15} />}
                />
              </div>
              <div>
                <label htmlFor="ci-crianca" className="block text-caption uppercase text-ink-500 mb-1.5">
                  Criança
                </label>
                <select
                  id="ci-crianca"
                  value={selectedChild}
                  onChange={(e) => setSelectedChild(e.target.value)}
                  className="w-full h-control px-2.5 rounded-md text-sm bg-paper-raised text-ink-900 border border-line hover:border-line-strong focus:border-brand-500 focus:outline-none focus-visible:shadow-focus"
                >
                  <option value="">Selecione…</option>
                  {filteredChildren.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name} ({getChildAge(child)} anos)
                    </option>
                  ))}
                </select>
                {searchTerm && (
                  <p className="text-xs text-ink-400 mt-1 tabular-nums">
                    {filteredChildren.length} de {children.length} crianças
                  </p>
                )}
              </div>
              <Button
                fullWidth
                size="lg"
                onClick={handleCheckIn}
                disabled={!selectedChild || loading}
              >
                Registrar check-in
              </Button>
            </div>
          </Card>

          <Card padding="none">
            <SectionHeader title="Resumo" />
            <div className="divide-y divide-line-subtle">
              <div className="flex items-baseline justify-between px-4 py-2.5">
                <span className="text-sm text-ink-600">No espaço agora</span>
                <span className="text-readout-sm text-ink-900 tabular-nums">{activeVisits.length}</span>
              </div>
              <div className="flex items-baseline justify-between px-4 py-2.5">
                <span className="text-sm text-ink-600">Crianças cadastradas</span>
                <span className="text-readout-sm text-ink-900 tabular-nums">{children.length}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card padding="none" className="overflow-hidden">
            <SectionHeader title="No espaço agora" count={activeVisits.length} />

            {loading ? (
              <div className="p-3 space-y-1.5">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-row" />)}
              </div>
            ) : activeVisits.length === 0 ? (
              <EmptyState
                icon={<GamepadIcon size={32} />}
                title="Ninguém no espaço"
                description="Registre a primeira entrada do dia ao lado"
              />
            ) : (
              <div className="divide-y divide-line-subtle">
                {[...activeVisits]
                  .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())
                  .map((visit) => {
                  const child = children.find((c) => c.id === visit.childId);
                  const elapsed = Math.max(0, differenceInMinutes(new Date(), new Date(visit.checkIn)));
                  const estimate = estimateVisitCost(visit);
                  const estimateLabel = estimate.mode === 'kids'
                    ? (estimate.value > 0 ? 'Plano Kids · excedente' : 'Plano Kids')
                    : estimate.mode === 'package'
                      ? (estimate.value > 0 ? 'Pacote · excedente' : 'Coberto pelo pacote')
                      : 'Estimativa';

                  return (
                    <div key={visit.id} className="flex items-center gap-3 pl-3 pr-3 py-2.5 hover:bg-paper transition-colors">
                      <ClockStripe minutes={elapsed} className="self-stretch my-0.5" />

                      <span className="font-mono text-xs text-ink-400 w-11 flex-shrink-0">
                        {format(new Date(visit.checkIn), 'HH:mm')}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm text-ink-900 truncate">
                            {child?.name || 'Criança não encontrada'}
                          </p>
                          {visit.kidsPlanId && <Badge tone="blue" size="sm">Kids</Badge>}
                        </div>
                        <p className="text-xs text-ink-400">{child ? getChildAge(child) : 0} anos</p>
                      </div>

                      <Clock minutes={elapsed} size="lg" className="flex-shrink-0 w-20 text-right" />

                      {/* O valor é o que o balcão precisa saber quando o
                          responsável chega para buscar. */}
                      <div className="flex-shrink-0 w-28 text-right">
                        <p className={cn(
                          'text-sm tabular-nums',
                          estimate.value > 0 ? 'font-semibold text-ink-900' : 'text-ink-400',
                        )}>
                          {estimate.value > 0 ? formatBRL(estimate.value) : 'Pacote'}
                        </p>
                        <p className="text-[11px] text-ink-400 truncate">{estimateLabel}</p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCheckOut(visit)}
                        aria-label={`Check-out de ${child?.name || 'criança'}`}
                        className="flex-shrink-0"
                      >
                        Check-out
                      </Button>
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
