import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';
import { bematechService } from '../../../shared/services/bematech.service';
import { syncService } from '../../../shared/database/syncService';
import { localDb } from '../../../shared/database/localDb';
import { useUnit } from '../contexts/UnitContext';
import { Customer, Payment, Visit, Package, Child } from '../../../shared/types';
import UpdateChecker from '../components/UpdateChecker';

const Settings: React.FC = () => {
  const { currentUnit } = useUnit();
  const [hourlyRate, setHourlyRate] = useState('30.00');
  const [minimumTime, setMinimumTime] = useState('30');
  const [pixKey, setPixKey] = useState('');
  const [enablePrinting, setEnablePrinting] = useState(false);
  const [printerPort, setPrinterPort] = useState('AUTO');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingSales, setExportingSales] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [clearingCache, setClearingCache] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    loadSettings();
    syncService.getPendingSyncCount().then(setPendingSync).catch(() => {});
    const unsub = syncService.onPendingCountChange(setPendingSync);
    return () => unsub();
  }, [currentUnit]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [hourlyRateValue, minimumTimeValue, pixKeyValue, fiscalConfig] = await Promise.all([
        settingsServiceOffline.getHourlyRate(currentUnit),
        settingsServiceOffline.getMinimumTime(currentUnit),
        settingsServiceOffline.getPixKey(currentUnit),
        settingsServiceOffline.getFiscalConfig(currentUnit),
      ]);
      setHourlyRate(hourlyRateValue.toString());
      setMinimumTime(minimumTimeValue.toString());
      setPixKey(pixKeyValue || '');
      if (fiscalConfig) {
        setEnablePrinting(fiscalConfig.enableFiscalPrint);
        setPrinterPort(fiscalConfig.printerPort || 'AUTO');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!hourlyRate || parseFloat(hourlyRate) <= 0) {
      toast.error('Valor por hora deve ser maior que zero');
      return;
    }

    if (!minimumTime || parseInt(minimumTime) <= 0) {
      toast.error('Tempo mínimo deve ser maior que zero');
      return;
    }

    try {
      setSaving(true);
      await Promise.all([
        settingsServiceOffline.setHourlyRate(parseFloat(hourlyRate), currentUnit),
        settingsServiceOffline.setMinimumTime(parseInt(minimumTime), currentUnit),
        settingsServiceOffline.setPixKey(pixKey, currentUnit),
        settingsServiceOffline.saveFiscalConfig({
          companyName: 'Flex-Kids',
          cnpj: '',
          ie: '',
          address: '',
          city: '',
          state: '',
          zipCode: '',
          phone: '',
          printerPort: printerPort,
          printerModel: 'MP-4200',
          enableFiscalPrint: enablePrinting,
        }, currentUnit),
      ]);
      toast.success('✅ Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePrintingChange = async (enabled: boolean) => {
    setEnablePrinting(enabled);
    
    // Salvar automaticamente
    try {
      await settingsServiceOffline.saveFiscalConfig({
        companyName: 'Flex-Kids',
        cnpj: '',
        ie: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        printerPort: printerPort,
        printerModel: 'MP-4200',
        enableFiscalPrint: enabled,
      }, currentUnit);
      toast.success(enabled ? '✅ Impressão habilitada!' : '✅ Impressão desabilitada!');
    } catch (error) {
      console.error('Error saving print config:', error);
      toast.error('Erro ao salvar configuração');
    }
  };

  const handlePrinterPortChange = async (port: string) => {
    setPrinterPort(port);
    
    // Salvar automaticamente
    try {
      await settingsServiceOffline.saveFiscalConfig({
        companyName: 'Flex-Kids',
        cnpj: '',
        ie: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        printerPort: port,
        printerModel: 'MP-4200',
        enableFiscalPrint: enablePrinting,
      }, currentUnit);
      toast.success('✅ Porta atualizada!');
    } catch (error) {
      console.error('Error saving port config:', error);
      toast.error('Erro ao salvar porta');
    }
  };

  const handleTestPrinter = async () => {
    if (!enablePrinting) {
      toast.warning('Habilite a impressão primeiro');
      return;
    }

    try {
      setTesting(true);
      const config = {
        id: 'fiscalConfig',
        companyName: 'Flex-Kids',
        cnpj: '',
        ie: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        printerPort: printerPort,
        printerModel: 'MP-4200' as const,
        enableFiscalPrint: enablePrinting,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const connected = await bematechService.initialize(config);
      
      if (connected) {
        await bematechService.printNonFiscalReport(
          'TESTE DE IMPRESSORA',
          [
            '================================',
            'Teste de conexão realizado',
            `Porta: ${printerPort}`,
            'Sistema: Flex-Kids',
            '================================',
            'Impressora funcionando!',
          ]
        );
        toast.success('✅ Impressora testada com sucesso!');
      } else {
        toast.error('❌ Não foi possível conectar à impressora');
      }
    } catch (error) {
      console.error('Error testing printer:', error);
      toast.error('Erro ao testar impressora');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Configurações</h1>
        <p className="text-sm text-slate-500">Configurações da unidade <span className="font-semibold text-violet-600">{currentUnit}</span></p>
      </div>

      {loading ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-md p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-slate-100/50 rounded-xl" />)}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-5">
            {/* Cobrança */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-md p-6">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-base">💲</span>
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Cobrança</h2>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Valor por Hora (R$)</label>
                  <input type="number" step="0.01" min="0" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 transition-all hover:border-slate-300" placeholder="30.00" />
                  <p className="text-[11px] text-slate-400 mt-1.5">Valor por hora no playground</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Tempo Mínimo (min)</label>
                  <input type="number" min="0" value={minimumTime} onChange={(e) => setMinimumTime(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 transition-all hover:border-slate-300" placeholder="30" />
                  <p className="text-[11px] text-slate-400 mt-1.5">Cobrança mínima</p>
                </div>
              </div>
            </div>

            {/* PIX */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-md p-6">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-base">⚡</span>
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Chave PIX</h2>
              </div>
              <input type="text" value={pixKey} onChange={(e) => setPixKey(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 transition-all hover:border-slate-300" placeholder="CPF, email, telefone ou chave aleatória" />
              <p className="text-[11px] text-slate-400 mt-1.5">Chave PIX para recebimento de pagamentos</p>
            </div>

            {/* Impressora */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-md p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-base">🖨️</span>
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Impressora</h2>
                </div>
                {enablePrinting && (
                  <button onClick={handleTestPrinter} disabled={testing} className="text-xs font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-all">
                    {testing ? (
                      <><span className="animate-spin">⏳</span> Testando...</>
                    ) : (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Testar</>
                    )}
                  </button>
                )}
              </div>
              <label className="flex items-center gap-3 cursor-pointer mb-4 p-3 rounded-xl bg-slate-50/50 border border-slate-100 hover:border-violet-200 transition-all">
                <div className="relative">
                  <input type="checkbox" checked={enablePrinting} onChange={(e) => handleEnablePrintingChange(e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-5 bg-slate-300 rounded-full peer-checked:bg-violet-500 transition-colors"></div>
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-5"></div>
                </div>
                <span className="text-sm text-slate-700 font-medium">Habilitar impressão de comprovante</span>
              </label>
              {enablePrinting && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Porta</label>
                  <select value={printerPort} onChange={(e) => handlePrinterPortChange(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 transition-all hover:border-slate-300">
                    <option value="AUTO">Detectar Automaticamente</option>
                    <option value="COM1">COM1</option>
                    <option value="COM2">COM2</option>
                    <option value="COM3">COM3</option>
                    <option value="COM4">COM4</option>
                  </select>
                </div>
              )}
            </div>

            {/* Save */}
            <button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 shadow-md hover:shadow-lg flex items-center justify-center gap-2">
              {saving ? (
                <><span className="animate-spin">⏳</span> Salvando...</>
              ) : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar Configurações</>
              )}
            </button>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-md p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">📋</span>
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Resumo</h2>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-slate-50/80 transition-colors">
                  <span className="text-xs text-slate-500">Valor/Hora</span>
                  <span className="text-sm font-bold text-slate-800">R$ {parseFloat(hourlyRate || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-slate-50/80 transition-colors">
                  <span className="text-xs text-slate-500">Tempo Mínimo</span>
                  <span className="text-sm font-bold text-slate-800">{minimumTime} min</span>
                </div>
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-slate-50/80 transition-colors">
                  <span className="text-xs text-slate-500">PIX</span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${pixKey ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{pixKey ? 'Configurado' : 'Não configurado'}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-slate-50/80 transition-colors">
                  <span className="text-xs text-slate-500">Impressora</span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${enablePrinting ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{enablePrinting ? 'Ativa' : 'Desativada'}</span>
                </div>
              </div>
            </div>

            {/* Backup & Sync */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-md p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">☁️</span>
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Backup & Sync</h2>
              </div>

              <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-slate-50/50 mb-3">
                <span className="text-xs text-slate-500">Sincronização</span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${pendingSync > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {pendingSync > 0 ? `${pendingSync} pendentes` : '✓ Sincronizado'}
                </span>
              </div>

              <div className="space-y-2">
                {/* Relatório de Vendas CSV */}
                <button
                  onClick={async () => {
                    try {
                      setExportingSales(true);
                      const [payments, customers, visits, children, packages] = await Promise.all([
                        syncService.getAllFromLocal('payments') as Promise<Payment[]>,
                        syncService.getAllFromLocal('customers') as Promise<Customer[]>,
                        syncService.getAllFromLocal('visits') as Promise<Visit[]>,
                        syncService.getAllFromLocal('children') as Promise<Child[]>,
                        syncService.getAllFromLocal('packages') as Promise<Package[]>,
                      ]);

                      const customerMap = new Map(customers.map(c => [c.id, c.name]));
                      const childMap = new Map(children.map(c => [c.id, c.name]));

                      const formatDate = (d: any) => {
                        if (!d) return '';
                        const date = d instanceof Date ? d : new Date(d);
                        if (isNaN(date.getTime())) return '';
                        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      };

                      const methodLabel: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'PIX', cartao: 'Cartão', pacote: 'Pacote' };

                      // Pagamentos
                      let csv = '\uFEFF'; // BOM for Excel UTF-8
                      csv += 'RELATÓRIO DE VENDAS - FLEX KIDS\n';
                      csv += `Exportado em;${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\n`;
                      csv += `Unidade;${currentUnit || 'Todas'}\n\n`;

                      csv += '=== PAGAMENTOS ===\n';
                      csv += 'Data;Cliente;Criança;Tipo;Método;Valor;Status;Descrição\n';
                      const sortedPayments = [...payments].sort((a, b) => {
                        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const db2 = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return db2 - da;
                      });
                      let totalReceived = 0;
                      for (const p of sortedPayments) {
                        const clientName = customerMap.get(p.customerId) || p.customerId;
                        const childName = p.childId ? (childMap.get(p.childId) || p.childName || '') : (p.childName || '');
                        const tipo = p.type === 'package' ? 'Pacote' : 'Visita';
                        const metodo = methodLabel[p.method] || p.method;
                        const status = p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : p.status === 'cancelled' ? 'Cancelado' : p.status;
                        csv += `${formatDate(p.createdAt)};${clientName};${childName};${tipo};${metodo};${(p.amount || 0).toFixed(2).replace('.', ',')};${status};${p.description || ''}\n`;
                        if (p.status === 'paid') totalReceived += (p.amount || 0);
                      }
                      csv += `\nTOTAL RECEBIDO;;;;;;${totalReceived.toFixed(2).replace('.', ',')}\n`;
                      csv += `TOTAL REGISTROS;;;;;;${sortedPayments.length}\n\n`;

                      // Visitas
                      csv += '=== VISITAS ===\n';
                      csv += 'Entrada;Saída;Criança;Duração (min);Valor;Pago;Pacote Usado\n';
                      const sortedVisits = [...visits].sort((a, b) => {
                        const da = a.checkIn ? new Date(a.checkIn).getTime() : 0;
                        const db2 = b.checkIn ? new Date(b.checkIn).getTime() : 0;
                        return db2 - da;
                      });
                      for (const v of sortedVisits) {
                        const childName = childMap.get(v.childId) || v.childId;
                        const dur = v.duration ? Math.round(v.duration) : '';
                        const pago = v.paid ? 'Sim' : 'Não';
                        const pkgUsed = v.packageId ? 'Sim' : 'Não';
                        csv += `${formatDate(v.checkIn)};${formatDate(v.checkOut)};${childName};${dur};${(v.value || 0).toFixed(2).replace('.', ',')};${pago};${pkgUsed}\n`;
                      }
                      csv += `\nTOTAL VISITAS;;;;;;${sortedVisits.length}\n\n`;

                      // Pacotes
                      csv += '=== PACOTES ===\n';
                      csv += 'Cliente;Tipo;Horas Compradas;Horas Usadas;Horas Restantes;Ativo;Preço;Criado Em\n';
                      for (const pkg of packages) {
                        const clientName = customerMap.get(pkg.customerId) || pkg.customerId;
                        const remaining = Math.max(0, pkg.hours - pkg.usedHours);
                        csv += `${clientName};${pkg.type};${pkg.hours.toFixed(1).replace('.', ',')};${pkg.usedHours.toFixed(1).replace('.', ',')};${remaining.toFixed(1).replace('.', ',')};${pkg.active ? 'Sim' : 'Não'};${(pkg.price || 0).toFixed(2).replace('.', ',')};${formatDate(pkg.createdAt)}\n`;
                      }
                      csv += `\nTOTAL PACOTES;;;;;;${packages.length}\n`;

                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      const now = new Date();
                      const dateStr = now.toISOString().split('T')[0];
                      a.href = url;
                      a.download = `flexkids-vendas-${currentUnit || 'all'}-${dateStr}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      toast.success(`Relatório exportado! ${sortedPayments.length} pagamentos, ${sortedVisits.length} visitas, ${packages.length} pacotes`);
                    } catch (error) {
                      console.error('Error exporting sales:', error);
                      toast.error('Erro ao exportar relatório');
                    } finally {
                      setExportingSales(false);
                    }
                  }}
                  disabled={!!exportingSales}
                  className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 font-semibold text-xs transition-all hover:border-emerald-300 disabled:opacity-50"
                >
                  <span>📊</span>
                  <div className="text-left flex-1">
                    <span className="block">{exportingSales ? 'Exportando...' : 'Relatório de Vendas (CSV)'}</span>
                    <span className="text-[10px] font-normal text-emerald-500">Pagamentos, visitas e pacotes</span>
                  </div>
                </button>

                {/* Backup Completo JSON */}
                <button
                  onClick={async () => {
                    try {
                      setExporting(true);
                      const json = await syncService.exportBackup();
                      const blob = new Blob([json], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      const now = new Date();
                      const dateStr = now.toISOString().split('T')[0];
                      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
                      a.href = url;
                      a.download = `flexkids-backup-${currentUnit || 'all'}-${dateStr}_${timeStr}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      toast.success('Backup completo exportado!');
                    } catch (error) {
                      console.error('Error exporting backup:', error);
                      toast.error('Erro ao exportar backup');
                    } finally {
                      setExporting(false);
                    }
                  }}
                  disabled={exporting}
                  className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all hover:border-slate-300 disabled:opacity-50"
                >
                  <span>💾</span>
                  <div className="text-left flex-1">
                    <span className="block">{exporting ? 'Exportando...' : 'Backup Completo (JSON)'}</span>
                    <span className="text-[10px] font-normal text-slate-400">Dados brutos para restauração</span>
                  </div>
                </button>

                {pendingSync > 0 && (
                  <button
                    onClick={async () => {
                      try {
                        await syncService.syncAll();
                        const count = await syncService.getPendingSyncCount();
                        setPendingSync(count);
                        if (count === 0) {
                          toast.success('Tudo sincronizado!');
                        } else {
                          toast.info(`${count} itens ainda pendentes`);
                        }
                      } catch {
                        toast.error('Erro ao sincronizar');
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-700 font-semibold text-xs transition-all hover:border-amber-300"
                  >
                    <span>🔄</span>
                    <div className="text-left flex-1">
                      <span className="block">Forçar Sincronização</span>
                      <span className="text-[10px] font-normal text-amber-500">{pendingSync} itens pendentes</span>
                    </div>
                  </button>
                )}
              </div>

              <div className="bg-blue-50/80 rounded-xl p-3 mt-3 border border-blue-100/50">
                <p className="text-[11px] font-semibold text-blue-700 mb-0.5">☁️ Seus dados estão seguros</p>
                <p className="text-[10px] text-blue-500 leading-relaxed">Todos os dados são salvos automaticamente no Firebase. O CSV é para controle financeiro pessoal.</p>
              </div>
            </div>

            {/* System Info */}
            <div className="bg-slate-50/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">⚙️</span>
                <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Sistema</h2>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs py-1.5">
                  <span className="text-slate-500">Versão</span>
                  <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full text-[10px]">{import.meta.env.VITE_APP_VERSION || '—'}</span>
                </div>
                <div className="flex justify-between items-center text-xs py-1.5">
                  <span className="text-slate-500">Plataforma</span>
                  <span className="font-medium text-slate-700">Electron + React</span>
                </div>
                <div className="flex justify-between items-center text-xs py-1.5">
                  <span className="text-slate-500">Banco</span>
                  <span className="font-medium text-slate-700">Cloud Firestore</span>
                </div>
                <div className="flex justify-between items-center text-xs py-1.5">
                  <span className="text-slate-500">Unidade</span>
                  <span className="font-medium text-violet-600">{currentUnit || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Atualizações */}
            <UpdateChecker />

            {/* Danger Zone - Password Protected */}
            <div className="bg-red-50/80 backdrop-blur-xl rounded-2xl border border-red-200/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">⚠️</span>
                <h2 className="text-sm font-bold text-red-600 uppercase tracking-wider">Zona de Perigo</h2>
              </div>
              <p className="text-[11px] text-red-400 mb-4 leading-relaxed">Limpa todo o cache local (IndexedDB). Os dados no Firebase não serão afetados, mas dados offline não sincronizados serão perdidos.</p>
              {!confirmClear ? (
                <button
                  onClick={() => { setConfirmClear(true); setAdminPassword(''); }}
                  className="w-full flex items-center justify-center gap-2 bg-red-500/90 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold text-xs transition-all hover:shadow-md"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Limpar Cache Total
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-red-600 text-center">Digite a senha de administrador:</p>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Senha do admin"
                    className="w-full px-4 py-2.5 border border-red-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-400 transition-all"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (adminPassword !== 'pactoflex123') {
                          toast.error('Senha incorreta!');
                          return;
                        }
                        try {
                          setClearingCache(true);
                          await localDb.close();
                          const databases = await window.indexedDB.databases();
                          for (const dbInfo of databases) {
                            if (dbInfo.name) {
                              window.indexedDB.deleteDatabase(dbInfo.name);
                            }
                          }
                          toast.success('✅ Cache limpo! Recarregando...');
                          setTimeout(() => window.location.reload(), 1500);
                        } catch (error) {
                          console.error('Error clearing cache:', error);
                          toast.error('Erro ao limpar cache');
                        } finally {
                          setClearingCache(false);
                          setConfirmClear(false);
                          setAdminPassword('');
                        }
                      }}
                      disabled={clearingCache || !adminPassword}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-semibold text-xs transition-all disabled:opacity-50"
                    >
                      {clearingCache ? '⏳ Limpando...' : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => { setConfirmClear(false); setAdminPassword(''); }}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl font-semibold text-xs transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
