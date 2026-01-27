# Sistema Offline - Flex Kids Manager

## Visão Geral

O sistema agora possui suporte completo para funcionamento offline. Todos os dados são armazenados localmente usando IndexedDB e sincronizados automaticamente com o Firebase quando a conexão é restaurada.

## Funcionalidades

### 1. Armazenamento Local (IndexedDB)
- **Localização**: `src/shared/database/localDb.ts`
- Armazena todos os dados localmente: visitas, clientes, pagamentos, pacotes e configurações
- Mantém uma fila de sincronização para operações pendentes
- Suporta operações CRUD completas offline

### 2. Serviço de Sincronização
- **Localização**: `src/shared/database/syncService.ts`
- Detecta automaticamente mudanças no status da conexão
- Sincroniza dados pendentes quando a conexão é restaurada
- Sincronização periódica a cada 30 segundos quando online
- Gerencia conflitos entre dados locais e remotos

### 3. Serviços Offline
Os seguintes serviços foram criados com suporte offline:

- **Visitas**: `src/shared/firebase/services/visits.service.offline.ts`
  - Check-in offline
  - Check-out offline
  - Consulta de visitas ativas
  - Histórico de visitas

- **Pacotes**: `src/shared/firebase/services/packages.service.offline.ts`
  - Criação de pacotes offline
  - Atualização de pacotes
  - Consulta de pacotes ativos

- **Pagamentos**: `src/shared/firebase/services/payments.service.offline.ts`
  - Registro de pagamentos offline
  - Consulta de pagamentos do dia
  - Histórico de pagamentos

### 4. Interface do Usuário

#### Indicador de Status
- **Componente**: `src/renderer/src/components/OnlineStatusBadge.tsx`
- Mostra status atual: Online, Offline ou Sincronizando
- Posicionado no canto superior direito
- Cores:
  - Verde: Online
  - Laranja: Offline
  - Azul (pulsando): Sincronizando

#### Hook de Status
- **Hook**: `src/renderer/src/hooks/useOnlineStatus.ts`
- Retorna `isOnline` e `isSyncing`
- Pode ser usado em qualquer componente para reagir a mudanças de conexão

## Como Usar

### 1. Inicialização
O sistema é inicializado automaticamente no `App.tsx`:

```typescript
useEffect(() => {
  syncService.init().catch(console.error);
}, []);
```

### 2. Usando Serviços Offline
Substitua os serviços normais pelos serviços offline:

```typescript
// Antes
import { visitsService } from '../../../shared/firebase/services/visits.service';

// Depois
import { visitsServiceOffline } from '../../../shared/firebase/services/visits.service.offline';

// Uso (mesma API)
const visits = await visitsServiceOffline.getActiveVisits(unitId);
```

### 3. Verificando Status de Conexão
Use o hook `useOnlineStatus` em seus componentes:

```typescript
import { useOnlineStatus } from '../hooks/useOnlineStatus';

function MyComponent() {
  const { isOnline, isSyncing } = useOnlineStatus();
  
  return (
    <div>
      {!isOnline && <p>Você está offline. Dados serão sincronizados quando voltar online.</p>}
      {isSyncing && <p>Sincronizando dados...</p>}
    </div>
  );
}
```

## Fluxo de Dados

### Modo Online
1. Operação é executada no Firebase
2. Dados são salvos localmente como cache
3. Resposta é retornada imediatamente

### Modo Offline
1. Operação é salva localmente no IndexedDB
2. Operação é adicionada à fila de sincronização
3. Resposta é retornada com ID local temporário
4. Quando conexão retorna, dados são sincronizados automaticamente

### Sincronização
1. Sistema detecta retorno da conexão
2. Busca todas as operações pendentes na fila
3. Executa operações no Firebase em ordem
4. Atualiza IDs locais com IDs do Firebase
5. Marca operações como sincronizadas
6. Remove da fila de sincronização

## Estrutura do Banco Local

### Collections
- **visits**: Visitas de clientes
- **customers**: Clientes cadastrados
- **payments**: Pagamentos realizados
- **packages**: Pacotes de horas
- **settings**: Configurações do sistema
- **syncQueue**: Fila de operações pendentes

### Índices
- `by-sync`: Para filtrar itens não sincronizados
- `by-unit`: Para filtrar por unidade
- `by-customer`: Para filtrar por cliente
- `by-date`: Para filtrar por data

## Tratamento de Erros

O sistema trata automaticamente os seguintes cenários:

1. **Perda de conexão durante operação**: Salva localmente e adiciona à fila
2. **Falha na sincronização**: Mantém na fila e tenta novamente
3. **Conflitos de dados**: Prioriza dados mais recentes (updatedAt)
4. **IDs temporários**: Substitui por IDs do Firebase após sincronização

## Limitações

1. **Conflitos**: Sistema usa "last write wins" - última atualização prevalece
2. **Armazenamento**: Limitado pela quota do IndexedDB do navegador (~50MB)
3. **Sincronização**: Requer conexão estável para completar
4. **IDs temporários**: Começam com `local_` até sincronização

## Manutenção

### Limpar Dados Locais
```typescript
import { syncService } from '../../../shared/database/syncService';

// Limpar fila de sincronização
await syncService.clearLocalData();
```

### Forçar Sincronização
```typescript
import { syncService } from '../../../shared/database/syncService';

// Sincronizar manualmente
await syncService.syncAll();
```

## Próximos Passos

Para adicionar suporte offline a novos serviços:

1. Criar arquivo `[service].service.offline.ts`
2. Implementar mesma interface do serviço original
3. Usar `syncService.saveLocally()` para operações de escrita
4. Usar `syncService.getFromLocal()` para leitura offline
5. Tentar Firebase primeiro quando online, fallback para local
6. Adicionar collection no `localDb.ts` se necessário

## Dependências

- **idb**: ^8.0.0 - Wrapper para IndexedDB com Promises
- **firebase**: ^10.7.2 - Backend em nuvem
- **react**: ^18.2.0 - Framework UI

## Suporte

Para problemas ou dúvidas sobre o sistema offline, verifique:
1. Console do navegador para erros de sincronização
2. DevTools > Application > IndexedDB para inspecionar dados locais
3. Componente OnlineStatusBadge para status atual
