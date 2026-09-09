# Auditoria funcional — 2026-09-09

Base: main 6f015909 (PR #395). Escopo: importadores, navegação, estudo e mobile; sem redesign.

## Evidência e reutilização

- PR #394, a0a6eaf6/05b28f15, docs/importer-harmony-audit.md: VALIDACÃO RECENTE REUTILIZADA para leitura concorrente do Super Importador e contratos de arquivo, cujos arquivos não mudaram depois. A correção não abrangia ContentIngestDialog; esse consumidor foi revisitado.
- PR #395, 566624b1/6f015909: resultados locais anteriores de 1507 testes e CI reutilizados como baseline, não como prova de browser/IndexedDB. Revisitados salvamento explícito, fila e Mixed por falhas encontradas nesta auditoria.
- Relatórios de agosto em docs/audits/study-persistence-* e study-stability-audit: inventário histórico. Não bastam para validar o código de setembro.
- CI de importação em lista já falhava no main em 2/9 (run 33677043911), com o mesmo erro da PR395 (34307951545): anon podia executar o gateway de turma. O restante do CI da PR395 passou.
- Nenhum resultado unitário abaixo deve ser interpretado como confirmação de gravação no banco publicado.

## Reprodução no Chrome conectado

Home → Biblioteca → criação de pasta → criação de lista → importador: executado.
Criada pasta privada “Auditoria funcional 2026-09-09” e lista “QA — três cards”.
Pasta: 700a150d-83a6-4222-a17b-a2f06b3299ae.
Lista: 3660cbe7-08b1-4d9c-b3a2-81658319fc14.
Não houve exclusão nem alteração de materiais anteriores.

Texto: cat/gato, dog/cão, coffee/café. Preview mostrou 3 recebidos = 3 válidos, preservando acentos.
Confirmação exibia destino correto, append e skip. A tentativa de importar não apresentou relatório de sucesso.
Console: “Account duplicate check failed” e “JWT expired”. Após refresh a lista mostrou “Lista não encontrada”.
Portanto a persistência desses três cards NÃO foi confirmada; não se pode concluir que a lista foi apagada.
Login renovado é necessário para completar essa parte da auditoria. O backend observado pela UI é ymahldldyxvwjeruaxpr.

## Banco gerenciado

Consulta somente leitura a xrnfhhoxmmstagmelvyi confirmou que os dois gateways current já negam EXECUTE a anon e permitem authenticated.
O defeito de grants foi reproduzido pelo CI que reconstrói migrations, não pelo banco gerenciado atual.
study_sessions no gerenciado ainda tem somente campos básicos; não há client_revision/settings_snapshot/session_snapshot/session_scope_key.
Os RPCs persist_study_session_v1, claim_study_session_v1 e record_flashcard_progress_v1 não apareceram na consulta.
Nenhuma migration remota aplicada. Não aplicar em massa as migrations ausentes sem reconciliar o histórico do ambiente.

## Correções

| Severidade | Problema | Correção / evidência |
|---|---|---|
| P1 | Salvamento explícito ao sair sobrescrevia snapshot sem conclusão/rodada | Preserva isFinished, roundNumber, roundResults, unseenCards e missedCards. Regressão do hook exercita chegar ao fim e salvar. |
| P1 | Mixed perdia tentativa após falha remota | Evento com operationId durável antes de enviar; replay ao abrir, ficar online e voltar ao app. |
| P1 | Requeue podia regravar uma cópia antiga sobre revisão nova | Retentativa não reescreve registros; leitores já incluem failed. Teste Chromium com IndexedDB, duas abas e refresh. |
| P2 | Revisão rejeitada era comunicada como confirmação remota | Writer sinaliza conflito quando servidor tem revisão superior; cópia local permanece. Reconciliação interativa ainda pendente. |
| P1 | CSV/glossário descartavam registros incompletos silenciosamente | Entrada inteira rejeitada com posições/linhas; rascunho permanece. Testes válido/acento/parcial inválido. |
| P2 | Importador de lista habilitava busy somente após consulta assíncrona | Trava síncrona antes da consulta; erro capturado; fechamento bloqueado durante importação/undo. |
| P2 | Leitura tardia de JSON substituía texto novo ou modal reaberto | Revisão da leitura invalidada por edição, troca de modo e reset. |
| P2 | Glossário da lista limpava texto mesmo havendo rejeitados | Bloqueia envio parcial; preserva texto e trata rejeição da mutation. |
| P2 | Reino mostrava sucesso/navegava após falhas parciais | Mostra erro parcial e detalhes persistentes; mantém arquivo; trava envio concorrente. |
| P2 | Cancelar Especiais escondia operação em andamento | Modal não fecha durante busy. |
| P2 | Voltar sem histórico não saía de página direta | AppBar usa dashboard como fallback quando não há histórico interno. |
| P2 | Swipe usava / em vez de /dashboard | Alinhado à home privada real. |
| P2 | Barra final em /study/ deixava navegação global sobre jogo | Mesmo reconhecimento de rota no layout e tabbar, com teste dos caminhos e barra final. |
| P1 | Grants diretos anon sobreviviam a REVOKE PUBLIC no gateway de turma | Migration aditiva revoga PUBLIC e anon nos três entrypoints de turma; mantém authenticated. Validação SQL pelo workflow existente. |
| P2 | typecheck não verificava nenhum fonte | Comando agora aponta para tsconfig.app e tsconfig.node; corrigidos os dois erros expostos em Folder/useReinforcement sem cast para esconder incompatibilidade. |
| P2 | Smoke podia aprovar splash cobrindo a tela | Espera boot-loader sair e exige formulário de login; capturas nos três tamanhos. |

## Inventário dos importadores

✅ = executado e validado no escopo indicado; ⚠️ = parcial/não executado no runtime; ❌ = defeito observado, não validado como resolvido no publicado.
Nenhuma célula de persistência é aprovada só porque houve toast.

| Importador | Entrada válida | Erro inválido | Persistência | Mobile | Status |
|---|---|---|---|---|---|
| Super pessoal /import, /import/super (V2/Guided/Owner) | ✅ parsers/testes reutilizados | ✅ contratos/testes | ⚠️ RPC não exercitada no Chrome | ⚠️ | ⚠️ |
| Super de turma /turmas/:id/import/super | ✅ parsers compartilhados | ✅ contratos/testes | ⚠️ grants reconstruídos em CI | ⚠️ | ⚠️ |
| Importar para lista | ✅ Chrome: 3 cards/acento/preview/destino | ✅ parser e bloqueio vazio | ❌ sessão expirada, sem confirmação | ⚠️ | ⚠️ |
| Adaptador legado de coleção | ⚠️ código revisado | ⚠️ | ⚠️ identidade collection/list a verificar | ⚠️ | ⚠️ |
| Glossário de pasta/turma | ✅ parser/teste | ✅ parcial inválido rejeitado | ⚠️ lote remoto não exercitado | ⚠️ | ⚠️ |
| Caixa de glossário da lista | ✅ parser/testes existentes | ✅ rejeitados bloqueiam aplicação | ⚠️ | ⚠️ | ⚠️ |
| Cobertura exata pasta/turma | ⚠️ parser/revisão | ⚠️ | ⚠️ upload aplica merge sem confirmação intermediária | ⚠️ | ⚠️ |
| Revisão semântica de glossário | ⚠️ parser/revisão | ⚠️ | ⚠️ preview separado da aplicação | ⚠️ | ⚠️ |
| Explicações de Especiais (Bridge) | ✅ protocolos/testes existentes | ✅ validação por item existente | ⚠️ operação real não exercitada | ⚠️ | ⚠️ |
| Reino CSV | ⚠️ parser próprio | ⚠️ | ⚠️ relatório parcial corrigido no código | ⚠️ | ⚠️ |
| Sincronizar cards com glossário da turma | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Auxiliares: vídeos e catálogo admin | ⚠️ URLs/pacotes, fora de flashcards | ⚠️ | ⚠️ | ⚠️ | ⚠️ |

Formatos: JSON oficial/canonical/legado; CSV simples/avançado; texto/TSV colado; glossários JSON/texto; Especiais JSON v3/v2/legado e CSV/TXT.
Não foi localizado importador ativo nativo de Excel/XLSX ou pacote Anki/APKG. Não anunciar suporte por inferência.
GlobalImport reexporta o pipeline atual. fileImport e painéis de glossário sem consumidor de produção não entram como importadores ativos.

## Inventário de jogos e configurações

| Jogo | Abre | Joga | Configura | Salva | Retoma | Finaliza | Mobile | Status |
|---|---|---|---|---|---|---|---|---|
| Flip | ⚠️ | ⚠️ | ✅ contratos | ✅ snapshot local | ✅ hook | ✅ hook último card | ⚠️ | ⚠️ |
| Write | ⚠️ | ⚠️ | ✅ contratos | ⚠️ remoto | ✅ hook | ✅ motor comum | ⚠️ | ⚠️ |
| Multiple Choice | ⚠️ | ⚠️ | ✅ contratos | ⚠️ remoto | ✅ hook | ✅ motor comum | ⚠️ | ⚠️ |
| Unscramble | ⚠️ | ⚠️ | ✅ contratos | ⚠️ remoto | ✅ hook | ✅ motor comum | ⚠️ | ⚠️ |
| Mixed via Study | ⚠️ | ⚠️ | ✅ contratos | ⚠️ remoto | ⚠️ browser | ✅ motor comum | ⚠️ | ⚠️ |
| Mixed adaptativo via Hub | ⚠️ | ⚠️ | ✅ contratos | ✅ fila local, ⚠️ remoto | ✅ motor/testes | ✅ motor/testes | ⚠️ | ⚠️ |
| Pronunciation beta | ⚠️ | ⚠️ microfone | ✅ contratos | ⚠️ remoto | ✅ hook | ✅ motor comum | ⚠️ | ⚠️ |

Configurações existentes: continuous/mastery, sequential/random, all/favorites, A→B/B→A/any, Red Focus, Fast Mode, Play both/single e lado A/B.
Write: translate/rewrite, lado A/B/alternado, correção flexível/rigorosa.
Mixed via Study inclui Flip; Mixed adaptativo usa Write/Multiple Choice/Unscramble. Não unificados nesta tarefa.
Ordem e ID de sessão/presets têm testes existentes; testes simulados não comprovam a experiência completa de cada modo no dispositivo.

## Navegação, mobile e limites

Navegação real executada: Home→Biblioteca→Pasta→Lista→Importador; refresh com erro de autenticação descrito acima.
Preview Safety Gate ampliado: 16 casos (7 desktop/erros e health/landing/auth em 360x800, 390x844, 412x915), capturas depois do splash. O primeiro resultado anterior à correção da espera não é evidência visual válida.
Não confundir esses casos com QA completo autenticado. Android físico, PWA, microfone e teclado virtual não foram validados.
PWA está desativada na configuração atual.

## Pendências explícitas

- Login privado não preserva deeplink em todos os caminhos; requer ajuste coordenado de guard, formulário e OAuth, com teste autenticado. Não alterado às cegas.
- Replace de glossário em vários lotes não é uma transação global. Uma falha posterior pode deixar lote anterior aplicado. Exige contrato transacional/recuperação antes de afirmar atomicidade.
- Coleção passa ID a um adaptador de lista; identidade precisa ser esclarecida antes de mudar.
- Especiais ainda precisa teste de leitura/validação concorrentes; bloqueio do fechamento não resolve todas as corridas.
- Capacidade admin desatualizada e JWT expirado impedem aprovação de persistência remota completa. Nenhuma correção de segurança/RLS de alto risco feita.
- Publicação Lovable e aplicação de migration não são comprovadas por merge.

## Validação desta entrega

Typecheck real dos dois projetos: passou. Suíte ampla: 240 arquivos / 1511 testes aprovados. Lint: 0 erros, 72 avisos. Build completo com pré-render, privacidade, bundle e SEO: passou.
O runtime local não possui npm; executados os entrypoints correspondentes e todos os passos do script build. CI executará os comandos npm reais com instalação limpa.
Script study-outbox-smoke: passou em Chromium real (duas abas, reload, isolamento, confirmação antiga e remoção idempotente). Adicionado ao CI.
Preview final: 16/16 casos aprovados, com splash removido e formulário visível. Captura auth 360x800 inspecionada visualmente.
Primeiro CI expôs também grant direto em helper privado; migration ampliada aos quatro helpers previstos no teste de segurança existente. Workflow list-markers usava Node 20, incompatível com WebSocket nativo exigido pela dependência Supabase atual; alinhado ao Node 22 dos outros workflows.
As migrations foram reconstruídas pelo CI sem alteração do banco remoto.
Novos testes: snapshot de conclusão no save explícito, rejeição de glossário parcial, rejeição de CSV incompleto, rota mobile com barra final, script real de IndexedDB.
Rollback: revert do PR de código; migration só restringe execução anônima e não apaga dados. Não restaurar acesso anônimo como rollback automático.
