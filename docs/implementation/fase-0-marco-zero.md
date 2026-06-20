# App Piteco — Fase 0: Marco Zero

Data de abertura: 20 de junho de 2026

Status: **EM EXECUÇÃO — GATE 0 AINDA NÃO APROVADO**

Este registro congela o ponto inicial do plano mestre. Nenhum código de negócio, policy, Edge Function, migration, variável de produção, configuração de domínio, service worker ou componente de estudo deve ser alterado enquanto os itens pendentes deste documento não forem concluídos.

## 1. Ponto de retorno

| Item | Valor |
|---|---|
| Repositório | `PedroLuis-Ape/flash-teacher-buddy` |
| Branch oficial | `main` |
| Commit congelado | `3442ac33ca2c3173b0dd5982cfe4062103723667` |
| Mensagem do commit | `feat: animate real card-deck navigation (#75)` |
| Branch de rollback | `rollback-pre-super-plan-2026-06-20` |
| Branch documental da Fase 0 | `plan-fase-0-marco-zero` |

A branch de rollback aponta exatamente para o commit congelado. Ela não deve receber commits.

## 2. Mapa inicial dos ambientes

| Camada | Identificação | Classificação | Evidência atual |
|---|---|---|---|
| GitHub | `PedroLuis-Ape/flash-teacher-buddy`, branch `main` | Oficial | Repositório conectado ao projeto Lovable |
| Lovable UI | `b6f1ba83-b44c-4a41-8589-b1e5380cf1ea` | Oficial | URL registrada no `README.md` |
| Backend usado pelo build atual | `ymahldldyxvwjeruaxpr` | Produção Lovable Cloud indicada pelo repositório | `.env`, `supabase/config.toml` e relatório de produção apontam para esta referência |
| Supabase legado | `rnriudxxafcnftjiysue` | Legado/inativo | Projeto antigo da conta Supabase conectada |
| Supabase reconstruído | `xrnfhhoxmmstagmelvyi` | Novo ambiente separado; não presumir produção | Projeto ativo da conta conectada, não usado no rollout documentado |
| Domínio canônico | `https://www.apeeducation.org` | Oficial | Metadados e redirecionamento no `index.html` |
| Domínio raiz | `https://apeeducation.org` | Deve apenas redirecionar | Script de canonicalização executado antes do bootstrap |

### Regra operacional

Até existir evidência de rede e snapshot do banco servido pelo aplicativo publicado, **não aplicar migrations nem Edge Functions em `rnriudxxafcnftjiysue` ou `xrnfhhoxmmstagmelvyi`**. O fato de um projeto estar acessível no painel não prova que ele atende a produção.

## 3. Canonicalização já presente no código

O `index.html` atual contém um script no início do `<head>` que:

- detecta somente o hostname exato `apeeducation.org`;
- usa `window.location.replace`;
- envia para `https://www.apeeducation.org`;
- preserva `pathname`, `search` e `hash`;
- roda antes de tema, localStorage, autenticação e bootstrap do React.

Commit de origem identificado: `713cc8b312f5a4a83503061f4798d37fd4d0ee55` — `fix: canonicalize apex domain to www`.

O commit congelado de `main` é descendente desse commit. A presença no código está confirmada; a validação HTTP e comportamental em produção permanece pendente.

## 4. Riscos já confirmados sem alteração

### 4.1 Configuração e segredos

- Existe `.env` versionado.
- O `.gitignore` atual não ignora `.env` nem `.env.*` de forma abrangente.
- Há configuração administrativa baseada em variável `VITE_*`; ela deve ser auditada antes de continuar sendo tratada como autorização.
- Nenhum valor de chave foi reproduzido neste documento.

### 4.2 Desempenho mobile

O motor atual de transição de cards ainda contém o padrão proibido pela Fase 4A:

- `cloneNode(true)` do card;
- leitura de `getBoundingClientRect` e `getComputedStyle`;
- inserção temporária de camada no `document.body`;
- `ResizeObserver` por superfície;
- timers e listeners globais associados à transição.

Nenhuma correção será iniciada antes da aprovação dos gates anteriores.

### 4.3 CI

Existe workflow para:

- typecheck;
- testes;
- lint;
- build de produção.

Ainda precisam ser acrescentados, em fase posterior:

- smoke test de migrations em banco limpo;
- testes RLS com anônimo, usuário A e usuário B;
- testes das Edge Functions com parâmetros forjados;
- E2E de autenticação, domínio e estudo;
- orçamento de bundle.

### 4.4 Pull requests antigos

Existem pull requests abertos anteriores ao plano. Nenhum deles deve ser mesclado durante o Marco Zero sem revisão explícita de escopo e atualização sobre `main`.

## 5. Checklist da Fase 0

| ID | Entregável | Estado |
|---|---|---|
| 0.1 | Commit exato de `main` registrado | CONCLUÍDO |
| 0.1 | Ponto operacional de rollback criado | CONCLUÍDO — branch protegida por procedimento, tag ainda recomendada |
| 0.2 | Projeto Lovable identificado | CONCLUÍDO — `b6f1ba83-b44c-4a41-8589-b1e5380cf1ea` |
| 0.3 | Backend indicado pelo deploy/repositório identificado | CONCLUÍDO PARCIALMENTE — `ymahldldyxvwjeruaxpr` |
| 0.3 | Project ref confirmado pela rede do navegador publicado | PENDENTE |
| 0.4 | Referências classificadas | CONCLUÍDO INICIALMENTE |
| 0.5 | Snapshot vivo de schema, policies, grants e funções da produção | PENDENTE — backend Lovable Cloud não disponível no conector Supabase atual |
| 0.6 | Baseline mobile e desktop capturada | PENDENTE |
| 0.7 | Procedimento de rollback por camada documentado e testado | PENDENTE |

## 6. Baseline obrigatória a capturar

Executar no aplicativo publicado, sem alterar o código:

1. Boot frio em Android intermediário, cache limpo: TTFB, FCP, LCP e tempo até interface utilizável.
2. Retorno após 5 e 30 minutos em segundo plano: sessão, tela exibida e refresh.
3. Vinte avanços e dez retornos de card: long tasks, memória, FPS aproximado e travamentos.
4. Abertura de pasta pequena e grande: número de requisições e duração total.
5. Login por domínio raiz e por `www`: origem final, criação de storage, persistência e ausência de loop.
6. Rota profunda com caminho, query e fragmento: preservação completa após canonicalização.

## 7. Critério para aprovar o Gate 0

O Gate 0 só pode ser marcado como aprovado quando todos os pontos abaixo tiverem evidência anexada:

- projeto Lovable e versão publicada confirmados;
- project ref da produção confirmado por requisição real do navegador;
- snapshot vivo do backend oficial salvo;
- baseline mobile e desktop registrada;
- rollback de frontend definido e verificado;
- rollback de migrations e Edge Functions definido para o backend oficial;
- nenhuma dúvida restante sobre qual banco atende Auth, REST, RPC, Storage e Functions.

Até lá, o projeto permanece formalmente na Fase 0.
