import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { getDb } from '../../../shared/firebase/config';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { packagesServiceOffline } from '../../../shared/firebase/services/packages.service.offline';
import { syncService } from '../../../shared/database/syncService';
import { useUnit } from '../contexts/UnitContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RawResponsavel {
  codResponsavel: string;
  nome: string;
  telefone: string;
  email: string;
  cpf: string;
}

interface RawCrianca {
  codCrianca: string;
  nome: string;
  dtNascimento: string;
  codResponsavel: string;
}

interface RawPacote {
  codPacote: string;
  dtVenda: string;
  codResponsavel: string;
  nomeResponsavel: string;
  pacote: string;
  minutosVendidos: number;
  minutosUsados: number;
  venceu: boolean;
}

interface ImportLog {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'done' | 'deleting';

interface ImportedIds {
  customerIds: string[];
  childIds: string[];
  packageIds: string[];
  importedAt: string;
}

const IMPORTED_IDS_PREFIX = 'flex-kids-imported-ids';

function getKey(unitId: string): string {
  return `${IMPORTED_IDS_PREFIX}-${unitId}`;
}

function loadImportedIds(unitId: string): ImportedIds | null {
  try {
    const raw = localStorage.getItem(getKey(unitId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveImportedIds(unitId: string, ids: ImportedIds): void {
  localStorage.setItem(getKey(unitId), JSON.stringify(ids));
}

function clearImportedIds(unitId: string): void {
  localStorage.removeItem(getKey(unitId));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanPhone(raw: any): string {
  const str = String(raw || '').trim();
  if (!str || str === '0' || str === '()' || str === '() -' || /^[\s\-()_.]+$/.test(str)) return '';
  return str;
}

function cleanCpf(raw: any): string {
  const str = String(raw || '').trim();
  if (!str || str === '0' || /^[.\-/\s]+$/.test(str)) return '';
  return str;
}

function parseBirthDate(dtNascimento: string): Date | undefined {
  if (!dtNascimento) return undefined;
  try {
    let date: Date;
    if (dtNascimento.includes('/')) {
      const [d, m, y] = dtNascimento.split('/');
      date = new Date(Number(y), Number(m) - 1, Number(d));
    } else {
      date = new Date(dtNascimento);
    }
    return isNaN(date.getTime()) ? undefined : date;
  } catch {
    return undefined;
  }
}

function calcAge(dtNascimento: string): number {
  const bd = parseBirthDate(dtNascimento);
  if (!bd) return 0;
  const diff = Date.now() - bd.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function parseExcelDate(raw: any): Date {
  if (!raw) return new Date();
  if (typeof raw === 'number') {
    // Excel serial date
    const utcDays = Math.floor(raw - 25569);
    return new Date(utcDays * 86400 * 1000);
  }
  const str = String(raw).trim();
  if (str.includes('/')) {
    const [d, m, y] = str.split('/');
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function firstMatch(row: any, keys: string[]): any {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  return undefined;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Component ───────────────────────────────────────────────────────────────

const ImportData: React.FC = () => {
  const { currentUnit } = useUnit();

  // Files
  const [responsaveisFile, setResponsaveisFile] = useState<File | null>(null);
  const [pacotesFile, setPacotesFile] = useState<File | null>(null);

  // Parsed data
  const [responsaveis, setResponsaveis] = useState<RawResponsavel[]>([]);
  const [criancas, setCriancas] = useState<RawCrianca[]>([]);
  const [pacotes, setPacotes] = useState<RawPacote[]>([]);

  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [dryRun, setDryRun] = useState(true);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const cancelRef = useRef(false);

  // Tracked IDs for rollback
  const [createdIds, setCreatedIds] = useState<ImportedIds | null>(loadImportedIds(currentUnit));
  const [deleting, setDeleting] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    customersCreated: 0,
    customersSkipped: 0,
    childrenCreated: 0,
    childrenSkipped: 0,
    packagesCreated: 0,
    packagesSkipped: 0,
    errors: 0,
  });

  // ─── Parse XLSX ──────────────────────────────────────────────────────────

  const parseResponsaveisFile = async (file: File) => {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    // Log actual column names for debugging
    if (rows.length > 0) {
      console.log('[ImportData] Colunas do arquivo de responsáveis:', Object.keys(rows[0]));
    }

    const responsaveisMap = new Map<string, RawResponsavel>();
    const criancasList: RawCrianca[] = [];

    for (const row of rows) {
      const codResp = String(firstMatch(row, ['Cod. Responsavel', 'Cod.Responsavel', 'CodResponsavel', 'Cod Responsavel', 'cod_responsavel', 'COD. RESPONSAVEL']) ?? '').trim();
      const nomeResp = String(firstMatch(row, ['Responsavel', 'Responsável', 'RESPONSAVEL', 'Nome Responsavel', 'NomeResponsavel']) ?? '').trim().toUpperCase();
      const codCrianca = String(firstMatch(row, ['Cod. Criança', 'Cod.Criança', 'CodCrianca', 'Cod Crianca', 'cod_crianca', 'COD. CRIANÇA']) ?? '').trim();
      const nomeCrianca = String(firstMatch(row, ['Criança', 'Crianca', 'CRIANÇA', 'Nome Crianca', 'NomeCrianca']) ?? '').trim().toUpperCase();
      const dtNasc = String(firstMatch(row, ['Dt. Nascimento', 'Dt.Nascimento', 'DtNascimento', 'Data Nascimento', 'DataNascimento', 'DT. NASCIMENTO']) ?? '').trim();
      const fone = cleanPhone(firstMatch(row, ['Fone Celular', 'FoneCelular', 'Fone1', 'Telefone', 'Celular', 'FONE CELULAR']) ?? '');
      const email = String(firstMatch(row, ['Email', 'EMAIL', 'E-mail']) ?? '').trim();
      const cpf = cleanCpf(firstMatch(row, ['CPF', 'Cpf']) ?? '');

      if (codResp && nomeResp && !responsaveisMap.has(codResp)) {
        responsaveisMap.set(codResp, { codResponsavel: codResp, nome: nomeResp, telefone: fone, email, cpf });
      }

      if (codCrianca && nomeCrianca) {
        criancasList.push({ codCrianca, nome: nomeCrianca, dtNascimento: dtNasc, codResponsavel: codResp });
      }
    }

    setResponsaveis(Array.from(responsaveisMap.values()));
    setCriancas(criancasList);
    return { responsaveis: responsaveisMap.size, criancas: criancasList.length };
  };

  const parsePacotesFile = async (file: File) => {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    // Log actual column names for debugging
    if (rows.length > 0) {
      console.log('[ImportData] Colunas do arquivo de pacotes:', Object.keys(rows[0]));
    }

    const pacotesList: RawPacote[] = [];

    for (const row of rows) {
      const codPacote = String(firstMatch(row, ['CodPacote', 'Cod.Pacote', 'Cod Pacote', 'cod_pacote', 'CODPACOTE']) ?? '').trim();
      const dtVenda = firstMatch(row, ['DT_VENDA', 'DtVenda', 'Dt_Venda', 'DataVenda', 'Data Venda', 'DT VENDA']) ?? '';
      const codResp = String(firstMatch(row, ['CodResponsavel', 'Cod.Responsavel', 'Cod Responsavel', 'Cod. Responsavel', 'cod_responsavel', 'CODRESPONSAVEL']) ?? '').trim();
      const nomeResp = String(firstMatch(row, ['Responsavel', 'Responsável', 'RESPONSAVEL', 'Nome Responsavel', 'NomeResponsavel']) ?? '').trim();
      const pacote = String(firstMatch(row, ['Pacote', 'PACOTE', 'TipoPacote', 'Tipo Pacote']) ?? '').trim();
      const minutosVendidos = Number(firstMatch(row, ['QtdMinutosVendidos', 'MinutosVendidos', 'Minutos Vendidos', 'QTDMINUTOSVENDIDOS']) ?? 0);
      const minutosDisp = Number(firstMatch(row, ['QtdMinutosDisponiveis', 'MinutosDisponiveis', 'Minutos Disponiveis', 'QTDMINUTOSDISPONIVEIS']) ?? 0);
      const venceu = String(firstMatch(row, ['Venceu?', 'Venceu', 'VENCEU', 'venceu']) ?? '0').trim();

      if (codPacote) {
        pacotesList.push({
          codPacote,
          dtVenda: String(dtVenda),
          codResponsavel: codResp,
          nomeResponsavel: nomeResp,
          pacote,
          minutosVendidos,
          minutosUsados: minutosVendidos - minutosDisp,
          venceu: venceu === '1' || venceu.toLowerCase() === 'sim',
        });
      }
    }

    setPacotes(pacotesList);
    return { pacotes: pacotesList.length };
  };

  const handleParse = async () => {
    try {
      let rCount = { responsaveis: 0, criancas: 0 };
      let pCount = { pacotes: 0 };

      if (responsaveisFile) {
        rCount = await parseResponsaveisFile(responsaveisFile);
      }
      if (pacotesFile) {
        pCount = await parsePacotesFile(pacotesFile);
      }

      toast.success(`Lido: ${rCount.responsaveis} responsáveis, ${rCount.criancas} crianças, ${pCount.pacotes} pacotes`);
      setStep('preview');
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Erro ao ler planilhas. Verifique o formato.');
    }
  };

  // ─── Import ──────────────────────────────────────────────────────────────

  const addLog = (log: ImportLog) => {
    setLogs(prev => [...prev, log]);
  };

  const handleImport = async () => {
    cancelRef.current = false;
    setStep('importing');
    setLogs([]);
    setStats({ customersCreated: 0, customersSkipped: 0, childrenCreated: 0, childrenSkipped: 0, packagesCreated: 0, packagesSkipped: 0, errors: 0 });

    const localStats = { customersCreated: 0, customersSkipped: 0, childrenCreated: 0, childrenSkipped: 0, packagesCreated: 0, packagesSkipped: 0, errors: 0 };
    const trackedIds: ImportedIds = { customerIds: [], childIds: [], packageIds: [], importedAt: new Date().toISOString() };

    addLog({ type: 'info', message: dryRun ? '🔍 MODO SIMULAÇÃO — nada será gravado' : '🚀 IMPORTAÇÃO REAL — gravando direto no Firebase' });

    // Block import if offline (to avoid local_ IDs)
    if (!dryRun && !syncService.isOnline()) {
      addLog({ type: 'error', message: '❌ Importação requer conexão com a internet. Conecte-se e tente novamente.' });
      setStep('done');
      toast.error('Importação requer conexão com a internet');
      return;
    }

    const db = !dryRun ? getDb() : null;

    // ─── 1. Fetch existing customers for duplicate detection ─────────
    addLog({ type: 'info', message: 'Carregando clientes existentes para detecção de duplicatas...' });
    let existingCustomers: { id: string; name: string }[] = [];
    try {
      const all = await customersServiceOffline.getAllCustomers(currentUnit);
      existingCustomers = all.map(c => ({ id: c.id, name: c.name.toUpperCase().trim() }));
      addLog({ type: 'info', message: `${existingCustomers.length} clientes existentes carregados` });
    } catch (e) {
      addLog({ type: 'warning', message: 'Não foi possível carregar clientes existentes. Duplicatas podem ocorrer.' });
    }

    // Load existing children for duplicate detection
    let existingChildren: { id: string; name: string; customerId: string }[] = [];
    try {
      const allChildren = await customersServiceOffline.getAllChildren(currentUnit);
      existingChildren = allChildren.map(c => ({ id: c.id, name: c.name.toUpperCase().trim(), customerId: c.customerId }));
      addLog({ type: 'info', message: `${existingChildren.length} crianças existentes carregadas` });
    } catch (e) {
      addLog({ type: 'warning', message: 'Não foi possível carregar crianças existentes.' });
    }

    // Load existing packages for duplicate detection
    let existingPackages: { id: string; customerId: string; type: string; hours: number }[] = [];
    try {
      const allPkgs = await packagesServiceOffline.getAllPackages();
      existingPackages = allPkgs.map(p => ({ id: p.id, customerId: p.customerId, type: p.type.toUpperCase().trim(), hours: p.hours }));
      addLog({ type: 'info', message: `${existingPackages.length} pacotes existentes carregados` });
    } catch (e) {
      addLog({ type: 'warning', message: 'Não foi possível carregar pacotes existentes.' });
    }

    // ─── 2. Import Responsáveis → customers ──────────────────────────
    const codToFirebaseId = new Map<string, string>();
    const nameToFirebaseId = new Map<string, string>();
    const total = responsaveis.length + criancas.length + pacotes.length;
    let current = 0;

    setProgress({ current: 0, total, label: 'Importando responsáveis...' });

    for (const resp of responsaveis) {
      if (cancelRef.current) { addLog({ type: 'warning', message: '⛔ Importação cancelada pelo usuário' }); break; }

      current++;
      setProgress({ current, total, label: `Responsável: ${resp.nome}` });

      // Duplicate check
      const existing = existingCustomers.find(c => c.name === resp.nome.toUpperCase().trim());
      if (existing) {
        codToFirebaseId.set(resp.codResponsavel, existing.id);
        nameToFirebaseId.set(resp.nome.toUpperCase().trim(), existing.id);
        localStats.customersSkipped++;
        addLog({ type: 'warning', message: `Duplicata: "${resp.nome}" já existe (ID: ${existing.id})` });
        continue;
      }

      if (dryRun) {
        codToFirebaseId.set(resp.codResponsavel, `dry_${resp.codResponsavel}`);
        nameToFirebaseId.set(resp.nome.toUpperCase().trim(), `dry_${resp.codResponsavel}`);
        localStats.customersCreated++;
        continue;
      }

      try {
        // Write directly to Firebase to guarantee a real Firebase ID (never local_)
        const docRef = await addDoc(collection(db!, 'customers'), {
          name: resp.nome,
          phone: resp.telefone,
          email: resp.email || '',
          cpf: resp.cpf || '',
          address: '',
          unitId: currentUnit,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        const firebaseId = docRef.id;
        // Cache locally (no sync queue)
        await syncService.saveToCacheOnly('customers', {
          id: firebaseId,
          name: resp.nome,
          phone: resp.telefone,
          email: resp.email || '',
          cpf: resp.cpf || '',
          address: '',
          unitId: currentUnit,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        codToFirebaseId.set(resp.codResponsavel, firebaseId);
        nameToFirebaseId.set(resp.nome.toUpperCase().trim(), firebaseId);
        existingCustomers.push({ id: firebaseId, name: resp.nome.toUpperCase().trim() });
        trackedIds.customerIds.push(firebaseId);
        localStats.customersCreated++;
      } catch (error) {
        localStats.errors++;
        addLog({ type: 'error', message: `Erro ao criar "${resp.nome}": ${error}` });
      }

      // Throttle every 50 records
      if (current % 50 === 0) {
        addLog({ type: 'info', message: `Pausa de throttling... (${current}/${total})` });
        await sleep(500);
      }
    }

    // ─── 3. Import Crianças → children ───────────────────────────────
    setProgress({ current, total, label: 'Importando crianças...' });

    for (const crianca of criancas) {
      if (cancelRef.current) break;

      current++;
      setProgress({ current, total, label: `Criança: ${crianca.nome}` });

      const customerId = codToFirebaseId.get(crianca.codResponsavel);
      if (!customerId) {
        localStats.errors++;
        addLog({ type: 'error', message: `Criança "${crianca.nome}" sem responsável (cod: ${crianca.codResponsavel})` });
        continue;
      }

      // Duplicate check: same name + same customerId
      const existingChild = existingChildren.find(c => c.name === crianca.nome.toUpperCase().trim() && c.customerId === customerId);
      if (existingChild) {
        localStats.childrenSkipped++;
        addLog({ type: 'warning', message: `Duplicata: criança "${crianca.nome}" já existe para este responsável` });
        continue;
      }

      if (dryRun) {
        localStats.childrenCreated++;
        existingChildren.push({ id: `dry_${crianca.codCrianca}`, name: crianca.nome.toUpperCase().trim(), customerId });
        continue;
      }

      try {
        const birthDate = parseBirthDate(crianca.dtNascimento);
        // Write directly to Firebase to guarantee a real Firebase ID
        const docRef = await addDoc(collection(db!, 'children'), {
          name: crianca.nome,
          age: calcAge(crianca.dtNascimento),
          birthDate: birthDate ? Timestamp.fromDate(birthDate) : null,
          customerId,
          unitId: currentUnit,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        const firebaseId = docRef.id;
        await syncService.saveToCacheOnly('children', {
          id: firebaseId,
          name: crianca.nome,
          age: calcAge(crianca.dtNascimento),
          birthDate,
          customerId,
          unitId: currentUnit,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        trackedIds.childIds.push(firebaseId);
        existingChildren.push({ id: firebaseId, name: crianca.nome.toUpperCase().trim(), customerId });
        localStats.childrenCreated++;
      } catch (error) {
        localStats.errors++;
        addLog({ type: 'error', message: `Erro ao criar criança "${crianca.nome}": ${error}` });
      }

      if (current % 50 === 0) {
        await sleep(500);
      }
    }

    // ─── 4. Import Pacotes → packages ────────────────────────────────
    setProgress({ current, total, label: 'Importando pacotes...' });

    for (const pac of pacotes) {
      if (cancelRef.current) break;

      current++;
      setProgress({ current, total, label: `Pacote: ${pac.pacote} - ${pac.nomeResponsavel}` });

      // Try to find customerId: first by code, then by name
      let customerId = codToFirebaseId.get(pac.codResponsavel);
      if (!customerId && pac.nomeResponsavel) {
        const byName = nameToFirebaseId.get(pac.nomeResponsavel.toUpperCase().trim());
        if (byName) customerId = byName;
      }
      if (!customerId) {
        localStats.packagesSkipped++;
        addLog({ type: 'warning', message: `Pacote "${pac.pacote}" sem responsável (cod: ${pac.codResponsavel}, nome: ${pac.nomeResponsavel})` });
        continue;
      }

      // Duplicate check: same type + same customerId + same hours
      const pkgHours = pac.minutosVendidos / 60;
      const existingPkg = existingPackages.find(p => p.type === pac.pacote.toUpperCase().trim() && p.customerId === customerId && Math.abs(p.hours - pkgHours) < 0.01);
      if (existingPkg) {
        localStats.packagesSkipped++;
        addLog({ type: 'warning', message: `Duplicata: pacote "${pac.pacote}" já existe para este responsável (${pac.minutosVendidos} min)` });
        continue;
      }

      if (dryRun) {
        localStats.packagesCreated++;
        existingPackages.push({ id: `dry_${pac.codPacote}`, customerId, type: pac.pacote.toUpperCase().trim(), hours: pkgHours });
        continue;
      }

      try {
        const dtVenda = parseExcelDate(pac.dtVenda);
        const expiresAt = new Date(dtVenda);
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        // Write directly to Firebase to guarantee a real Firebase ID
        const docRef = await addDoc(collection(db!, 'packages'), {
          customerId,
          type: pac.pacote,
          hours: pac.minutosVendidos / 60,
          usedHours: pac.minutosUsados / 60,
          price: 0,
          active: !pac.venceu && (pac.minutosUsados < pac.minutosVendidos),
          sharedAcrossUnits: false,
          unitId: currentUnit,
          expiresAt: Timestamp.fromDate(expiresAt),
          createdAt: Timestamp.fromDate(dtVenda),
          updatedAt: Timestamp.now(),
        });
        const firebaseId = docRef.id;
        await syncService.saveToCacheOnly('packages', {
          id: firebaseId,
          customerId,
          type: pac.pacote,
          hours: pac.minutosVendidos / 60,
          usedHours: pac.minutosUsados / 60,
          price: 0,
          active: !pac.venceu && (pac.minutosUsados < pac.minutosVendidos),
          sharedAcrossUnits: false,
          unitId: currentUnit,
          expiresAt,
          createdAt: dtVenda,
          updatedAt: new Date(),
        });
        trackedIds.packageIds.push(firebaseId);
        existingPackages.push({ id: firebaseId, customerId, type: pac.pacote.toUpperCase().trim(), hours: pkgHours });
        localStats.packagesCreated++;
      } catch (error) {
        localStats.errors++;
        addLog({ type: 'error', message: `Erro ao criar pacote "${pac.pacote}": ${error}` });
      }

      if (current % 50 === 0) {
        await sleep(500);
      }
    }

    // Save tracked IDs for rollback (only on real import)
    if (!dryRun && (trackedIds.customerIds.length > 0 || trackedIds.childIds.length > 0 || trackedIds.packageIds.length > 0)) {
      // Merge with existing tracked IDs if any
      const existing = loadImportedIds(currentUnit);
      if (existing) {
        trackedIds.customerIds = [...existing.customerIds, ...trackedIds.customerIds];
        trackedIds.childIds = [...existing.childIds, ...trackedIds.childIds];
        trackedIds.packageIds = [...existing.packageIds, ...trackedIds.packageIds];
      }
      saveImportedIds(currentUnit, trackedIds);
      setCreatedIds(trackedIds);
    }

    setStats(localStats);
    setStep('done');

    if (cancelRef.current) {
      toast.warning('Importação cancelada');
    } else {
      toast.success(dryRun ? 'Simulação concluída!' : 'Importação concluída!');
    }
  };

  // ─── Delete imported data ────────────────────────────────────────────

  const handleDeleteImported = async () => {
    const ids = createdIds || loadImportedIds(currentUnit);
    if (!ids) {
      toast.error('Nenhum dado importado para excluir');
      return;
    }

    const totalToDelete = ids.packageIds.length + ids.childIds.length + ids.customerIds.length;
    if (totalToDelete === 0) {
      toast.info('Nenhum registro para excluir');
      clearImportedIds(currentUnit);
      setCreatedIds(null);
      return;
    }

    setDeleting(true);
    setStep('deleting');
    setLogs([]);

    let deleted = 0;
    let errors = 0;

    addLog({ type: 'info', message: `Excluindo ${totalToDelete} registros importados...` });

    // Delete packages first
    setProgress({ current: 0, total: totalToDelete, label: 'Excluindo pacotes...' });
    for (const pkgId of ids.packageIds) {
      if (cancelRef.current) break;
      try {
        await packagesServiceOffline.deletePackage(pkgId);
        deleted++;
      } catch (e) {
        errors++;
        addLog({ type: 'error', message: `Erro ao excluir pacote ${pkgId}: ${e}` });
      }
      setProgress({ current: deleted + errors, total: totalToDelete, label: `Excluindo pacotes... (${deleted})` });
      if ((deleted + errors) % 50 === 0) await sleep(300);
    }

    // Delete children
    setProgress({ current: deleted + errors, total: totalToDelete, label: 'Excluindo crianças...' });
    for (const childId of ids.childIds) {
      if (cancelRef.current) break;
      try {
        await customersServiceOffline.deleteChild(childId);
        deleted++;
      } catch (e) {
        errors++;
        addLog({ type: 'error', message: `Erro ao excluir criança ${childId}: ${e}` });
      }
      setProgress({ current: deleted + errors, total: totalToDelete, label: `Excluindo crianças... (${deleted})` });
      if ((deleted + errors) % 50 === 0) await sleep(300);
    }

    // Delete customers last
    setProgress({ current: deleted + errors, total: totalToDelete, label: 'Excluindo clientes...' });
    for (const custId of ids.customerIds) {
      if (cancelRef.current) break;
      try {
        await customersServiceOffline.deleteCustomer(custId);
        deleted++;
      } catch (e) {
        errors++;
        addLog({ type: 'error', message: `Erro ao excluir cliente ${custId}: ${e}` });
      }
      setProgress({ current: deleted + errors, total: totalToDelete, label: `Excluindo clientes... (${deleted})` });
      if ((deleted + errors) % 50 === 0) await sleep(300);
    }

    clearImportedIds(currentUnit);
    setCreatedIds(null);
    setDeleting(false);
    setStep('done');
    setStats({ customersCreated: 0, customersSkipped: 0, childrenCreated: 0, childrenSkipped: 0, packagesCreated: 0, packagesSkipped: 0, errors });

    addLog({ type: 'info', message: `Exclusão concluída: ${deleted} excluídos, ${errors} erros` });
    toast.success(`${deleted} registros excluídos com sucesso`);
  };

  // ─── Delete ALL data from Firebase (nuclear option) ─────────────────

  const handleDeleteAll = async () => {
    if (!window.confirm(`⚠️ ATENÇÃO: Isso vai excluir TODOS os clientes, crianças e pacotes da unidade ${currentUnit} do Firebase e cache local. Tem certeza?`)) {
      return;
    }
    if (!window.confirm('🔴 ÚLTIMA CONFIRMAÇÃO: Esta ação é irreversível. Deseja continuar?')) {
      return;
    }

    cancelRef.current = false;
    setDeleting(true);
    setStep('deleting');
    setLogs([]);

    let deleted = 0;
    let errors = 0;

    // 1. Fetch packages for this unit
    addLog({ type: 'info', message: `Buscando pacotes da unidade ${currentUnit}...` });
    let allPkgs: { id: string }[] = [];
    try {
      const pkgs = await packagesServiceOffline.getAllPackages();
      allPkgs = pkgs.filter(p => p.unitId === currentUnit);
      addLog({ type: 'info', message: `${allPkgs.length} pacotes encontrados na unidade` });
    } catch (e) {
      addLog({ type: 'error', message: `Erro ao buscar pacotes: ${e}` });
    }

    // 2. Fetch children for this unit
    addLog({ type: 'info', message: `Buscando crianças da unidade ${currentUnit}...` });
    let allChildren: { id: string }[] = [];
    try {
      allChildren = await customersServiceOffline.getAllChildren(currentUnit);
      addLog({ type: 'info', message: `${allChildren.length} crianças encontradas na unidade` });
    } catch (e) {
      addLog({ type: 'error', message: `Erro ao buscar crianças: ${e}` });
    }

    // 3. Fetch customers for this unit
    addLog({ type: 'info', message: `Buscando clientes da unidade ${currentUnit}...` });
    let allCustomers: { id: string }[] = [];
    try {
      allCustomers = await customersServiceOffline.getAllCustomers(currentUnit);
      addLog({ type: 'info', message: `${allCustomers.length} clientes encontrados na unidade` });
    } catch (e) {
      addLog({ type: 'error', message: `Erro ao buscar clientes: ${e}` });
    }

    const totalToDelete = allPkgs.length + allChildren.length + allCustomers.length;
    if (totalToDelete === 0) {
      toast.info('Nenhum registro encontrado para excluir');
      setDeleting(false);
      setStep('done');
      return;
    }

    addLog({ type: 'info', message: `Excluindo ${totalToDelete} registros...` });

    // Delete packages
    setProgress({ current: 0, total: totalToDelete, label: 'Excluindo pacotes...' });
    for (const pkg of allPkgs) {
      if (cancelRef.current) break;
      try {
        await packagesServiceOffline.deletePackage(pkg.id);
        deleted++;
      } catch (e) {
        errors++;
        addLog({ type: 'error', message: `Erro ao excluir pacote ${pkg.id}: ${e}` });
      }
      setProgress({ current: deleted + errors, total: totalToDelete, label: `Excluindo pacotes... (${deleted})` });
      if ((deleted + errors) % 50 === 0) await sleep(300);
    }

    // Delete children
    setProgress({ current: deleted + errors, total: totalToDelete, label: 'Excluindo crianças...' });
    for (const child of allChildren) {
      if (cancelRef.current) break;
      try {
        await customersServiceOffline.deleteChild(child.id);
        deleted++;
      } catch (e) {
        errors++;
        addLog({ type: 'error', message: `Erro ao excluir criança ${child.id}: ${e}` });
      }
      setProgress({ current: deleted + errors, total: totalToDelete, label: `Excluindo crianças... (${deleted})` });
      if ((deleted + errors) % 50 === 0) await sleep(300);
    }

    // Delete customers
    setProgress({ current: deleted + errors, total: totalToDelete, label: 'Excluindo clientes...' });
    for (const cust of allCustomers) {
      if (cancelRef.current) break;
      try {
        await customersServiceOffline.deleteCustomer(cust.id);
        deleted++;
      } catch (e) {
        errors++;
        addLog({ type: 'error', message: `Erro ao excluir cliente ${cust.id}: ${e}` });
      }
      setProgress({ current: deleted + errors, total: totalToDelete, label: `Excluindo clientes... (${deleted})` });
      if ((deleted + errors) % 50 === 0) await sleep(300);
    }

    clearImportedIds(currentUnit);
    setCreatedIds(null);
    setDeleting(false);
    setStep('done');
    setStats({ customersCreated: 0, customersSkipped: 0, childrenCreated: 0, childrenSkipped: 0, packagesCreated: 0, packagesSkipped: 0, errors });

    addLog({ type: 'info', message: `Exclusão total concluída: ${deleted} excluídos, ${errors} erros` });
    if (cancelRef.current) {
      toast.warning('Exclusão cancelada pelo usuário');
    } else {
      toast.success(`${deleted} registros excluídos com sucesso`);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setResponsaveisFile(null);
    setPacotesFile(null);
    setResponsaveis([]);
    setCriancas([]);
    setPacotes([]);
    setLogs([]);
    setDryRun(true);
    setStats({ customersCreated: 0, customersSkipped: 0, childrenCreated: 0, childrenSkipped: 0, packagesCreated: 0, packagesSkipped: 0, errors: 0 });
    setProgress({ current: 0, total: 0, label: '' });
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">📥 Importar Dados</h1>
        <p className="text-sm text-slate-500">Importação de dados do sistema anterior via planilhas XLSX</p>
      </div>

      {/* Delete options on upload step */}
      {step === 'upload' && (
        <div className="space-y-3">
          {/* Delete tracked imports */}
          {createdIds && (createdIds.customerIds.length > 0 || createdIds.childIds.length > 0 || createdIds.packageIds.length > 0) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-red-700">Dados importados anteriormente</h3>
                <p className="text-xs text-red-600 mt-1">
                  {createdIds.customerIds.length} clientes, {createdIds.childIds.length} crianças, {createdIds.packageIds.length} pacotes
                  {createdIds.importedAt && ` — importados em ${new Date(createdIds.importedAt).toLocaleString('pt-BR')}`}
                </p>
              </div>
              <button
                onClick={handleDeleteImported}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {deleting ? '⏳ Excluindo...' : '🗑️ Excluir dados rastreados'}
              </button>
            </div>
          )}

          {/* Nuclear delete all */}
          <div className="bg-red-50 border border-red-300 rounded-xl p-5 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-red-800">⚠️ Excluir TODOS os dados desta unidade</h3>
              <p className="text-xs text-red-600 mt-1">
                Busca e exclui todos os clientes, crianças e pacotes da unidade <strong>{currentUnit}</strong> do Firebase e cache local. Dados de outras unidades não serão afetados.
              </p>
            </div>
            <button
              onClick={handleDeleteAll}
              disabled={deleting}
              className="px-4 py-2 rounded-lg bg-red-800 hover:bg-red-900 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {deleting ? '⏳ Excluindo...' : '💣 Excluir TODOS os clientes, crianças e pacotes'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">1. Selecione as planilhas</h2>

            {/* Responsáveis + Crianças */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                ListaResponsaveisCriancas.xlsx <span className="text-slate-400">(responsáveis + crianças)</span>
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setResponsaveisFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
              />
              {responsaveisFile && <p className="text-xs text-emerald-600 mt-1">✅ {responsaveisFile.name}</p>}
            </div>

            {/* Pacotes */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                pacotes_de_tempo.xlsx <span className="text-slate-400">(pacotes)</span>
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setPacotesFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
              />
              {pacotesFile && <p className="text-xs text-emerald-600 mt-1">✅ {pacotesFile.name}</p>}
            </div>
          </div>

          <button
            onClick={handleParse}
            disabled={!responsaveisFile && !pacotesFile}
            className="px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Ler Planilhas
          </button>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Stats preview */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium">Responsáveis</p>
              <p className="text-2xl font-bold text-violet-600 mt-1">{responsaveis.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium">Crianças</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{criancas.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium">Pacotes</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{pacotes.length}</p>
              {pacotes.length > 0 && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {pacotes.filter(p => !p.venceu).length} ativos · {pacotes.filter(p => p.venceu).length} vencidos
                </p>
              )}
            </div>
          </div>

          {/* Sample data */}
          {responsaveis.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-600">Amostra — Responsáveis (primeiros 5)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Código</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Nome</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Telefone</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Email</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">CPF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {responsaveis.slice(0, 5).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-600">{r.codResponsavel}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{r.nome}</td>
                        <td className="px-3 py-2 text-slate-600">{r.telefone || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{r.email || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{r.cpf || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pacotes.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-600">Amostra — Pacotes (primeiros 5)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Responsável</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Pacote</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Min Vendidos</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Min Usados</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Venceu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pacotes.slice(0, 5).map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-800">{p.nomeResponsavel}</td>
                        <td className="px-3 py-2 text-slate-600">{p.pacote}</td>
                        <td className="px-3 py-2 text-slate-600">{p.minutosVendidos}</td>
                        <td className="px-3 py-2 text-slate-600">{p.minutosUsados}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.venceu ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {p.venceu ? 'Sim' : 'Não'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dry run toggle + actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Modo de importação</h3>
                <p className="text-xs text-slate-400 mt-0.5">Simulação não grava nada — use para validar antes</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={dryRun}
                    onChange={() => setDryRun(true)}
                    className="w-4 h-4 text-violet-600"
                  />
                  <span className="text-sm font-medium text-slate-600">🔍 Simulação</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={!dryRun}
                    onChange={() => setDryRun(false)}
                    className="w-4 h-4 text-red-600"
                  />
                  <span className="text-sm font-medium text-red-600">🚀 Importação Real</span>
                </label>
              </div>
            </div>

            {!dryRun && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-xs text-red-700 font-medium">
                  ⚠️ ATENÇÃO: A importação real gravará dados no Firebase e no cache local. Esta ação não pode ser desfeita facilmente.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-500">
                Unidade de destino: <span className="font-bold text-violet-600">{currentUnit}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={handleImport}
              className={`px-6 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors ${dryRun ? 'bg-violet-600 hover:bg-violet-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {dryRun ? '🔍 Executar Simulação' : '🚀 Importar Agora'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Deleting */}
      {step === 'deleting' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-red-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-red-700">🗑️ Excluindo dados importados...</h3>
              <button
                onClick={() => { cancelRef.current = true; }}
                className="px-3 py-1.5 rounded-lg bg-red-100 text-red-600 text-xs font-semibold hover:bg-red-200 transition-colors"
              >
                ⛔ Cancelar
              </button>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 mb-2">
              <div
                className="bg-red-500 h-3 rounded-full transition-all duration-300"
                style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{progress.label}</span>
              <span>{progress.current}/{progress.total}</span>
            </div>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700">
                {dryRun ? '🔍 Simulação em andamento...' : '🚀 Importação em andamento...'}
              </h3>
              <button
                onClick={() => { cancelRef.current = true; }}
                className="px-3 py-1.5 rounded-lg bg-red-100 text-red-600 text-xs font-semibold hover:bg-red-200 transition-colors"
              >
                ⛔ Cancelar
              </button>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-3 mb-2">
              <div
                className="bg-violet-500 h-3 rounded-full transition-all duration-300"
                style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{progress.label}</span>
              <span>{progress.current}/{progress.total}</span>
            </div>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <div className="space-y-4">
          {/* Results */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-emerald-200 p-4">
              <p className="text-xs text-slate-500 font-medium">Clientes Criados</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.customersCreated}</p>
              {stats.customersSkipped > 0 && <p className="text-[10px] text-amber-500 mt-0.5">{stats.customersSkipped} duplicatas ignoradas</p>}
            </div>
            <div className="bg-white rounded-xl border border-blue-200 p-4">
              <p className="text-xs text-slate-500 font-medium">Crianças Criadas</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.childrenCreated}</p>
              {stats.childrenSkipped > 0 && <p className="text-[10px] text-amber-500 mt-0.5">{stats.childrenSkipped} duplicatas ignoradas</p>}
            </div>
            <div className="bg-white rounded-xl border border-violet-200 p-4">
              <p className="text-xs text-slate-500 font-medium">Pacotes Criados</p>
              <p className="text-2xl font-bold text-violet-600 mt-1">{stats.packagesCreated}</p>
              {stats.packagesSkipped > 0 && <p className="text-[10px] text-amber-500 mt-0.5">{stats.packagesSkipped} duplicatas/sem responsável</p>}
            </div>
          </div>

          {stats.errors > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-bold text-red-700">{stats.errors} erro(s) durante a importação</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
            >
              Nova Importação
            </button>
          </div>

          {/* Delete imported data */}
          {createdIds && (createdIds.customerIds.length > 0 || createdIds.childIds.length > 0 || createdIds.packageIds.length > 0) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-red-700">Excluir dados importados</h3>
                <p className="text-xs text-red-600 mt-1">
                  {createdIds.customerIds.length} clientes, {createdIds.childIds.length} crianças, {createdIds.packageIds.length} pacotes
                  {createdIds.importedAt && ` — importados em ${new Date(createdIds.importedAt).toLocaleString('pt-BR')}`}
                </p>
              </div>
              <button
                onClick={handleDeleteImported}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {deleting ? '⏳ Excluindo...' : '🗑️ Excluir tudo que foi importado'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-600">Log de Importação ({logs.length})</h3>
            <span className="text-[10px] text-slate-400">
              {logs.filter(l => l.type === 'error').length} erros · {logs.filter(l => l.type === 'warning').length} avisos
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto p-3 space-y-1 font-mono text-[11px]">
            {logs.map((log, i) => (
              <div
                key={i}
                className={`px-2 py-1 rounded ${
                  log.type === 'error' ? 'bg-red-50 text-red-700' :
                  log.type === 'warning' ? 'bg-amber-50 text-amber-700' :
                  log.type === 'success' ? 'bg-emerald-50 text-emerald-700' :
                  'bg-slate-50 text-slate-600'
                }`}
              >
                {log.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportData;
