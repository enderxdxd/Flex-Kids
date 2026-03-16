import { customersServiceOffline } from './customers.service.offline';
import { visitsServiceOffline } from './visits.service.offline';
import { paymentsServiceOffline } from './payments.service.offline';
import { packagesServiceOffline } from './packages.service.offline';
import { kidsPlansServiceOffline } from './kidsPlans.service.offline';
import { settingsServiceOffline } from './settings.service.offline';
import { syncService } from '../../database/syncService';

let _prefetchDone = false;
let _prefetchPromise: Promise<void> | null = null;

/**
 * Popula o cache local com dados do Firebase na inicialização.
 * Deve ser chamado uma vez após o login/unit ser definido.
 * Se já foi feito, retorna imediatamente.
 */
export async function prefetchAllData(unitId: string): Promise<void> {
  // Se já fez prefetch, não repete
  if (_prefetchDone) return;

  // Se já está rodando, aguarda a promise existente
  if (_prefetchPromise) return _prefetchPromise;

  _prefetchPromise = _doPrefetch(unitId);
  return _prefetchPromise;
}

async function _doPrefetch(unitId: string): Promise<void> {
  if (!syncService.isOnline()) {
    console.log('[PREFETCH] Offline, skipping prefetch');
    _prefetchDone = true;
    return;
  }

  console.log(`[PREFETCH] Starting prefetch for unit: ${unitId}`);
  const start = Date.now();

  try {
    // Busca tudo em paralelo — os services offline já salvam no cache automaticamente
    await Promise.allSettled([
      customersServiceOffline.getAllCustomers(unitId),
      customersServiceOffline.getAllChildren(unitId),
      visitsServiceOffline.getActiveVisits(unitId),
      paymentsServiceOffline.getTodayPayments(unitId),
      packagesServiceOffline.getActivePackages(undefined, unitId),
      kidsPlansServiceOffline.getAllPlans(unitId),
      settingsServiceOffline.getSettings(unitId),
    ]);

    _prefetchDone = true;
    console.log(`[PREFETCH] Done in ${Date.now() - start}ms`);
  } catch (error) {
    console.error('[PREFETCH] Error:', error);
    // Marca como done mesmo com erro para não bloquear o app
    _prefetchDone = true;
  } finally {
    _prefetchPromise = null;
  }
}

/**
 * Reseta o prefetch (útil ao trocar de unidade ou limpar cache)
 */
export function resetPrefetch(): void {
  _prefetchDone = false;
  _prefetchPromise = null;
}
