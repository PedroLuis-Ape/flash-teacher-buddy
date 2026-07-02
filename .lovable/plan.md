## Diagnóstico

O plano colado no chat anterior estava **errado** e implementá-lo teria quebrado o app. Confirmei consultando o banco: `ymahldldyxvwjeruaxpr` está intacto (5552 flashcards, 132 listas, 22 profiles, 5 turmas). O Lovable **não** está trocando de projeto. Toda a infraestrutura de dois projetos (`xrnfhhoxmmstagmelvyi` gerenciado + `ymahldldyxvwjeruaxpr` dados) é intencional e o `check-platform.mjs` protege essa separação.

O sintoma real ("depois de update grande, tudo some no preview") tem uma causa específica em `src/contexts/AuthContext.tsx`:

```ts
function readPersistedSession(): Session | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return null;                            // ← ponto de falha
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const raw = localStorage.getItem(`sb-${ref}-auth-token`);
  ...
}
```

Fluxo do bug:

1. Você pede um update grande → Vite/HMR faz **full reload** e reprocessa `.env`.
2. Durante rebuilds no sandbox do Lovable, `import.meta.env.VITE_SUPABASE_URL` pode aparecer momentaneamente `undefined`.
3. `readPersistedSession` retorna `null` → estado inicial é "anonymous" → todos os hooks disparam query sem `user.id` → RLS devolve 0 linhas → **UI mostra vazio**.
4. Alguns segundos depois `supabase.auth.getSession()` hidrata a sessão real, mas o React Query já tem cache com resultados vazios (staleTime) e o usuário fica com a impressão de que "desconectou do banco".

O `platformRuntime.ts` já tem fallback correto para o cliente Supabase (`PRODUCTION_DATA_URL`), mas o `readPersistedSession` **não usa esse fallback** — lê env diretamente. Essa é a única brecha.

## O que fazer

### 1. Endurecer `readPersistedSession` (única mudança de código)

`src/contexts/AuthContext.tsx`, função `readPersistedSession`: importar `PRODUCTION_DATA_URL` de `@/integrations/supabase/platformRuntime` e usá-lo como fallback quando `VITE_SUPABASE_URL` estiver ausente. Assim a chave `sb-ymahldldyxvwjeruaxpr-auth-token` é sempre construída corretamente e a sessão otimista sobrevive ao rebuild.

```ts
import { PRODUCTION_DATA_URL } from "@/integrations/supabase/platformRuntime";

function readPersistedSession(): Session | null {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || PRODUCTION_DATA_URL;
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    ...
  }
}
```

Nada mais muda. Não vou tocar em:
- `src/integrations/supabase/client.ts` (auto-gerado)
- `.env` (auto-gerado)
- `supabase/config.toml` (auto-gerado, `project_id` permanece)
- `scripts/check-platform.mjs` (está correto, protege a separação)
- `platformRuntime.ts` / `runtimeBootstrap.ts` (já têm o fallback certo)

### 2. Verificação

- `npm run typecheck` para garantir imports OK.
- Testes existentes de bootstrap (`platformRuntime.test.ts`, `runtimeBootstrap.test.ts`, `dependencyToolchain.contract.test.ts`) devem continuar passando sem alteração.

### Riscos

Praticamente zero: a mudança só adiciona um fallback já usado no resto do runtime. Se `.env` estiver presente (caso normal), o comportamento é idêntico.

### O que fica de fora

Não vou aplicar nada do plano colado da outra IA — ele reverteria a separação de projetos, quebraria testes/CI e apontaria tráfego de produção para o projeto gerenciado errado.
