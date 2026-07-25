# Plano: Formatos de Sessão + Reorganização das Configurações

## Parte 1 — Motor de fluxo de sessão

### Arquitetura
Motor puro e determinístico, isolado da UI, para ambos os modos (Escrever e Misto):

- `src/features/study/lib/studySessionFlow.ts`
  - Tipos: `StudyFlowMode = "mastery_rounds" | "continuous"`, `StudyCardResult`, `MasterySessionState`, `RoundSummary`.
  - Funções puras: `createMasterySession(ids, {roundSize:15, shuffle})`, `recordResult(state, cardId, result)`, `advanceCard(state)`, `startNextRound(state)`, `isSessionFinished(state)`, `buildContinuousQueue(ids, shuffle)`.
  - `MASTERY_ROUND_SIZE = 15` constante.
- `src/features/study/lib/studySessionFlow.test.ts` — 17 casos exigidos.
- `src/features/study/hooks/useStudySessionFlow.ts` — adapter React (estado + `report(result)` + `advance()` + `roundSummary`).

### Fila de erros (rodadas de domínio)
1. Ao final da rodada, `retryIds = [...incorretos, ...pulados, ...revelados]` (menos os que depois foram acertados).
2. Próxima rodada = `retryIds.slice(0,15)` na frente + vagas restantes preenchidas com `unseenIds`.
3. `retryIds` restantes ficam na fila para rodadas futuras.
4. Enquanto houver ≥15 pendentes, nenhum card novo entra.
5. Sessão termina só quando `unseenIds.length===0 && retryIds.length===0 && !currentCard`.

### Identidade dos cards
Usa o ID canônico já usado pelo runtime atual (não texto, não layer id). Garantia via `Set` para não duplicar dentro da mesma rodada.

### Fluxo Contínuo
- Uma passagem única sobre os IDs elegíveis. `incorrect`, `skipped`, `revealed` **não** reinserem.
- Nenhuma rodada, nenhum modal de "próxima rodada".

### Integração
- `WriteStudyView.impl.tsx`: reporta `correct` (inclui aceite em Flexível), `incorrect`, `skipped`, `revealed` ao hook.
- Modo Misto (componentes usados por `MixedStudy.tsx`): cada minijogo reporta um único resultado ao mesmo hook. Selecionar tipo de exercício não altera o ID.
- Modo de correção (Flexível/Hard) permanece separado — decide o resultado; o motor decide reinserção.

### Filtros existentes
- "Apenas Favoritos" filtra IDs antes de entrar no motor.
- "Foco Vermelho": força `continuous` + sequencial na sessão atual; **não persiste**; ao desligar, restaura preferência anterior. Explicação visível no modal.

### UI de progresso
- `StudyRoundProgress.tsx` — barra/linha discreta:
  - Domínio: `Rodada N · x de 15 · y para revisar · z de total dominados`.
  - Contínuo: `x de total`.
- `StudyRoundSummary.tsx` — modal ao fim de cada rodada: contagens + botões `Próxima rodada` / `Encerrar por agora`.
- Modal atual de conclusão total é reaproveitado; só dispara quando o motor sinaliza fim real.

## Parte 2 — Reorganização de "Configurações da Sessão"

Um único `Dialog`, com máquina de estado interna (`page: "home" | "flow" | "direction" | "correction" | "order" | "audio"`).

Novo layout de arquivos:

- `src/features/study/components/settings/SessionSettingsHome.tsx` — lista de categorias com resumo do valor atual.
- `src/features/study/components/settings/StudyFlowSettings.tsx` — Rodadas de Domínio vs Fluxo Contínuo (só Escrever/Misto).
- `src/features/study/components/settings/PracticeDirectionSettings.tsx` — move os controles de direção do modal atual.
- `src/features/study/components/settings/WriteCorrectionSettings.tsx` — Flexível/Hard (só Escrever/Misto).
- `src/features/study/components/settings/OrderAndFilterSettings.tsx` — Ordem aleatória, Apenas Favoritos, Foco Vermelho, outros.
- `src/features/study/components/settings/AudioAndPaceSettings.tsx` — velocidade, autoplay, Fast Mode etc. (após auditar o que existe hoje).
- `GameSettingsModal.impl.tsx` vira o container do Dialog + roteador interno; a lógica sai para as subpáginas.

Sub-header comum: seta voltar + título + X. Página home cabe sem scroll (~5 linhas). Categorias condicionais: Formato/Correção só em Escrever e Misto. Desktop 600–760px, mobile quase full-screen, targets ≥44px, foco preservado.

## Persistência

Amplia o objeto de preferências existente (`studyPreset` / `useStudyPreferences`):
- adiciona `studyFlowMode: "mastery_rounds" | "continuous"` (default `mastery_rounds`).
- respeita camadas atuais: global → override por lista → URL param (temporário) → cache convidado.
- **Sem migration** — o schema atual em `user_study_preferences` / `user_list_study_preferences` aceita um novo campo dentro do payload normalizado; se o repositório exigir uma coluna, adiciono coluna `flow_mode` **nullable** com default local; decidido durante a auditoria do repositório antes de codar. Estado transitório da rodada nunca vai ao banco.

## Testes

- Motor: 17 casos exigidos em `studySessionFlow.test.ts`.
- Preferências: estender `useStudyPreferences.test.ts` para cobrir persistência do `studyFlowMode` e override de Foco Vermelho não-persistente.
- UI: teste do roteador interno do modal (home → subpágina → back), visibilidade condicional de Formato/Correção.

## Validação

`npm run typecheck && npm run test && npm run lint && npm run build` no fim.

## Restrições respeitadas

Sem alteração em Auth/RLS, sem scheduler duplicado, sem identificar por texto, sem duplicar card em rodada, sem confundir fim de rodada com fim de sessão, sem remover opções, sem dialog sobre dialog, sem IA/API externa, sem alterar Flip/MC/Organizar/Pronúncia individualmente.

## Arquivos previstos (alteração/criação)

Criar:
- `lib/studySessionFlow.ts` + `.test.ts`
- `hooks/useStudySessionFlow.ts`
- `components/StudyRoundProgress.tsx`
- `components/StudyRoundSummary.tsx`
- `components/settings/{SessionSettingsHome,StudyFlowSettings,PracticeDirectionSettings,WriteCorrectionSettings,OrderAndFilterSettings,AudioAndPaceSettings}.tsx`

Alterar:
- `components/GameSettingsModal.impl.tsx` (vira container/roteador)
- `components/WriteStudyView.impl.tsx` (reporta resultados ao motor)
- `pages/Study.tsx` e `pages/MixedStudy.tsx` (usam `useStudySessionFlow`, exibem progress/summary)
- `preferences/studyPreset.ts` + `studyPreferenceRepository.ts` + `useStudyPreferences.ts` (novo campo `studyFlowMode`)
- Integração do Foco Vermelho no ponto onde ele hoje força regras

## Execução

Ordem: (1) auditar arquivos listados; (2) motor + testes; (3) preferências; (4) hook + integração Escrever; (5) integração Misto; (6) UI progresso + resumo de rodada; (7) reorganizar modal em subpáginas; (8) Foco Vermelho override; (9) rodar typecheck/test/lint/build.

Aprovar para começar?
