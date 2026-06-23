# Fase 0 — matriz de gates, flags e armazenamento

Data: 23 de junho de 2026

Fonte: artefato `phase-zero-audit.json` gerado pela CI.

## 1. Gates de proprietário encontrados em `main`

A auditoria encontrou cinco referências a `VITE_OWNER_EMAIL`, todas no fluxo do Super Importador:

| Arquivo | Uso atual em `main` | Decisão | Situação |
|---|---|---|---|
| `src/features/global-import/SuperGlobalImportScreen.tsx` | Seleção do wizard por e-mail | Remover como condição de acesso | Implementado no PR `#154`, ainda não mesclado |
| `src/features/global-import/components/AiPromptPresetSelector.tsx` | Entrevista/prompt guiado exclusivo | Substituir por rollout explícito | Implementado no PR `#154`, ainda não mesclado |
| `src/features/global-import/components/ClassroomCompletePromptCard.tsx` | Prompt completo exclusivo | Substituir por rollout explícito | Implementado no PR `#154`, ainda não mesclado |
| `src/features/global-import/components/GlobalImportJsonSection.tsx` | JSON 2.0 exclusivo | Substituir por rollout explícito | Implementado no PR `#154`, ainda não mesclado |
| `src/features/global-import/components/GlobalImportValidationPreview.tsx` | Agrupamento de erros exclusivo | Substituir por rollout explícito | Implementado no PR `#154`, ainda não mesclado |

### Regra permanente

`VITE_OWNER_EMAIL` pode identificar uma experiência administrativa visual temporária, mas nunca pode ser a única autorização para ler ou gravar dados. Toda gravação precisa ser protegida por RLS, RPC segura ou Edge Function autenticada.

## 2. Classificação dos usos de `localStorage`

O inventário encontrou muitos usos de `localStorage`. Eles não devem ser removidos em massa. A decisão depende da finalidade.

### 2.1 Manter — preferência legítima do dispositivo

Exemplos:

- tema e paleta;
- velocidade de fala e som;
- atalhos de teclado;
- preferências do modo de estudo;
- configurações de desempenho;
- idioma da interface.

Requisito: a perda do valor deve apenas restaurar um padrão seguro, sem conceder acesso nem corromper dados.

### 2.2 Manter com expiração/limpeza — retomada e cache

Exemplos:

- estado de retomada do estudo;
- histórico de visitante;
- manifesto de importação;
- cache offline;
- proteção de boot e recuperação de erro.

Requisitos:

- escopo por usuário, lista ou turma;
- versão do formato;
- expiração ou limpeza explícita;
- tolerância a JSON inválido;
- nunca substituir a fonte oficial do banco.

### 2.3 Fallback técnico temporário

Exemplos:

- escolha entre importador guiado e anterior;
- supersessão de protocolos antigos;
- Safe Mode.

Requisitos:

- rota ou parâmetro explícito deve ter prioridade;
- comportamento deve ser testado;
- não pode conceder autorização;
- deve existir plano para remoção após estabilização.

O fallback do Super Importador está coberto pelo PR `#154`.

### 2.4 Proibido como fonte de autorização

Nenhum valor em `localStorage` ou `sessionStorage` pode definir sozinho:

- papel de professor, aluno ou administrador;
- propriedade de pasta, lista, turma ou card;
- permissão para importar, editar, excluir ou desfazer;
- saldo, compra, prêmio ou transação;
- acesso a dados de outro usuário.

Essas decisões pertencem ao backend.

## 3. Classificação dos usos de `sessionStorage`

Os usos observados concentram-se em:

- recuperação de erro de rota;
- estado temporário do importador;
- aviso de navegador/PWA;
- sincronização de visitante;
- dados transitórios de perfil.

Decisão padrão: manter apenas durante a aba atual, com validação de formato e sem autoridade sobre permissões.

## 4. Feature flags

Foram encontradas 24 flags estáticas em `src/lib/featureFlags.ts`.

### 4.1 Funções habilitadas no código atual

- loja e economia;
- catálogo administrativo;
- caixa de presentes;
- reinos;
- turmas, comunicação e Meus Alunos;
- dicas de palavras;
- glossário;
- imagens de estudo;
- transições;
- heartbeat;
- swipe;
- importador em massa 2.0;
- cards em camadas.

### 4.2 Funções desligadas ou em fallback

- conversão automática;
- diretório;
- gifting;
- jornada;
- modo offline;
- motor inteligente de estudo;
- novo pipeline de status de grupos.

### Regra de promoção

Uma flag só pode ser promovida para fluxo oficial quando:

1. público elegível estiver definido;
2. autorização de backend estiver comprovada;
3. testes de conta nova e isolamento estiverem verdes;
4. fallback e rollback estiverem documentados;
5. deploy estiver confirmado.

## 5. Decisões imediatas

| Tema | Decisão |
|---|---|
| Gates `VITE_OWNER_EMAIL` do Super Importador | Remover por rollout testável; PR `#154` |
| Preferências de estudo em armazenamento local | Manter |
| Retomada/cache | Manter com versão, escopo e limpeza |
| Autorizações em armazenamento local | Proibir |
| Novo pipeline de status | Manter `off` até evidência específica |
| Motor inteligente | Manter desligado até auditoria do motor de jogos |
| Migração para `xrnf...` | Bloqueada até corte controlado |
| Alterações no backend `ymah...` | Bloqueadas sem acesso administrativo |
