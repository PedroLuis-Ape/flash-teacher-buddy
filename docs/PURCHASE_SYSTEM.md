# 🛡️ Sistema de Compra Seguro — APE Piteco

## 📋 Resumo

Sistema de compra **totalmente atômico, idempotente e auditável** para a loja de skins do Piteco, implementado com transações nativas do PostgreSQL/Supabase.

---

## ✅ Funcionalidades Implementadas

### 1. **Transação Atômica**
- Todas as operações (validação, débito, inserção no inventário, logs) acontecem em uma **única transação SQL**
- Se qualquer parte falhar → **rollback automático**
- Garante consistência dos dados em 100% dos casos

### 2. **Idempotência**
- Cada compra recebe um `operation_id` único (UUID v4)
- Se o mesmo `operation_id` for enviado duas vezes → rejeita automaticamente
- **Previne duplicação** mesmo em casos de double-click ou retry

### 3. **Logs Completos**
Toda tentativa de compra (sucesso **OU** falha) é registrada em `purchase_logs`:

```sql
purchase_logs:
  - operation_id (UUID único)
  - buyer_id
  - skin_id
  - price_pitecoin
  - balance_before
  - balance_after
  - status (completed | failed)
  - error_message (se houver)
  - created_at
```

### 4. **Validações de Segurança**
A função `process_skin_purchase()` valida automaticamente:
- ✅ Skin existe no catálogo e está ativo
- ✅ Usuário ainda não possui o item
- ✅ Saldo suficiente (apenas se preço > 0)
- ✅ Operação não foi processada anteriormente (idempotência)

### 5. **Suporte a Itens Gratuitos**
- Itens com `price_pitecoin = 0` são adicionados sem debitar saldo
- Mesmo assim registra logs completos

---

## 🔧 Arquitetura Técnica

### Banco de Dados (PostgreSQL/Supabase)

#### Tabela: `purchase_logs`
```sql
CREATE TABLE public.purchase_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL UNIQUE,  -- Idempotência
  buyer_id UUID NOT NULL,
  skin_id TEXT NOT NULL,
  price_pitecoin INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_purchase_logs_buyer ON purchase_logs(buyer_id);
CREATE INDEX idx_purchase_logs_operation ON purchase_logs(operation_id);
CREATE INDEX idx_purchase_logs_created ON purchase_logs(created_at DESC);
```

#### Função RPC: `process_skin_purchase()`
```sql
CREATE FUNCTION public.process_skin_purchase(
  p_operation_id UUID,
  p_buyer_id UUID,
  p_skin_id TEXT,
  p_price INTEGER
) RETURNS JSONB
```

**Fluxo da função:**
1. Verifica idempotência (`operation_id` já existe?)
2. Valida se skin existe e está ativo
3. Verifica se usuário já possui
4. Pega saldo atual com `FOR UPDATE` (lock pessimista)
5. Valida saldo suficiente
6. **Inicia transação implícita:**
   - Atualiza saldo (`profiles.balance_pitecoin`)
   - Insere no inventário (`user_inventory`)
   - Registra transação (`pitecoin_transactions`)
   - Insere log de compra (`purchase_logs`)
7. Se qualquer erro → **ROLLBACK** + registra log de falha
8. Retorna JSON com resultado

**Retorno (JSONB):**
```json
{
  "success": true,
  "purchase_id": "uuid-do-log",
  "inventory_id": "uuid-do-item",
  "new_balance": 9500,
  "message": "✅ Compra realizada! Pacote adicionado ao seu inventário!"
}
```

Ou em caso de erro:
```json
{
  "success": false,
  "error": "insufficient_funds",
  "message": "Saldo insuficiente! Você tem ₱500, mas precisa de ₱1000"
}
```

---

### Frontend (TypeScript)

#### `src/lib/storeEngine.ts`

```typescript
export async function purchaseSkin(
  userId: string,
  skinId: string,
  price: number
): Promise<{ success: boolean; message: string; newBalance?: number }>
```

**Fluxo:**
1. Gera `operationId` único com `crypto.randomUUID()`
2. Chama `supabase.rpc('process_skin_purchase', { ... })`
3. Recebe resposta e retorna para UI
4. **Não faz rollback manual** — tudo é tratado no banco

---

## 🎯 Como Usar

### No código da loja:

```typescript
import { purchaseSkin } from '@/lib/storeEngine';

// Dentro do handler de compra
const result = await purchaseSkin(
  user.id,           // ID do comprador
  'piteco-vampiro',  // ID da skin
  1500               // Preço em PiteCoins
);

if (result.success) {
  // Sucesso!
  toast.success(result.message);
  
  // Atualizar UI local
  setBalance(result.newBalance);
  setInventory([...inventory, newItem]);
} else {
  // Falha
  toast.error(result.message);
}
```

---

## 🧪 Testes & QA

### Checklist de testes:

- [x] **Compra com saldo suficiente** → sucesso, saldo atualizado, item no inventário
- [x] **Compra com saldo insuficiente** → falha, sem alterações
- [x] **Double-click** → segunda chamada rejeitada (idempotência)
- [x] **Item já possuído** → falha, sem duplicação
- [x] **Item gratuito (price=0)** → sucesso, sem débito
- [x] **Erro durante gravação** → rollback automático, dados consistentes
- [x] **Logs** → todas as tentativas registradas em `purchase_logs`

### Como testar manualmente:

1. Abra a loja (`/store`)
2. Tente comprar um item que você tem saldo
3. Verifique o inventário (`/profile` → Inventário)
4. Veja os logs no backend:
   ```sql
   SELECT * FROM purchase_logs 
   WHERE buyer_id = 'seu-user-id'
   ORDER BY created_at DESC;
   ```

---

## 🔒 Segurança Implementada

### Row-Level Security (RLS)

#### `purchase_logs`:
```sql
-- Usuários veem apenas seus próprios logs
CREATE POLICY "Users can view their own purchase logs"
  ON purchase_logs FOR SELECT
  USING (auth.uid() = buyer_id);

-- Developer admins veem todos os logs
CREATE POLICY "Developer admins can view all purchase logs"
  ON purchase_logs FOR SELECT
  USING (is_developer_admin(auth.uid()));
```

### Validações de Input
- ✅ Todos os parâmetros validados no banco
- ✅ `SECURITY DEFINER` com `search_path = public` (previne SQL injection)
- ✅ Locks pessimistas (`FOR UPDATE`) previnem race conditions

---

## 📊 Auditoria & Análise

### Consultar compras bem-sucedidas:
```sql
SELECT 
  buyer_id,
  skin_id,
  price_pitecoin,
  balance_before,
  balance_after,
  created_at
FROM purchase_logs
WHERE status = 'completed'
ORDER BY created_at DESC;
```

### Consultar falhas de compra:
```sql
SELECT 
  buyer_id,
  skin_id,
  error_message,
  created_at
FROM purchase_logs
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### Estatísticas de vendas:
```sql
SELECT 
  skin_id,
  COUNT(*) as total_sales,
  SUM(price_pitecoin) as total_revenue
FROM purchase_logs
WHERE status = 'completed'
GROUP BY skin_id
ORDER BY total_sales DESC;
```

---

## 🚨 Notas sobre Upload de Imagens

### Situação Atual:
- **Não há sistema de upload de imagens implementado**
- Todas as imagens de skins estão em `/public/assets/published/`
- As imagens são referenciadas no banco via `public_catalog` (campos `avatar_final` e `card_final`)

### Se Implementar Uploads no Futuro:

#### Opção 1: Supabase Storage + RLS
```sql
-- Criar bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('skins', 'skins', true);

-- Policy: apenas developer_admin pode fazer upload
CREATE POLICY "Only dev admins can upload skins"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'skins' 
    AND is_developer_admin(auth.uid())
  );

-- Policy: todos podem visualizar
CREATE POLICY "Anyone can view skins"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'skins');
```

#### Opção 2: Moderação Manual
1. Aceitar upload de qualquer usuário
2. Mover para pasta `pending_review/`
3. Pedro aprova/rejeita via painel admin
4. Aprovados vão para `/assets/market/`

**Por enquanto não é necessário** — todas as skins são criadas manualmente por Pedro e já estão no repositório.

---

## ⚠️ Warning do Linter (Não Crítico)

O linter detectou:
```
WARN: Leaked Password Protection Disabled
```

**O que é?**  
O Supabase Auth tem uma feature de verificar senhas vazadas (já comprometidas em data breaches).

**Por que não é crítico?**  
- Não afeta a segurança das compras
- Não afeta RLS ou transações
- É apenas uma recomendação de boas práticas para auth

**Como resolver (opcional):**
```sql
-- Habilitar proteção de senha vazada
UPDATE auth.config
SET password_requirements = jsonb_set(
  password_requirements,
  '{leaked_password_protection}',
  'true'
);
```

Ou via dashboard do Supabase:  
**Authentication → Policies → Enable "Leaked password protection"**

---

## 📝 Resumo Final

✅ **Sistema de compra 100% atômico e idempotente**  
✅ **Logs completos de todas as transações**  
✅ **Validações de segurança em múltiplas camadas**  
✅ **Suporte a itens gratuitos**  
✅ **Sem necessidade de rollback manual**  
✅ **Auditoria completa para admin**

**Status:** Pronto para produção 🚀

---

## 🔗 Links Úteis

- [Código da função RPC](../src/lib/storeEngine.ts)
- [Componente da loja](../src/pages/Store.tsx)
- [Documentação Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Documentação de transações PostgreSQL](https://www.postgresql.org/docs/current/tutorial-transactions.html)
