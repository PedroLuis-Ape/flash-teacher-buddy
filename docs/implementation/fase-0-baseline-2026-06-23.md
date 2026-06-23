# App Piteco — Fase 0: baseline de 23 de junho de 2026

Status: **EM EXECUÇÃO — ALTERAÇÕES DE BANCO BLOQUEADAS ATÉ IDENTIFICAR O BACKEND SERVIDO PELO APP**

Este documento atualiza o marco zero de 20 de junho de 2026. Ele registra evidências atuais sem substituir o histórico anterior.

## 1. Ponto de auditoria

| Item | Valor |
|---|---|
| Repositório | `PedroLuis-Ape/flash-teacher-buddy` |
| Branch oficial auditada | `main` |
| SHA-base observada | `7487fe8130a058502a8523cf37b75e567f47b63e` |
| Branch desta auditoria | `audit/phase-0-baseline-2026-06-23` |
| PR de estabilidade do modo escrita | `#153`, rascunho, não mesclado |
| PR de rollout do Super Importador | `#154`, rascunho, não mesclado |

Os PRs de teste não são considerados produção até merge e deploy confirmados.

## 2. Achado P0 — identidade do backend não confirmada

O frontend versionado e `supabase/config.toml` apontam para o project ref:

- `ymahldldyxvwjeruaxpr`

A conta Supabase conectada à auditoria apresenta:

- `rnriudxxafcnftjiysue` — inativo;
- `xrnfhhoxmmstagmelvyi` — ativo e saudável.

O projeto `ymahldldyxvwjeruaxpr` não aparece na conta Supabase conectada. Isso pode significar que ele pertence ao Lovable Cloud, a outra conta ou a outra organização.

### Decisão de segurança

Nenhuma migration, policy, função ou Edge Function será aplicada em `xrnfhhoxmmstagmelvyi` apenas por ele estar acessível. Primeiro deve ser comprovado, por requisição real do aplicativo publicado, qual project ref atende Auth, REST, RPC, Storage e Functions.

## 3. Inventário do projeto Supabase acessível

Leitura realizada em `xrnfhhoxmmstagmelvyi`, sem alteração de schema ou dados:

| Componente | Quantidade observada |
|---|---:|
| Tabelas públicas | 25 |
| Policies públicas | 28 |
| Rotinas públicas | 23 |
| Triggers públicos não internos | 10 |
| Buckets de Storage | 1 |
| Edge Functions ativas | 2 |

Edge Functions observadas:

- `validated-schema-rebuild`;
- `sync-piteco-store-assets-v2`.

O histórico de migrations acessível contém reconstrução do núcleo, importador inteligente, glossário por conta, PiTECoin e gerenciador de pacotes da loja, com versões entre 18 e 22 de junho de 2026.

## 4. Alertas de segurança no projeto acessível

Os alertas abaixo são evidências para investigação. Eles não serão corrigidos antes da confirmação de que este é o backend oficial.

### 4.1 RLS habilitado sem policy

Sete tabelas aparecem com RLS ligado e nenhuma policy associada:

- `study_session_answers`;
- `flashcard_progress`;
- `daily_activity`;
- `user_list_completions`;
- `user_achievements`;
- `exchange_config`;
- `exchange_logs`.

Isso pode ser intencional quando todo acesso ocorre por funções privilegiadas, mas precisa ser comprovado com testes de usuário A, usuário B e anônimo.

### 4.2 Funções `SECURITY DEFINER` expostas

Foi encontrada uma função executável por `anon`:

- `get_account_glossary_for_list_v1(_list_id uuid)`.

Também foram encontradas funções `SECURITY DEFINER` executáveis por usuários autenticados, incluindo rotinas de perfil, compra, câmbio e atualização de perfil. A exposição não é automaticamente uma vulnerabilidade: cada função precisa ser auditada para confirmar validação de `auth.uid()`, propriedade dos registros, parâmetros forjados, `search_path` seguro e grants mínimos.

## 5. Inventário do frontend

### 5.1 Rotas

`src/App.tsx` contém 63 rotas declaradas, incluindo:

- públicas e SEO;
- autenticação e callback;
- biblioteca pessoal, pastas, listas e glossário;
- jogos e estudo;
- portal público;
- loja, presentes e reinos;
- administração;
- professor, aluno e turmas;
- notas e metas;
- importadores;
- auditoria, configurações e status do sistema.

A presença da rota no React não prova autorização. A proteção real precisa ser confirmada no componente, RPC, Edge Function e RLS correspondente.

### 5.2 Feature flags

`src/lib/featureFlags.ts` possui 24 flags estáticas. Entre as desligadas ou em fallback estão:

- conversão automática;
- diretório;
- presentes administrativos;
- jornada;
- modo offline;
- motor inteligente de estudo;
- novo pipeline de status de cards.

Classes, comunicação de turma, glossário, camadas, imagens e economia aparecem habilitados no código atual.

### 5.3 Gates temporários e armazenamento local

A busca inicial confirmou usos relevantes de:

- `VITE_OWNER_EMAIL`;
- `localStorage`;
- `sessionStorage`;
- Safe Mode;
- preferências de estudo;
- estado de retomada;
- rollouts de importação.

Nem todo uso de armazenamento local é incorreto. A classificação deve separar:

1. preferência legítima do dispositivo;
2. cache recuperável;
3. estado temporário de fluxo;
4. autorização ou disponibilidade de função — proibido como única proteção.

## 6. Contrato de ambiente atual

O repositório já possui `scripts/validate-environment.mjs`, que verifica:

- presença das variáveis públicas obrigatórias;
- correspondência entre URL, project ref, chave publicável e `supabase/config.toml`;
- ausência de service role, senha e segredos privados na `.env` versionada.

A `.env` continua versionada e deve permanecer limitada a variáveis públicas até migração para variáveis da plataforma. Nenhum valor de chave é reproduzido neste documento.

## 7. Inventário reproduzível

Foi adicionado:

```bash
node scripts/audit-phase-zero.mjs
```

Para salvar o resultado:

```bash
node scripts/audit-phase-zero.mjs --out phase-zero-audit.json
```

O relatório inclui somente nomes de variáveis e metadados estruturais. Ele não imprime os valores de chaves publicáveis.

Itens inventariados:

- rotas;
- feature flags;
- project refs declarados;
- gates de proprietário;
- usos de `localStorage` e `sessionStorage`;
- migrations do repositório;
- Edge Functions do repositório;
- workflows de CI.

## 8. Estado do Gate 0

| Item | Estado |
|---|---|
| SHA-base registrada | Concluído |
| Rotas e flags inventariadas | Concluído inicial |
| Supabase acessível inventariado | Concluído inicial |
| Alertas de segurança coletados | Concluído inicial |
| Backend servido pelo app publicado confirmado | **Pendente P0** |
| Migrations do repositório comparadas com backend oficial | Pendente |
| Matriz completa de gates e decisões | Em execução |
| Baseline mobile e desktop | Pendente |
| Rollback de frontend e backend verificado | Pendente |
| Contas e dados de teste definidos | Pendente |

## 9. Próximas ações obrigatórias

1. Abrir o aplicativo publicado e registrar o hostname real das chamadas para Auth, REST, RPC, Storage e Functions.
2. Confirmar se `ymahldldyxvwjeruaxpr` é Lovable Cloud oficial ou configuração obsoleta.
3. Executar o inventário automático e anexar o JSON ao PR da Fase 0.
4. Comparar migrations do repositório somente com o backend oficial confirmado.
5. Classificar todos os gates encontrados em: remover, manter como fallback técnico, converter em preferência ou substituir por autorização real.
6. Criar matriz de contas: professor novo, aluno novo, usuário A, usuário B, visitante e conta sem perfil completo.
7. Só então iniciar correções de RLS, grants e funções privilegiadas.

## 10. Proibições durante este gate

- Não alterar a `.env` para apontar para `xrnf...` sem evidência de produção.
- Não executar migrations em projeto apenas porque está saudável.
- Não tratar `VITE_OWNER_EMAIL` como autorização de backend.
- Não considerar PR em rascunho como função publicada.
- Não registrar chaves completas, tokens ou dados pessoais nos relatórios.
