# 🔥 Guia de Configuração do Firebase

Este guia detalha como configurar o Firebase para o Flex-Kids Manager.

## 📋 Pré-requisitos

- Conta Google
- Acesso ao [Firebase Console](https://console.firebase.google.com/)

## 🚀 Passo a Passo

### 1. Criar Projeto no Firebase

1. Acesse https://console.firebase.google.com/
2. Clique em "Adicionar projeto"
3. Digite o nome: `flex-kids-manager`
4. Desabilite Google Analytics (opcional)
5. Clique em "Criar projeto"

### 2. Configurar Firestore Database

1. No menu lateral, clique em "Firestore Database"
2. Clique em "Criar banco de dados"
3. Selecione "Iniciar no modo de produção"
4. Escolha a localização: `southamerica-east1` (São Paulo)
5. Clique em "Ativar"

### 3. Configurar Regras de Segurança

No Firestore, vá em "Regras" e adicione:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir leitura e escrita para usuários autenticados
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Para desenvolvimento, você pode usar (TEMPORÁRIO):
    // match /{document=**} {
    //   allow read, write: if true;
    // }
  }
}
```

### 4. Obter Credenciais

1. Clique no ícone de engrenagem → "Configurações do projeto"
2. Role até "Seus aplicativos"
3. Clique no ícone `</>`  (Web)
4. Digite um apelido: `flex-kids-web`
5. NÃO marque "Firebase Hosting"
6. Clique em "Registrar app"
7. Copie as credenciais fornecidas

### 5. Configurar no Projeto

Edite o arquivo `src/shared/firebase/config.ts`:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSy...",              // Sua API Key
  authDomain: "flex-kids-xxx.firebaseapp.com",
  projectId: "flex-kids-xxx",
  storageBucket: "flex-kids-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 6. Criar Índices (Opcional)

Para melhor performance, crie índices compostos:

1. Vá em "Firestore Database" → "Índices"
2. Clique em "Adicionar índice"

**Índice para Visitas:**
- Coleção: `visits`
- Campos:
  - `unitId` (Crescente)
  - `checkOut` (Crescente)
  - `checkIn` (Decrescente)

**Índice para Pagamentos:**
- Coleção: `payments`
- Campos:
  - `customerId` (Crescente)
  - `createdAt` (Decrescente)

## 🔐 Configurar Autenticação (Opcional)

### Ativar Email/Senha

1. No menu lateral, clique em "Authentication"
2. Clique em "Começar"
3. Selecione "Email/senha"
4. Ative a opção
5. Clique em "Salvar"

### Criar Primeiro Usuário

```javascript
// No console do navegador ou em um script
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
createUserWithEmailAndPassword(auth, 'admin@flexkids.com', 'senha123')
  .then((userCredential) => {
    console.log('Usuário criado:', userCredential.user);
  });
```

## 📊 Estrutura de Dados

### Coleção: customers

```json
{
  "id": "auto-generated",
  "name": "João Silva",
  "phone": "(11) 98765-4321",
  "email": "joao@email.com",
  "cpf": "123.456.789-00",
  "address": "Rua ABC, 123",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### Coleção: children

```json
{
  "id": "auto-generated",
  "name": "Maria Silva",
  "age": 8,
  "customerId": "customer-id",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### Coleção: visits

```json
{
  "id": "auto-generated",
  "childId": "child-id",
  "unitId": "unit-1",
  "checkIn": "Timestamp",
  "checkOut": "Timestamp | null",
  "duration": 120,
  "value": 60.00,
  "paid": false,
  "paymentId": "payment-id | null",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### Coleção: payments

```json
{
  "id": "auto-generated",
  "customerId": "customer-id",
  "amount": 60.00,
  "method": "pix",
  "status": "paid",
  "description": "Pagamento visita 01/01/2024",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### Coleção: packages

```json
{
  "id": "auto-generated",
  "customerId": "customer-id",
  "type": "hours",
  "hours": 10,
  "usedHours": 2.5,
  "price": 250.00,
  "expiresAt": "Timestamp | null",
  "active": true,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### Coleção: settings

```json
{
  "id": "hourlyRate",
  "key": "hourlyRate",
  "value": "30.00",
  "updatedAt": "Timestamp"
}
```

## 🧪 Testar Conexão

Execute o projeto em modo desenvolvimento:

```bash
npm run dev
```

Abra o console do navegador (F12) e verifique se não há erros de conexão com o Firebase.

## 🔧 Troubleshooting

### Erro: "Missing or insufficient permissions"
- Verifique as regras de segurança do Firestore
- Para desenvolvimento, use `allow read, write: if true;`

### Erro: "Firebase: Error (auth/invalid-api-key)"
- Verifique se a API Key está correta
- Confirme que o projeto está ativo no Firebase Console

### Erro: "Network request failed"
- Verifique sua conexão com a internet
- Confirme que o Firestore está ativado

### Dados não aparecem
- Verifique se há dados no Firestore Console
- Confirme que as coleções estão criadas
- Verifique o console do navegador para erros

## 📱 Dados Iniciais (Seed)

Para popular o banco com dados de teste, você pode usar o Firestore Console ou criar um script:

```typescript
// seed.ts
import { customersService, settingsService } from './src/shared/firebase/services';

async function seed() {
  // Configurações
  await settingsService.setHourlyRate(30);
  await settingsService.setMinimumTime(30);
  await settingsService.setPixKey('sua-chave-pix');

  // Cliente de exemplo
  const customer = await customersService.createCustomer({
    name: 'João Silva',
    phone: '(11) 98765-4321',
    email: 'joao@email.com',
  });

  // Filho de exemplo
  await customersService.addChild(customer.id, {
    name: 'Maria Silva',
    age: 8,
  });

  console.log('Dados iniciais criados!');
}

seed();
```

## 🔒 Segurança em Produção

Antes de ir para produção:

1. **Ative autenticação** obrigatória
2. **Configure regras de segurança** adequadas
3. **Limite acesso por IP** (se possível)
4. **Ative App Check** para proteção contra bots
5. **Configure backup automático**

## 📚 Recursos Adicionais

- [Documentação Firebase](https://firebase.google.com/docs)
- [Firestore Guia](https://firebase.google.com/docs/firestore)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Regras de Segurança](https://firebase.google.com/docs/firestore/security/get-started)

---

**Pronto!** Seu Firebase está configurado e pronto para uso com o Flex-Kids Manager.
