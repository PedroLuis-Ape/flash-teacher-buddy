# Recuperação de sessões — ST-empty-order

## Diagnóstico e comportamento anterior

Na base 8c50b012, useStudyEngine validava filas contra o deck antes de aplicar
settings_snapshot. Sessões solicitadas com fila/snapshot inválido terminavam em
erro, sem reparação. chooseNewestStudySnapshot aceitava um snapshot local de
outra sessão quando o remoto era inválido. A filtragem de IDs removidos não
reconciliava a posição pelo prefixo da fila original.

Além disso, initializeSession invalidava a geração e abortava requisições antes
de verificar se a renderização era equivalente. O caminho deckReady=false
limpava a assinatura concluída, permitindo uma reidratação antiga após refetch.
Salvamentos contínuos atualizavam session_snapshot sem atualizar cards_order;
o debounce lia a identidade da sessão quando disparava, após capturar progresso
de uma renderização anterior.

Estas são causas verificadas no código e reproduzidas em testes. Não foi
possível atribuir o screenshot a uma linha específica de produção.

## Regra e alterações

- Consulta exata por usuário/lista/modo/sessionId; settings são aplicadas após
  o preset inicial e antes da validação do deck. Sessão inexistente não cria outra.
- restoreStudySession centraliza snapshot remoto, coluna cards_order, cópia
  local da mesma sessão e reconstrução. Preserva repetições válidas, normaliza
  índices e reconcilia exclusões pelo prefixo sobrevivente. Novos IDs vão ao fim.
- Sem fila recuperável, usa respostas conhecidas para posicionar cards já
  respondidos antes do cursor; sem evidência por ID, limita o índice salvo.
  Não existe como provar a ordem histórica aleatória quando todas as cópias se perderam.
- Mastery mantém o sanitizador existente e reconstrói estado inválido preservando
  IDs dominados, contadores válidos e resultados de rodada compatíveis.
- Reparos persistem na mesma linha, com ambas as representações da fila. Erros
  de sincronização são comunicados; o snapshot local permanece recuperável.
- Retry refaz a consulta e a restauração; iniciar sessão nova continua uma ação
  explícita. O parâmetro da sessão é preservado para reload da sessão exata.
- Salvamentos vazios ativos são bloqueados no repositório e no writer, inclusive
  Prática Mista. Gravações após mudança de identidade/geração são descartadas.
- Nenhuma mudança visual, migration, Auth, project ref ou RLS.

Arquivos centrais: useStudyEngine.ts, restoreStudySession.ts,
studySessionSnapshot.ts, requestedStudySession.ts, studySessionRepository.ts,
Study.tsx e MixedStudy.tsx. React Test Renderer 18.3.1 foi adicionado somente
como dependência de desenvolvimento para exercitar o ciclo real dos hooks.

## Evidências

- Vitest completo: 237 arquivos, 1.488 testes aprovados.
- Testes novos: recuperação pura e ciclo React de responder/salvar/desmontar/
  remontar, identidade, fallback local, consulta lenta, retry, refetch sem rewind,
  alteração de deck, conclusão e nova sessão explícita.
- npm run build: aprovado, incluindo pré-renderização e orçamento de bundle.
- tsc --noEmit (comando do projeto): aprovado.
- tsc -p tsconfig.app.json --noEmit: dois erros preexistentes em
  useReinforcement.ts:74 e Folder.tsx:135, reproduzidos em checkout limpo da main.
- ESLint dos arquivos envolvidos: zero erros; 13 avisos existentes nas páginas.
- Diagnóstico SQL somente leitura em xrnfhhoxmmstagmelvyi: study_sessions
  não tem session_snapshot/settings_snapshot/session_scope_key. AGENTS.md
  distingue este projeto administrativo de ymahldldyxvwjeruaxpr, que contém
  dados de produção. A consulta ao segundo foi recusada pelo conector.

## Limites e rollback

Os testes de ciclo React usam transporte e armazenamento controlados. Não são
prova de teste manual mobile, de concorrência entre abas reais ou da sessão
afetada na conta de produção. É necessário validar essa sessão após publicação
pela Lovable. Nenhuma escrita remota no banco foi feita nesta correção.

Rollback: reverter o commit de código. Não há migration a desfazer; os snapshots
continuam versão 2 e os novos metadados locais são campos opcionais.
