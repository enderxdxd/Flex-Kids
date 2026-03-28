# 🔍 AUDITORIA COMPLETA — Flex-Kids Manager v4.2.0
**Data:** 26/03/2026 | **Auditor:** Tech Lead Review  
**Escopo:** Todos os arquivos de src/shared, src/renderer, src/main

---

## 📊 RESUMO EXECUTIVO

| Categoria | Crítico | Alto | Médio | Baixo |
|-----------|---------|------|-------|-------|
| Bugs | 3 | 5 | 4 | 2 |
| Segurança | 2 | 1 | 0 | 0 |
| Arquitetura | 0 | 3 | 2 | 1 |
| **Total** | **5** | **9** | **6** | **3** |

---

## 🔴 BUGS CRÍTICOS (Impacto direto no usuário)

### BUG-C1: `localDb.upsert()` sempre seta `synced: false` — sobrescreve dados sincronizados
**Arquivo:** `src/shared/database/localDb.ts:177-181`
```ts
async upsert(store, data) {
  const id = data.id || this.generateId();
  await db.put(store, { ...data, id, synced: false }); // ← SEMPRE false!
}
```
**Problema:** Quando `saveToCacheOnly()` chama `upsert()`, o item é salvo com `synced: false` apesar de já ter sido sincronizado com Firebase. Isso causa:
1. O item entra na sync queue como "pending" indevidamente
2. O próximo `syncAll()` tenta re-sincronizar um item que já está no Firebase
3. Potencial duplicação ou conflitos

**Nota:** `bulkUpsert()` foi corrigido para preservar o `synced` do caller, mas `upsert()` não. O `saveToCacheOnly()` em `syncService.ts:510` chama `localDb.upsert()` e passa `synced: true`, mas o `upsert()` ignora e seta `false`.

**Fix:** `upsert()` deve respeitar o `synced` passado pelo caller, igual ao `bulkUpsert()`.

---

### BUG-C2: `kidsPlans.service.offline.ts` usa `addDoc` e `updateDoc` direto em vez de `addDocSafe`/`updateDocSafe`
**Arquivo:** `src/shared/firebase/services/kidsPlans.service.offline.ts:44,88`
```ts
const docRef = await addDoc(collection(db, COLLECTION), firestoreData);  // ← sem timeout!
await updateDoc(ref, firestoreData);  // ← sem timeout!
```
**Problema:** Todos os outros services usam `addDocSafe`/`updateDocSafe` que têm timeout de 10s e tracking de conectividade. O kidsPlans usa os métodos raw do Firebase que:
1. **Nunca dão timeout** — podem travar infinitamente se Firebase estiver lento
2. **Não marcam `markFirebaseFailure()`** — o sistema não detecta que Firebase caiu
3. **Não marcam `markFirebaseSuccess()`** — a transição offline→online não é detectada

**Fix:** Substituir `addDoc` por `addDocSafe` e `updateDoc` por `updateDocSafe`.

---

### BUG-C3: `fiscalNotes.service.ts` usa `addDoc`/`getDocs` raw sem timeout/retry
**Arquivo:** `src/shared/firebase/services/fiscalNotes.service.ts`
**Problema:** Igual ao BUG-C2. Service inteiro usa Firebase raw sem Safe wrappers.

---

## 🟠 BUGS DE ALTA PRIORIDADE

### BUG-H1: Prefetch marca `_prefetchDone = true` mesmo quando Firebase estava offline
**Arquivo:** `src/shared/firebase/services/prefetchService.ts:29-33`
```ts
if (!syncService.isOnline()) {
  console.log('[PREFETCH] Offline, skipping prefetch');
  _prefetchDone = true;  // ← nunca mais faz prefetch, mesmo quando voltar online
  return;
}
```
**Problema:** Se o app abrir offline, o prefetch é marcado como "feito" para sempre. Quando o Firebase eventualmente conectar (via `probeFirebaseConnection`), o cache nunca é populado até o usuário manualmente trocar de unidade ou reiniciar o app.

**Fix:** Não marcar `_prefetchDone` quando offline. Ou melhor: ouvir o evento de transição offline→online e resetar o prefetch.

---

### BUG-H2: `getVisitsByCustomer` busca por `childId` em vez de `customerId`
**Arquivo:** `src/shared/firebase/services/visits.service.offline.ts:334-336`
```ts
const q = query(
  collection(db, COLLECTION),
  where('childId', '==', customerId),  // ← ERRADO! Compara childId com customerId
  orderBy('checkIn', 'desc')
);
```
**Problema:** O parâmetro é `customerId` mas a query filtra por `childId == customerId`. Isso nunca retorna resultados corretos porque `childId` e `customerId` são IDs diferentes. O fallback local funciona por sorte (filtra por `visit.childId === customerId`, que também está errado, mas ambos estão errados da mesma forma).

**Fix:** A query deveria juntar children do customer e buscar visits por childIds, ou o campo correto na collection visits.

---

### BUG-H3: `CheckInOut.tsx` não escuta o evento `visits-updated`
**Arquivo:** `src/renderer/src/pages/CheckInOut.tsx`
**Problema:** O `getActiveVisits` dispara `visits-updated` quando o background fetch do Firebase completa, mas `CheckInOut.tsx` não tem event listener para esse evento. O Dashboard tem (via modais), mas a page principal de CheckIn/Out não atualiza automaticamente quando o Firebase retorna dados frescos.

**Fix:** Adicionar `window.addEventListener('visits-updated', ...)` no useEffect, igual foi feito no Packages.tsx.

---

### BUG-H4: `payments.service.offline.ts` background fetch error não filtra connectivity errors
**Arquivo:** `src/shared/firebase/services/payments.service.offline.ts:109`
```ts
.catch(err => console.error('Background fetch failed:', err));
```
**Problema:** Ao contrário dos outros services que usam `if (!isFirebaseConnectivityError(err))`, o payments service loga TODOS os erros como `console.error`, incluindo timeouts e "client is offline". Isso polui o console e dá impressão de que algo está quebrado quando é apenas timeout normal.

**Fix:** Adicionar filtro `isFirebaseConnectivityError` nos catch handlers de background fetch.

---

### BUG-H5: `settings.service.offline.ts` usa `setDoc` raw sem timeout em `setSetting()`
**Arquivo:** `src/shared/firebase/services/settings.service.offline.ts:97-107`
```ts
const firebasePromise = setDoc(settingRef, { ... }, { merge: true });
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Firebase save timeout')), 5000)
);
await Promise.race([firebasePromise, timeoutPromise]);
```
**Problema:** Implementa timeout manual (5s) em vez de usar `setDocSafe` (10s). Além disso:
1. Não chama `markFirebaseSuccess()` / `markFirebaseFailure()`
2. Se o timeout dispara, a promise do `setDoc` continua rodando em background sem cleanup
3. O `firebaseSave()` é fire-and-forget — erros nunca são propagados

**Fix:** Usar `setDocSafe` que já tem timeout, retry tracking e connectivity marking.

---

## 🟡 BUGS DE MÉDIA PRIORIDADE

### BUG-M1: `waitForFirestoreConnection` pode resolver imediatamente sem conexão real
**Arquivo:** `src/shared/firebase/config.ts:128-131`
**Problema:** `onSnapshotsInSync` pode disparar imediatamente se o Firestore SDK considera que está "in sync" porque não há snapshots pendentes (cache está vazio). Isso significaria que o warm-up resolve sem conexão real ao backend.

**Mitigação:** O probe read (`__health__` collection) ajuda a forçar uma operação real, mas se a collection não existe, a resposta pode vir do cache (vazio = snapshot vazio = in sync).

---

### BUG-M2: `onSnapshotsInSync` listener não é limpo se o timeout disparar primeiro
**Arquivo:** `src/shared/firebase/config.ts:118-144`
```ts
const timer = setTimeout(() => {
  if (!resolved) {
    resolved = true;
    reject(new Error(...));  // ← NÃO chama unsubscribe()
  }
}, timeoutMs);
```
**Problema:** Se o timeout dispara antes de `onSnapshotsInSync`, o listener continua ativo indefinidamente. Isso é um memory leak — o callback continuará sendo chamado a cada sync, executando código dentro de um contexto que já foi rejeitado.

**Fix:** Chamar `unsubscribe()` no ramo do timeout também.

---

### BUG-M3: `CheckInOut.tsx` polling a cada 30s recarrega tudo, incluindo Firebase background fetches
**Arquivo:** `src/renderer/src/pages/CheckInOut.tsx:23-24`
```ts
const interval = setInterval(loadData, 30000);
```
**Problema:** A cada 30s, `loadData` chama `getActiveVisits + getAllChildren + getSettings`, que disparam background Firebase fetches. Isso significa 3+ Firebase queries a cada 30s por page. Se o Dashboard também está em background com seu próprio polling, são 7+ queries a cada 30s.

**Impacto:** Firebase billing (reads), bandwidth, e pressão no WebSocket connection.

---

### BUG-M4: `getAllVisits()` e `getAllPayments()` não seguem padrão cache-first
**Arquivo:** `visits.service.offline.ts:361-393` e `payments.service.offline.ts:326-368`
```ts
async getAllVisits(unitId?) {
  if (syncService.isOnline()) {
    try {
      // Tenta Firebase PRIMEIRO, sem ler cache
      ...
    } catch { ... }
  }
  // Só lê cache se Firebase falhar
  const all = await syncService.getAllFromLocal(COLLECTION);
  return all;
}
```
**Problema:** Ao contrário de `getActiveVisits`, `getTodayPayments`, etc. que seguem o padrão cache-first (lê cache → retorna imediatamente → atualiza em background), `getAllVisits` e `getAllPayments` tentam Firebase primeiro e só caem para cache se Firebase falhar. Isso causa:
1. Latência alta para o usuário (espera Firebase responder)
2. Se Firebase está lento (não offline, mas lento), o usuário espera 20s de timeout

---

## 🔵 BUGS DE BAIXA PRIORIDADE

### BUG-L1: `localDb.update()` seta `synced: false` mesmo para updates cache-only
**Arquivo:** `src/shared/database/localDb.ts:169-175`
Igual ao BUG-C1 mas para `update()`. Menos impacto porque `update()` é menos usado.

### BUG-L2: `migrateGhostSyncItems` roda em TODA operação de read da sync queue
**Arquivo:** `src/shared/database/localDb.ts:259-264`
Chamado em `getPendingSyncItems`, `getPendingSyncCount`, e `cleanupSyncedItems`. Deveria rodar apenas uma vez no init.

---

## 🔴 VULNERABILIDADES DE SEGURANÇA

### SEC-C1: Senhas hardcoded no código-fonte
**Arquivo:** `src/renderer/src/contexts/AuthContext.tsx:16-24`
```ts
const UNIT_PASSWORDS: Record<string, string> = {
  alphaville: 'alpha2024',
  marista: 'marista2024',
  palmas: 'palmas2024',
  buenavista: 'buena2024',
};
const ADMIN_PASSWORD = 'pactoflex123';
```
**Problema:** As senhas estão no código-fonte, visíveis para qualquer pessoa que tenha acesso ao repositório ou ao bundle JavaScript da aplicação. No Electron, o código do renderer é empacotado como `asar` que é trivial de extrair.

**Risco:** Qualquer funcionário com acesso ao computador pode extrair a senha admin e acessar qualquer unidade.

**Fix:** Autenticação via Firebase Auth (email/password ou custom tokens).

---

### SEC-C2: Firebase config hardcoded em `firebase.env.ts`
**Arquivo:** `src/shared/firebase/firebase.env.ts`
**Problema:** API keys do Firebase estão no código-fonte. Embora API keys do Firebase sejam semi-públicas por design (restringidas por Firebase Security Rules), ter `databaseURL` e todas as credenciais expostas amplia a superfície de ataque.

**Mitigação:** Garantir que Firestore Security Rules estejam restritivas. Considerar App Check.

---

### SEC-H1: Nenhuma validação server-side (Firebase Security Rules)
**Problema:** Todo o controle de acesso é feito client-side. Se alguém obter as credenciais Firebase, pode ler/escrever qualquer coleção de qualquer unidade. Não há evidência de Firestore Security Rules restritivas.

**Fix:** Implementar Security Rules que validem unitId, restrinjam writes, etc.

---

## ⚙️ PROBLEMAS DE ARQUITETURA

### ARCH-H1: Inconsistência no padrão offline-first entre services
**Problema:** Cada service implementa o padrão cache-first de forma diferente:
- `getAllCustomers` → cache-first, background fetch ✅
- `getAllVisits` → Firebase-first, cache fallback ❌
- `getAllPayments` → Firebase-first, cache fallback ❌
- `getActiveVisits` → cache-first, background fetch ✅
- `getTodayPayments` → cache-first, background fetch ✅
- `getMonthPayments` → cache-first, background fetch ✅
- `getVisitsByCustomer` → Firebase-first, cache fallback ❌
- `getPaymentsByCustomer` → Firebase-first, cache fallback ❌
- `getPackagesByCustomer` → Firebase-first, cache fallback ❌

**Impacto:** Services com padrão Firebase-first são lentos quando Firebase está lento, e dão a impressão de que o app "travou".

**Fix:** Padronizar TODOS os métodos de leitura como cache-first com background fetch.

---

### ARCH-H2: Sem mecanismo de invalidação de cache
**Problema:** Dados no IndexedDB nunca expiram. Se um registro é deletado no Firebase por outro dispositivo, o cache local continua mostrando o registro indefinidamente. O `bulkSaveToCacheOnly` faz upsert — adiciona/atualiza, mas **nunca remove** itens que foram deletados no Firebase.

**Cenário:** Usuário A deleta um customer no dispositivo 1. Dispositivo 2 ainda mostra o customer porque o cache local nunca é limpo. Mesmo o background fetch não resolve porque `fetchCustomersFromFirebase` faz `bulkSaveToCacheOnly` com os dados do Firebase (que não incluem o deletado), mas não remove o item local.

**Fix:** O background fetch deveria comparar o que veio do Firebase com o que está no cache local e remover itens que não existem mais no Firebase. Ou implementar soft-delete + purge.

---

### ARCH-H3: Custom events (`visits-updated`, `packages-updated`, `payments-updated`) sem tipagem
**Problema:** Os events são genéricos (`CustomEvent`) com `detail` sem tipagem. Cada page implementa seu próprio handler sem garantia de que o `detail` tem a estrutura esperada. Se o service mudar a estrutura do detail, nenhum erro de compilação é gerado.

---

### ARCH-M1: Ausência de transações atômicas em operações compostas
**Problema:** Operações como "criar pagamento + atualizar pacote" ou "check-out + criar pagamento" são feitas em chamadas separadas. Se uma falha e a outra não:
- Pagamento criado mas pacote não atualizado
- Visit marcada como checkout mas pagamento não criado

**Mitigação:** O offline-first pattern ajuda (items ficam na sync queue), mas o problema persiste quando online.

---

### ARCH-M2: `localStorage` para autenticação — sem encriptação
**Arquivo:** `AuthContext.tsx`
**Problema:** O token de autenticação (unitId + timestamp) é salvo em `localStorage` como JSON plano. Qualquer extensão do Electron ou código JavaScript pode ler.

---

### ARCH-L1: `type: any` excessivo em `localDb.ts` e sync queue
**Problema:** Quase tudo é `any` — sem tipagem nos stores do IndexedDB, no sync queue, nos dados dos services. Isso permite bugs silenciosos que só aparecem em runtime.

---

## 📋 MELHORIAS RECOMENDADAS (por prioridade)

### P1 — Fixes imediatos (próximo release)
1. **Fix BUG-C1:** `localDb.upsert()` respeitar `synced` do caller
2. **Fix BUG-C2/C3:** `kidsPlans` e `fiscalNotes` usar Safe wrappers
3. **Fix BUG-H1:** Prefetch não marcar done quando offline
4. **Fix BUG-H2:** `getVisitsByCustomer` query correta
5. **Fix BUG-H3:** `CheckInOut.tsx` escutar `visits-updated`
6. **Fix BUG-M2:** Limpar `onSnapshotsInSync` listener no timeout

### P2 — Próximo sprint
7. **Fix ARCH-H1:** Padronizar todos os reads como cache-first
8. **Fix BUG-H4/H5:** Usar Safe wrappers consistentemente
9. **Fix ARCH-H2:** Implementar invalidação de cache (diff local vs Firebase)

### P3 — Backlog
10. **Fix SEC-C1:** Firebase Auth para autenticação
11. **Fix SEC-H1:** Firestore Security Rules
12. **Fix ARCH-H3:** Tipagem para custom events
13. **Fix ARCH-M1:** Batch writes para operações compostas
