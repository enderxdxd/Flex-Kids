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
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [hourlyRateValue, minimumTimeValue, pixKeyValue, fiscalConfig] = await Promise.all([
        settingsServiceOffline.getHourlyRate(),
        settingsServiceOffline.getMinimumTime(),
        settingsServiceOffline.getPixKey(),
        settingsServiceOffline.getFiscalConfig(),
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
        settingsServiceOffline.setHourlyRate(parseFloat(hourlyRate)),
        settingsServiceOffline.setMinimumTime(parseInt(minimumTime)),
        settingsServiceOffline.setPixKey(pixKey),
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
        }),
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
      });
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
      });
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
        <p className="text-sm text-slate-500">Configurações gerais do sistema</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-5">
            {/* Cobrança */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4">Cobrança</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Valor por Hora (R$)</label>
                  <input type="number" step="0.01" min="0" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="30.00" />
                  <p className="text-[11px] text-slate-400 mt-1">Valor por hora no playground</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tempo Mínimo (min)</label>
                  <input type="number" min="0" value={minimumTime} onChange={(e) => setMinimumTime(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="30" />
                  <p className="text-[11px] text-slate-400 mt-1">Cobrança mínima</p>
                </div>
              </div>
            </div>

            {/* PIX */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4">Chave PIX</h2>
              <input type="text" value={pixKey} onChange={(e) => setPixKey(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="CPF, email, telefone ou chave aleatória" />
              <p className="text-[11px] text-slate-400 mt-1">Chave PIX para recebimento de pagamentos</p>
            </div>

            {/* Impressora */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Impressora</h2>
                {enablePrinting && (
                  <button onClick={handleTestPrinter} disabled={testing} className="text-xs font-medium text-violet-600 hover:text-violet-700 disabled:opacity-50">
                    {testing ? '⏳ Testando...' : '🖨️ Testar Impressora'}
                  </button>
                )}
              </div>
              <label className="flex items-center gap-3 cursor-pointer mb-3">
                <input type="checkbox" checked={enablePrinting} onChange={(e) => handleEnablePrintingChange(e.target.checked)} className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500" />
                <span className="text-sm text-slate-700">Habilitar impressão de comprovante</span>
              </label>
              {enablePrinting && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Porta</label>
                  <select value={printerPort} onChange={(e) => handlePrinterPortChange(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
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
            <button onClick={handleSave} disabled={saving} className="w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 shadow-sm">
              {saving ? '⏳ Salvando...' : 'Salvar Configurações'}
            </button>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Resumo</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Valor/Hora</span>
                  <span className="text-sm font-bold text-slate-800">R$ {parseFloat(hourlyRate || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Tempo Mínimo</span>
                  <span className="text-sm font-bold text-slate-800">{minimumTime} min</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">PIX</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${pixKey ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{pixKey ? 'Configurado' : 'Não configurado'}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-slate-500">Impressora</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${enablePrinting ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{enablePrinting ? 'Ativa' : 'Desativada'}</span>
                </div>
              </div>
            </div>

            {/* Backup & Sync */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Backup & Sincronização</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Pendências de Sync</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${pendingSync > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {pendingSync > 0 ? `${pendingSync} pendentes` : 'Tudo sincronizado'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Unidade</span>
                  <span className="text-[11px] font-bold text-slate-700">{currentUnit || 'N/A'}</span>
                </div>

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
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {exportingSales ? '⏳ Exportando...' : '📊 Exportar Relatório de Vendas (CSV)'}
                </button>
                <p className="text-[10px] text-slate-400">Exporta pagamentos, visitas e pacotes em CSV (abre no Excel). Ideal para controle financeiro.</p>

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
                  className="w-full bg-slate-600 hover:bg-slate-700 text-white py-2.5 rounded-lg font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {exporting ? '⏳ Exportando...' : '💾 Backup Completo (JSON)'}
                </button>
                <p className="text-[10px] text-slate-400">Backup técnico com todos os dados brutos. Use para restauração em caso de emergência.</p>

                <div className="bg-blue-50 rounded-lg p-3 mt-2">
                  <p className="text-[11px] font-semibold text-blue-700 mb-1">Seus dados estão seguros</p>
                  <p className="text-[10px] text-blue-600">Todos os dados são salvos automaticamente no Firebase (nuvem). Mesmo que limpe o cache ou troque de PC, os dados são recuperados. O relatório CSV é para seu controle financeiro pessoal.</p>
                </div>

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
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg font-semibold text-xs transition-colors"
                  >
                    🔄 Forçar Sincronização ({pendingSync} pendentes)
                  </button>
                )}
              </div>
            </div>

            {/* System Info */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Sistema</h2>
              <div className="space-y-2 text-xs text-slate-500">
                <div className="flex justify-between"><span>Versão</span><span className="font-medium text-slate-700">1.0.0</span></div>
                <div className="flex justify-between"><span>Plataforma</span><span className="font-medium text-slate-700">Electron + React</span></div>
                <div className="flex justify-between"><span>Banco</span><span className="font-medium text-slate-700">Cloud Firestore</span></div>
              </div>
            </div>

            {/* Atualizações */}
            <UpdateChecker />

            {/* Danger Zone - Password Protected */}
            <div className="bg-red-50 rounded-xl border border-red-200 p-5">
              <h2 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-3">Zona de Perigo</h2>
              <p className="text-[11px] text-red-400 mb-3">Limpa todo o cache local (IndexedDB). Os dados no Firebase não serão afetados, mas dados offline não sincronizados serão perdidos.</p>
              {!confirmClear ? (
                <button
                  onClick={() => { setConfirmClear(true); setAdminPassword(''); }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg font-semibold text-xs transition-colors"
                >
                  🗑️ Limpar Cache Total
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-red-600 text-center">Digite a senha de administrador para confirmar:</p>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Senha do admin"
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold text-xs transition-colors disabled:opacity-50"
                    >
                      {clearingCache ? '⏳ Limpando...' : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => { setConfirmClear(false); setAdminPassword(''); }}
                      className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded-lg font-semibold text-xs transition-colors"
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
