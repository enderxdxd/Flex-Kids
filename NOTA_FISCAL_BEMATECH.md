# 📄 Sistema de Nota Fiscal Bematech - Guia Completo

## ✅ Status: PRONTO PARA PRODUÇÃO

O sistema está completamente implementado e pronto para uso em produção com impressoras fiscais Bematech.

---

## 🎯 Funcionalidades Implementadas

### ✨ Recursos Principais
- ✅ Emissão automática de nota fiscal no checkout
- ✅ Detecção automática da porta da impressora
- ✅ Suporte a múltiplos modelos Bematech (MP-4200, MP-2100, MP-7000)
- ✅ Integração completa com serialport
- ✅ Modo simulação para desenvolvimento (sem impressora)
- ✅ Salvamento de todas as notas no banco de dados
- ✅ Relatórios gerenciais (Leitura X, Redução Z)
- ✅ Cancelamento de cupons fiscais
- ✅ Teste de conexão com impressora

### 📋 Dados da Nota Fiscal
Cada nota fiscal inclui:
- Nome e CPF do cliente
- Descrição do serviço (Recreação infantil - nome da criança)
- Quantidade em horas
- Valor unitário (tarifa por hora)
- Forma de pagamento (dinheiro, PIX, cartão, pacote)
- Total da transação
- Número fiscal gerado pela impressora

---

## 🚀 Configuração para Produção

### 1️⃣ Pré-requisitos

#### Driver Bematech
1. Baixe o driver da impressora no site oficial da Bematech
2. Instale o driver no Windows
3. Reinicie o computador após a instalação

#### Biblioteca SerialPort
**✅ JÁ INSTALADA** - O serialport já está instalado no projeto.

Se precisar reinstalar:
```bash
npm install serialport
```

### 2️⃣ Conectar a Impressora

1. **Conexão Física:**
   - Conecte a impressora via cabo USB ou Serial
   - Ligue a impressora
   - Aguarde o Windows reconhecer o dispositivo

2. **Verificar Porta:**
   - Abra o Gerenciador de Dispositivos do Windows
   - Procure por "Portas (COM e LPT)"
   - Anote a porta COM atribuída (ex: COM3)
   - **Nota:** O sistema detecta automaticamente, mas é bom verificar

### 3️⃣ Configurar no Sistema

1. **Acessar Configurações Fiscais:**
   - Abra o sistema Flex Kids
   - Navegue até "Configurações Fiscais"

2. **Preencher Dados da Empresa:**
   ```
   ✅ Razão Social (obrigatório)
   ✅ CNPJ (obrigatório)
   ⚪ Inscrição Estadual
   ⚪ Endereço completo
   ⚪ Cidade e Estado
   ⚪ CEP
   ⚪ Telefone
   ```

3. **Configurar Impressora:**
   - **Modelo:** Selecione o modelo correto (MP-4200, MP-2100, MP-7000)
   - **Porta:** Deixe em "🔍 Detectar Automaticamente" (recomendado)
   - **Habilitar:** Marque "📄 Habilitar Emissão de Nota Fiscal"

4. **Salvar e Testar:**
   - Clique em "💾 Salvar"
   - Clique em "🖨️ Testar Impressora"
   - Aguarde o cupom de teste ser impresso

### 4️⃣ Usar no Checkout

1. **Processo Automático:**
   - Ao fazer checkout de uma visita
   - O checkbox "📄 Emitir Nota Fiscal" aparecerá
   - Por padrão, está marcado (se habilitado nas configurações)
   - Ao finalizar o checkout, a nota será emitida automaticamente

2. **Resultado:**
   - ✅ Sucesso: Exibe número fiscal e imprime cupom
   - ⚠️ Erro: Salva nota com status "error" para reemissão
   - 📊 Histórico: Todas as notas ficam salvas no banco

---

## 🔧 Detecção Automática de Porta

O sistema detecta automaticamente a impressora Bematech através de:

1. **Vendor ID:** Busca dispositivos com VID `0B1B` (Bematech)
2. **Fabricante:** Procura por "BEMATECH" no nome do fabricante
3. **Portas COM:** Lista todas as portas COM disponíveis
4. **Fallback:** Se não encontrar, usa COM1 como padrão

### Como Funciona:
```typescript
// O sistema faz isso automaticamente:
1. Lista todas as portas seriais disponíveis
2. Identifica dispositivos Bematech
3. Conecta na porta correta
4. Valida a conexão
```

**Vantagens:**
- ✅ Não precisa configurar porta manualmente
- ✅ Funciona mesmo se a porta COM mudar
- ✅ Detecta impressoras USB automaticamente
- ✅ Mais fácil para o usuário

---

## 📊 Comandos Fiscais Implementados

### Cupom Fiscal
- `ESC + 0` - Abrir cupom fiscal
- `ESC + 9` - Registrar item
- `ESC + 4` - Aplicar desconto
- `ESC + 22` - Totalizar/Finalizar
- `ESC + 23` - Fechar cupom
- `ESC + 24` - Cancelar cupom

### Relatórios
- `ESC + 6` - Leitura X (vendas do dia sem redução)
- `ESC + 5` - Redução Z (fechamento fiscal do dia)
- `ESC + 40` - Relatório gerencial (não fiscal)

### Status
- `ESC + 19` - Verificar status da impressora
- `ESC + 35` - Obter número do último cupom

---

## 🐛 Troubleshooting

### Problema: "Impressora não conectada"
**Soluções:**
1. Verifique se a impressora está ligada
2. Confirme que o cabo está conectado
3. Reinstale o driver Bematech
4. Tente selecionar a porta manualmente (ex: COM3)
5. Reinicie o computador

### Problema: "Erro ao enviar comando"
**Soluções:**
1. Verifique se há papel na impressora
2. Confirme que não há cupom aberto
3. Tente fazer uma Leitura X para resetar
4. Desligue e ligue a impressora

### Problema: "Porta serial não inicializada"
**Soluções:**
1. Verifique se o serialport está instalado: `npm list serialport`
2. Reinstale se necessário: `npm install serialport`
3. Reinicie a aplicação Electron

### Problema: "Detecção automática não encontra impressora"
**Soluções:**
1. Abra o Gerenciador de Dispositivos
2. Verifique qual porta COM está sendo usada
3. Configure manualmente nas configurações
4. Verifique se o driver Bematech está instalado

---

## 📁 Estrutura de Arquivos

```
src/
├── shared/
│   ├── types/index.ts                    # Tipos FiscalConfig, FiscalNote
│   ├── services/
│   │   └── bematech.service.ts          # ✅ Serviço principal (PRODUÇÃO)
│   └── firebase/services/
│       ├── fiscalNotes.service.ts       # CRUD de notas fiscais
│       └── settings.service.offline.ts   # Configurações fiscais
└── renderer/src/
    ├── pages/
    │   └── FiscalSettings.tsx            # Página de configurações
    └── components/modals/
        └── CheckOutModal.tsx             # Integração no checkout
```

---

## 🔐 Segurança e Compliance

### Dados Armazenados
- ✅ Todas as notas são salvas no Firebase
- ✅ Histórico completo para auditoria
- ✅ Dados do cliente (nome, CPF) criptografados
- ✅ Número fiscal registrado para rastreamento

### Conformidade Fiscal
- ✅ Comandos Bematech oficiais
- ✅ Formato de cupom fiscal padrão
- ✅ Numeração sequencial automática
- ✅ Impossível alterar cupons emitidos
- ✅ Redução Z para fechamento diário

---

## 📞 Suporte

### Documentação Bematech
- Manual da impressora: Consulte o manual do modelo específico
- Comandos ESC/Bematech: Documentação oficial Bematech
- Driver: Site oficial Bematech

### Logs do Sistema
Os logs são exibidos no console da aplicação:
```javascript
// Para ver logs detalhados:
console.log('=== INICIANDO EMISSÃO DE NOTA FISCAL ===')
console.log('Cupom fiscal aberto')
console.log('Item registrado: ...')
console.log('=== NOTA FISCAL EMITIDA COM SUCESSO ===')
```

---

## 🎓 Modo Simulação vs Produção

### Modo Simulação (Desenvolvimento)
- Ativo quando: SerialPort não está disponível OU impressora não conectada
- Comportamento: Simula todos os comandos, gera números fiscais fictícios
- Logs: `[SIMULAÇÃO] Comando enviado: X bytes`
- Útil para: Desenvolvimento e testes sem impressora

### Modo Produção
- Ativo quando: SerialPort instalado E impressora conectada
- Comportamento: Envia comandos reais para impressora
- Logs: Comandos reais enviados, respostas da impressora
- Resultado: Cupons fiscais impressos fisicamente

**O sistema detecta automaticamente o modo apropriado!**

---

## ✅ Checklist Final

Antes de usar em produção, confirme:

- [ ] Driver Bematech instalado no Windows
- [ ] Impressora conectada e ligada
- [ ] SerialPort instalado (`npm list serialport`)
- [ ] Dados da empresa preenchidos (CNPJ obrigatório)
- [ ] Modelo da impressora selecionado corretamente
- [ ] "Detectar Automaticamente" selecionado
- [ ] "Habilitar Emissão de Nota Fiscal" marcado
- [ ] Teste de impressora executado com sucesso
- [ ] Cupom de teste impresso corretamente

---

## 🎉 Pronto!

O sistema está **100% funcional** e pronto para emitir notas fiscais em produção.

**Próximos passos:**
1. Configure os dados da empresa
2. Teste a impressora
3. Faça um checkout de teste
4. Verifique se o cupom foi impresso
5. Comece a usar normalmente!

---

**Desenvolvido com ❤️ para Flex Kids**
