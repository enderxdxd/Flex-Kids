# 🚀 Guia de Release - Flex-Kids Manager

## 📋 Visão Geral

Este projeto usa **GitHub Actions** para automatizar completamente o processo de build e publicação de novas versões.

### Fluxo Automático

```
Você cria tag v2.3.0 → GitHub Actions detecta
    ↓
Build automático (Windows .exe)
    ↓
Publicação como GitHub Release (draft)
    ↓
electron-updater notifica usuários
```

---

## 🎯 Como Lançar uma Nova Versão

### Opção 1: Usando npm version (Recomendado)

```bash
# Para correção de bugs (2.2.0 → 2.2.1)
npm version patch

# Para novas features (2.2.0 → 2.3.0)
npm version minor

# Para breaking changes (2.2.0 → 3.0.0)
npm version major

# Push do commit e da tag
git push origin main --tags
```

O comando `npm version` automaticamente:
- ✅ Atualiza o `version` no `package.json`
- ✅ Cria um commit com a mensagem "2.3.0"
- ✅ Cria a tag git `v2.3.0`

### Opção 2: Manual

```bash
# 1. Edite manualmente o "version" no package.json
# Exemplo: "version": "2.3.0"

# 2. Commit e tag
git add package.json
git commit -m "release: v2.3.0 - descrição das mudanças"
git tag v2.3.0

# 3. Push
git push origin main --tags
```

---

## 🤖 O que Acontece Automaticamente

Quando você faz push de uma tag `v*.*.*`, o GitHub Actions:

1. **Instala dependências** (`npm ci`)
2. **Compila o código** (`npm run build`)
3. **Gera o instalador Windows** (`npm run dist:win`)
4. **Cria GitHub Release** (como draft)
5. **Anexa os arquivos**:
   - `Flex-Kids-Manager-Setup-2.3.0.exe`
   - `latest.yml` (para auto-update)

### Verificar o Build

1. Vá em **Actions** no GitHub
2. Clique no workflow "Build and Release"
3. Veja os logs em tempo real

---

## 📝 Adicionar Release Notes

### Durante a criação da tag:

```bash
git tag -a v2.3.0 -m "🎉 Versão 2.3.0

✨ Novidades:
- Sistema de notificação de atualizações
- Ícones SVG profissionais
- UI/UX premium com glass-morphism

🔧 Correções:
- Correção na importação de planilhas
- Melhorias na performance do dashboard
"

git push origin main --tags
```

### Depois do Release ser criado:

1. Vá em **Releases** no GitHub
2. Clique em **Edit** no draft criado
3. Adicione/edite as release notes
4. Clique em **Publish release**

---

## 🔄 Como Funciona o Auto-Update

O app já tem `electron-updater` configurado:

1. **Verifica atualizações** a cada 1 hora
2. **Detecta nova versão** no GitHub Releases
3. **Mostra badge animado** na Navbar
4. **Usuário clica** → abre modal com detalhes
5. **Download e instalação** automáticos

### Arquivos Importantes

- `src/main/updater.ts` - Lógica de auto-update (Electron)
- `src/renderer/src/services/updateChecker.ts` - Verificação de versão (React)
- `src/renderer/src/components/modals/UpdateModal.tsx` - UI de notificação

---

## 🛠️ Troubleshooting

### Build falhou no Actions?

**Erro comum: dependências nativas (serialport)**

```bash
# Teste localmente primeiro:
npm ci
npm run build
npm run dist:win
```

Verifique a pasta `release/` - deve conter:
- `Flex-Kids-Manager-Setup-2.2.0.exe`
- `latest.yml`

### Release não aparece?

Verifique se:
- ✅ A tag começa com `v` (ex: `v2.3.0`, não `2.3.0`)
- ✅ Você fez push da tag: `git push origin main --tags`
- ✅ O workflow tem permissão: `permissions: contents: write`

### Auto-update não funciona?

Certifique-se que:
- ✅ O Release foi **publicado** (não está como draft)
- ✅ Os arquivos `latest.yml` e `.exe` estão anexados
- ✅ O `package.json` tem a configuração `publish.provider: "github"`

---

## 📦 Estrutura de Arquivos

```
Flex-Kids/
├── .github/
│   └── workflows/
│       └── release.yml          ← Pipeline de CI/CD
├── src/
│   ├── main/
│   │   └── updater.ts           ← Auto-update (Electron)
│   └── renderer/
│       └── src/
│           ├── services/
│           │   └── updateChecker.ts  ← Verificação de versão
│           └── components/
│               └── modals/
│                   └── UpdateModal.tsx  ← UI de notificação
├── package.json                 ← Versão e configuração
├── vite.config.ts               ← Injeta versão no build
└── RELEASE.md                   ← Este arquivo
```

---

## 🎨 Customizações

### Publicar direto (sem draft)

Edite `.github/workflows/release.yml`:

```yaml
- name: Create Release
  uses: softprops/action-gh-release@v1
  with:
    draft: false  # ← Mude de true para false
```

### Adicionar builds para Mac/Linux

Adicione jobs no `release.yml`:

```yaml
jobs:
  build-windows:
    # ... existente

  build-mac:
    runs-on: macos-latest
    steps:
      # ... similar ao Windows
      - run: npm run dist:mac

  build-linux:
    runs-on: ubuntu-latest
    steps:
      # ... similar ao Windows
      - run: npm run dist:linux
```

---

## ✅ Checklist de Release

Antes de criar uma nova versão:

- [ ] Todos os testes passando
- [ ] Código commitado e pushed
- [ ] CHANGELOG.md atualizado (opcional)
- [ ] Versão atualizada no package.json
- [ ] Tag criada e pushed
- [ ] Build do Actions passou
- [ ] Release notes adicionadas
- [ ] Release publicado (não draft)
- [ ] Testado o auto-update

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do GitHub Actions
2. Teste o build localmente: `npm run dist:win`
3. Verifique as configurações no `package.json`
4. Consulte a [documentação do electron-builder](https://www.electron.build/)

---

**Última atualização:** Versão 2.2.0
