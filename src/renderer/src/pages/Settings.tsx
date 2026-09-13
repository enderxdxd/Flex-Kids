import React, { useEffect, useState } from 'react';
import { formatBRL } from '../../../shared/utils/currency';
import { toast } from 'react-toastify';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';
import { bematechService } from '../../../shared/services/bematech.service';
import { webSerialPrinter } from '../../../shared/services/webSerialPrinter';
import { syncService } from '../../../shared/database/syncService';
import { localDb } from '../../../shared/database/localDb';
import { useUnit } from '../contexts/UnitContext';
import { useAuth } from '../contexts/AuthContext';
import { Customer, Payment, Visit, Package, Child } from '../../../shared/types';
import UpdateChecker from '../components/UpdateChecker';

const Settings: React.FC = () => {
  const { currentUnit } = useUnit();
  const { isAdmin } = useAuth();
  const [hourlyRate, setHourlyRate] = useState('30.00');
  const [minimumTime, setMinimumTime] = useState('30');
  const [pixKey, setPixKey] = useState('');
  const [enablePrinting, setEnablePrinting] = useState(false);
  const [printerPort, setPrinterPort] = useState('AUTO');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectingPrinter, setConnectingPrinter] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  // No navegador (site) a impressão usa Web Serial (Chrome/Edge + HTTPS), que
  // exige o usuário autorizar a porta uma vez via clique.
  const isBrowserPrinting = typeof window !== 'undefined' && !window.electronAPI && webSerialPrinter.isSupported();
  const [exporting, setExporting] = useState(false);
  const [exportingSales, setExportingSales] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [clearingCache, setClearingCache] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [billingAdminAuth, setBillingAdminAuth] = useState(false);
  const [billingAdminPwd, setBillingAdminPwd] = useState('');

  const ADMIN_PASSWORD = 'pactoflex123';
  const canEditBilling = isAdmin || billingAdminAuth;

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
      toast.success('Configurações salvas com sucesso!');
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
      toast.success(enabled ? 'Impressão habilitada!' : 'Impressão desabilitada!');
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
      toast.success('Porta atualizada!');
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
        toast.success('Impressora testada com sucesso!');
      } else {
        toast.error('Não foi possível conectar à impressora');
      }
    } catch (error) {
      console.error('Error testing printer:', error);
      toast.error('Erro ao testar impressora');
    } finally {
      setTesting(false);
    }
  };

  // Autoriza/conecta a impressora no navegador (Web Serial). DEVE rodar dentro
  // do clique para o popup de seleção de porta aparecer.
  const handleConnectPrinterBrowser = async () => {
    try {
      setConnectingPrinter(true);
      const ok = await webSerialPrinter.requestPort(115200);
      if (ok) {
        setPrinterConnected(true);
        toast.success('Impressora conectada! A autorização fica salva neste navegador.');
      } else {
        setPrinterConnected(false);
        toast.error(webSerialPrinter.getLastError() || 'Não foi possível conectar à impressora');
      }
    } catch (error) {
      console.error('Error connecting printer (web serial):', error);
      toast.error('Erro ao conectar impressora');
    } finally {
      setConnectingPrinter(false);
    }
  };

  // No navegador, tenta reconectar silenciosamente a uma porta já autorizada
  // (sem popup) para que a impressão funcione logo após recarregar a página.
  useEffect(() => {
    if (!isBrowserPrinting || !enablePrinting) return;
    let cancelled = false;
    webSerialPrinter.connect().then(ok => {
      if (!cancelled) setPrinterConnected(ok);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isBrowserPrinting, enablePrinting]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-ink-900">Configurações</h1>
        <p className="text-sm text-ink-500 mt-1">Configurações da unidade <span className="font-semibold text-brand-700">{currentUnit}</span></p>
      </div>

      {loading ? (
        <div className="bg-paper-raised rounded-card-lg border border-line/80 shadow-card p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-ink-100/50 rounded-card" />)}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-5">
            {/* Cobrança */}
            <div className="bg-paper-raised rounded-card-lg border border-line/80 shadow-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-ink-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                  <h2 className="text-caption uppercase text-ink-500">Cobrança</h2>
                </div>
                {canEditBilling && !isAdmin && (
                  <button onClick={() => { setBillingAdminAuth(false); setBillingAdminPwd(''); }} className="text-[11px] text-ink-500 hover:text-ink-700 transition-colors flex items-center gap-1 focus:outline-none focus-visible:shadow-focus rounded" aria-label="Bloquear edição de cobrança"><svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg> Bloquear</button>
                )}
              </div>

              {!canEditBilling && (
                <div className="mb-5 p-4 border-2 border-state-warn/30 bg-state-warn-soft rounded-card">
                  <p className="text-xs font-semibold text-state-warn mb-2 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg> Senha de administrador necessária</p>
                  <div className="flex gap-2">
                    <input type="password" value={billingAdminPwd} onChange={(e) => setBillingAdminPwd(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { if (billingAdminPwd === ADMIN_PASSWORD) { setBillingAdminAuth(true); toast.success('Autenticado!'); } else { toast.error('Senha incorreta'); setBillingAdminPwd(''); } } }}
                      placeholder="Senha admin" className="flex-1 px-3 py-2 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus" />
                    <button type="button" onClick={() => { if (billingAdminPwd === ADMIN_PASSWORD) { setBillingAdminAuth(true); toast.success('Autenticado!'); } else { toast.error('Senha incorreta'); setBillingAdminPwd(''); } }}
                      className="bg-state-warn text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-state-warn transition-colors focus:outline-none focus-visible:shadow-focus">Entrar</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-caption uppercase text-ink-500 mb-1.5">Valor por hora</label>
                  <input type="number" step="0.01" min="0" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} disabled={!canEditBilling} className={`w-full px-4 py-2.5 border border-line rounded-card text-sm focus:outline-none focus-visible:shadow-focus focus:border-brand-500 transition-all hover:border-line-strong ${!canEditBilling ? 'bg-ink-100 text-ink-400 cursor-not-allowed' : 'bg-paper/50'}`} placeholder="30.00" />
                  <p className="text-[11px] text-ink-400 mt-1.5">{canEditBilling ? 'Valor por hora no playground' : 'Digite a senha acima para alterar'}</p>
                </div>
                <div>
                  <label className="block text-caption uppercase text-ink-500 mb-1.5">Tempo mínimo (min)</label>
                  <input type="number" min="0" value={minimumTime} onChange={(e) => setMinimumTime(e.target.value)} disabled={!canEditBilling} className={`w-full px-4 py-2.5 border border-line rounded-card text-sm focus:outline-none focus-visible:shadow-focus focus:border-brand-500 transition-all hover:border-line-strong ${!canEditBilling ? 'bg-ink-100 text-ink-400 cursor-not-allowed' : 'bg-paper/50'}`} placeholder="30" />
                  <p className="text-[11px] text-ink-400 mt-1.5">{canEditBilling ? 'Cobrança mínima' : 'Digite a senha acima para alterar'}</p>
                </div>
              </div>
            </div>


            {/* Impressora */}
            <div className="bg-paper-raised rounded-card-lg border border-line/80 shadow-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-ink-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12Zm-2.25 0h.008v.008H16.5V12Z" /></svg>
                  <h2 className="text-caption uppercase text-ink-500">Impressora</h2>
                </div>
                {enablePrinting && (
                  <button onClick={handleTestPrinter} disabled={testing} className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-all">
                    {testing ? (
                      <><svg className="w-3.5 h-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Testando...</>
                    ) : (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Testar</>
                    )}
                  </button>
                )}
              </div>
              <label className="flex items-center gap-3 cursor-pointer mb-4 p-3 rounded-card bg-paper/50 border border-line-subtle hover:border-violet-200 transition-all">
                <div className="relative">
                  <input type="checkbox" checked={enablePrinting} onChange={(e) => handleEnablePrintingChange(e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-5 bg-slate-300 rounded-full peer-checked:bg-brand-gradient transition-colors"></div>
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-paper-raised rounded-full shadow-sm transition-transform peer-checked:translate-x-5"></div>
                </div>
                <span className="text-sm text-ink-700 font-medium">Habilitar impressão de comprovante</span>
              </label>
              {enablePrinting && isBrowserPrinting && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-card bg-paper/50 border border-line-subtle">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${printerConnected ? 'bg-state-ok' : 'bg-slate-300'}`}></span>
                      <span className="text-sm text-ink-700 font-medium">
                        {printerConnected ? 'Impressora conectada' : 'Impressora não conectada'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleConnectPrinterBrowser}
                      disabled={connectingPrinter}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-all"
                    >
                      {connectingPrinter ? (
                        <><svg className="w-3.5 h-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Conectando...</>
                      ) : (
                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v6H4z"/><path d="M6 14h12v6H6z"/><path d="M6 10v4"/><path d="M18 10v4"/></svg> {printerConnected ? 'Reconectar' : 'Conectar impressora'}</>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-ink-400">
                    No navegador, escolha a porta da impressora uma vez. A autorização fica salva neste navegador (Chrome/Edge, HTTPS).
                  </p>
                </div>
              )}
              {enablePrinting && !isBrowserPrinting && (
                <div>
                  <label className="block text-xs font-semibold text-ink-600 mb-2">Porta</label>
                  <select value={printerPort} onChange={(e) => handlePrinterPortChange(e.target.value)} className="w-full px-4 py-2.5 border border-line rounded-card text-sm bg-paper/50 focus:outline-none focus-visible:shadow-focus focus:border-brand-500 transition-all hover:border-line-strong">
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
            <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving} className="h-control px-4 bg-brand-gradient hover:brightness-[1.08] shadow-brand-sm text-white rounded-md font-semibold text-sm transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-focus flex items-center justify-center gap-2">
              {saving ? (
                <><svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Salvando…</>
              ) : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar alterações</>
              )}
            </button>
            </div>

            {/* Sistema + Atualizações + Danger Zone — na coluna principal para equilibrar */}
            <div className="grid grid-cols-2 gap-5">
              {/* System Info */}
              <div className="bg-paper-raised rounded-card-lg border border-line p-5">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-ink-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                  <h2 className="text-caption uppercase text-ink-500">Sistema</h2>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs py-1.5">
                    <span className="text-ink-500">Versão</span>
                    <span className="font-bold text-ink-700 bg-ink-100 px-2.5 py-0.5 rounded-full text-[10px]">{import.meta.env.VITE_APP_VERSION || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5">
                    <span className="text-ink-500">Plataforma</span>
                    <span className="font-medium text-ink-700">Electron + React</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5">
                    <span className="text-ink-500">Banco</span>
                    <span className="font-medium text-ink-700">Cloud Firestore</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5">
                    <span className="text-ink-500">Unidade</span>
                    <span className="font-medium text-ink-700">{currentUnit || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-paper-raised rounded-card-lg border border-line p-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-ink-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                  <h2 className="text-caption uppercase text-ink-500">Manutenção</h2>
                </div>
                <p className="text-xs text-ink-500 mb-3 leading-relaxed">Limpa o cache local deste terminal. Os dados no servidor não são afetados.</p>
                {!confirmClear ? (
                  <button
                    onClick={() => { setConfirmClear(true); setAdminPassword(''); }}
                    className="inline-flex items-center gap-2 h-8 px-3 border border-line text-ink-600 hover:border-danger-300 hover:text-danger-600 hover:bg-danger-50 rounded-md font-semibold text-xs transition-colors focus-visible:outline-none focus-visible:shadow-focus"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Limpar cache local
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-state-bad text-center">Senha de administrador:</p>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Senha do admin"
                      className="w-full px-4 py-2.5 border border-state-bad/30 rounded-card text-sm bg-paper-raised focus:outline-none focus-visible:shadow-focus/40 focus:border-state-bad/30 transition-all"
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
                            toast.success('Cache limpo! Recarregando...');
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
                        className="flex-1 bg-state-bad hover:bg-danger-600 text-white py-2.5 rounded-card font-semibold text-xs transition-all disabled:opacity-50"
                      >
                        {clearingCache ? 'Limpando...' : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => { setConfirmClear(false); setAdminPassword(''); }}
                        className="flex-1 bg-ink-100 hover:bg-ink-200 text-ink-600 py-2.5 rounded-card font-semibold text-xs transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Atualizações - full width na coluna principal */}
            <UpdateChecker />
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-paper-raised rounded-card-lg border border-line/80 shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-ink-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" /></svg>
                <h2 className="text-caption uppercase text-ink-500">Resumo</h2>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-paper/80 transition-colors">
                  <span className="text-xs text-ink-500">Valor/Hora</span>
                  <span className="text-sm font-bold text-ink-900">{formatBRL(parseFloat(hourlyRate || '0'))}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-paper/80 transition-colors">
                  <span className="text-xs text-ink-500">Tempo Mínimo</span>
                  <span className="text-sm font-bold text-ink-900">{minimumTime} min</span>
                </div>
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-paper/80 transition-colors">
                  <span className="text-xs text-ink-500">Impressora</span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${enablePrinting ? 'bg-state-ok-soft text-state-ok' : 'bg-ink-100 text-ink-400'}`}>{enablePrinting ? 'Ativa' : 'Desativada'}</span>
                </div>
              </div>
            </div>

            {/* Backup & Sync */}
            <div className="bg-paper-raised rounded-card-lg border border-line/80 shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-ink-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" /></svg>
                <h2 className="text-caption uppercase text-ink-500">Backup e sincronização</h2>
              </div>

              <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-paper/50 mb-3">
                <span className="text-xs text-ink-500">Sincronização</span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${pendingSync > 0 ? 'bg-state-warn-soft text-state-warn' : 'bg-state-ok-soft text-state-ok'}`}>
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
                  className="w-full flex items-center gap-2.5 px-4 py-3 rounded-card border border-state-ok/30 bg-state-ok-soft hover:bg-state-ok-soft text-state-ok font-semibold text-xs transition-all hover:border-state-ok/30 disabled:opacity-50"
                >
                  <svg className="w-4 h-4 text-state-ok flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>
                  <div className="text-left flex-1">
                    <span className="block">{exportingSales ? 'Exportando...' : 'Relatório de Vendas (CSV)'}</span>
                    <span className="text-[10px] font-normal text-state-ok">Pagamentos, visitas e pacotes</span>
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
                  className="w-full flex items-center gap-2.5 px-4 py-3 rounded-card border border-line bg-paper/50 hover:bg-paper text-ink-700 font-semibold text-xs transition-all hover:border-line-strong disabled:opacity-50"
                >
                  <svg className="w-4 h-4 text-ink-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
                  <div className="text-left flex-1">
                    <span className="block">{exporting ? 'Exportando...' : 'Backup Completo (JSON)'}</span>
                    <span className="text-[10px] font-normal text-ink-400">Dados brutos para restauração</span>
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
                    className="w-full flex items-center gap-2.5 px-4 py-3 rounded-card border border-state-warn/30 bg-state-warn-soft hover:bg-state-warn-soft text-state-warn font-semibold text-xs transition-all hover:border-state-warn/30"
                  >
                    <svg className="w-4 h-4 text-state-warn flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
                    <div className="text-left flex-1">
                      <span className="block">Forçar Sincronização</span>
                      <span className="text-[10px] font-normal text-state-warn">{pendingSync} itens pendentes</span>
                    </div>
                  </button>
                )}
              </div>

              <div className="bg-blue-50/80 rounded-card p-3 mt-3 border border-blue-100/50">
                <p className="text-[11px] font-semibold text-blue-700 mb-0.5 flex items-center gap-1"><svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" /></svg> Seus dados estão seguros</p>
                <p className="text-[10px] text-blue-500 leading-relaxed">Todos os dados são salvos automaticamente no Firebase. O CSV é para controle financeiro pessoal.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
