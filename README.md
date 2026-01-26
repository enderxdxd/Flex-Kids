# Flex-Kids Manager

Sistema de gerenciamento completo para Flex-Kids Playground, desenvolvido com Electron, React e Firebase.

## 🚀 Tecnologias

### Frontend
- **React 18** - Interface de usuário
- **TypeScript** - Tipagem estática
- **TailwindCSS** - Estilização
- **React Router** - Navegação
- **React Hook Form** - Formulários
- **date-fns** - Manipulação de datas
- **React Toastify** - Notificações

### Backend
- **Electron 28** - Framework desktop
- **Node.js** - Runtime
- **Firebase** - Banco de dados em tempo real
- **Prisma ORM** - ORM (opcional para SQLite local)

### Build Tools
- **Vite** - Bundler e dev server
- **Electron Builder** - Geração de instaladores
- **ESBuild** - Compilação rápida

## 📦 Instalação

### Pré-requisitos
- Node.js 18+ 
- npm ou yarn

### Passos

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/Flex-Kids.git
cd Flex-Kids

# Instale as dependências
npm install

# Configure o Firebase
# Edite src/shared/firebase/config.ts com suas credenciais

# (Opcional) Configure o Prisma para banco local
npm run prisma:generate
npm run prisma:migrate
```

## 🔧 Configuração do Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
2. Ative o Firestore Database
3. Copie as credenciais do projeto
4. Edite `src/shared/firebase/config.ts`:

```typescript
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

## 🎯 Desenvolvimento

```bash
# Modo desenvolvimento (hot reload)
npm run dev

# Build do projeto
npm run build

# Gerar instalador
npm run dist

# Gerar instalador para Windows
npm run dist:win

# Gerar instalador para macOS
npm run dist:mac

# Gerar instalador para Linux
npm run dist:linux
```

## 📁 Estrutura do Projeto

```
flex-kids-manager/
├── src/
│   ├── main/                   # Electron Main Process
│   │   ├── index.ts           # Entry point
│   │   └── preload.ts         # IPC Bridge
│   │
│   ├── renderer/              # React Frontend
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx       # React entry
│   │       ├── App.tsx        # App principal
│   │       ├── pages/         # Páginas
│   │       ├── components/    # Componentes
│   │       └── contexts/      # Context API
│   │
│   └── shared/                # Código compartilhado
│       ├── types/             # TypeScript types
│       └── firebase/          # Firebase config e services
│
├── prisma/                    # Prisma schema (opcional)
├── dist/                      # Build output
└── release/                   # Instaladores
```

## 🎨 Funcionalidades

### ✅ Implementadas
- Dashboard com estatísticas em tempo real
- Check-In/Check-Out de crianças
- Gerenciamento de clientes e filhos
- Sistema de pacotes de horas
- Histórico de pagamentos
- Configurações do sistema
- Suporte a múltiplas unidades

### 🔄 Em Desenvolvimento
- Geração de relatórios em PDF
- Gráficos e analytics
- Sistema de notificações
- Backup automático
- Modo offline

## 🔐 Segurança

- Autenticação via Firebase (a implementar)
- Validação de dados no frontend e backend
- Proteção contra XSS e injection
- Dados criptografados em trânsito

## 📊 Banco de Dados

### Coleções Firebase

- **customers** - Dados dos clientes
- **children** - Dados das crianças
- **visits** - Registro de visitas
- **payments** - Histórico de pagamentos
- **packages** - Pacotes de horas
- **settings** - Configurações do sistema

## 🐛 Troubleshooting

### Erro ao instalar dependências
```bash
# Limpe o cache e reinstale
rm -rf node_modules package-lock.json
npm install
```

### Erro no Firebase
- Verifique se as credenciais estão corretas
- Confirme que o Firestore está ativado
- Verifique as regras de segurança

### Erro no build
```bash
# Limpe e rebuilde
npm run build
```

## 📝 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia em modo desenvolvimento |
| `npm run build` | Build de produção |
| `npm run dist` | Gera instalador |
| `npm run prisma:generate` | Gera cliente Prisma |
| `npm run prisma:migrate` | Cria migrations |
| `npm run prisma:studio` | Abre Prisma Studio |
| `npm run lint` | Executa linter |
| `npm run type-check` | Verifica tipos TypeScript |

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

## 📄 Licença

MIT License - veja o arquivo LICENSE para detalhes

## 👥 Autores

- Desenvolvido para Flex-Kids Playground

## 📞 Suporte

Para suporte, entre em contato através do email: suporte@flexkids.com.br

---

**Flex-Kids Manager** - Sistema de Gerenciamento Profissional para Playgrounds
