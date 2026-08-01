# Inventário técnico de configurações de estudo — 2026-08-01

Este inventário registra os controles encontrados na auditoria. Ele distingue o
estado visual da tela, a intenção de lançamento e o valor persistente; não é uma
autorização para aplicar migrations ou alterar dados remotos.

| Configuração | Componente atual | Modos em que aparece | Estado React | URL | Persistência | Padrão | Escopo correto | Observação |
|---|---|---|---|---|---|---|---|---|
| Direção | `GamesHub`, `GameSettingsModal` | todos os jogos de lista | `effectivePreset.direction`, `flipDirection` | `dir`/`direction` | `user_study_preferences.direction` + cache | `any` | usuário + modo (+ lista quando privado) | URL é intenção explícita; sessão compatível deve prevalecer na retomada. |
| Ordem | `GamesHub`, `GameSettingsModal` | todos | `gameSettings.mode` | `order` quando usado | `order` | `random` | usuário + modo (+ lista quando privado) | Foco Vermelho força fila sequencial durante a sessão. |
| Subconjunto | `GameSettingsModal` | todos | `gameSettings.subset` | `favorites` em lançamentos existentes | `scope`/`favoritesOnly` | `all` | usuário + modo (+ lista quando privado) | Favoritos só podem ser confirmados após o carregamento auxiliar. |
| Foco Vermelho | `GameSettingsModal`, `Study` | modos do engine | `gameSettings.redFocus` | intenção de lançamento quando aplicável | snapshot da sessão; preferência não é globalizada silenciosamente | desligado | sessão da lista + modo | Não deve transformar resposta transitória em lista vazia. |
| Formato | `GameSettingsModal`, `MixedStudy` | todos os modos | `effectivePreset.studyFlowMode` / `selectedFlowMode` | não é inferido por ausência | `study_flow_mode` + `settings_snapshot` | `mastery_rounds` | usuário + modo (+ lista quando privado) | `continuous` percorre a fila uma vez; `mastery_rounds` mantém rodadas. |
| Fast Mode | `GameSettingsModal`, `Study` | Flip quando habilitado | `gameSettings.fastMode` | não | `fast_mode` + snapshot | desligado | usuário + modo (+ lista quando privado) | Opção específica da apresentação do Flip. |
| Play | `GameSettingsModal`, `FlipStudyView` | Flip | runtime `playPresetRuntime` | não | `play_mode`, `play_side` + snapshot | dois lados, lado A | usuário + modo (+ lista quando privado) | O runtime é apenas ponte de renderização; a preferência persistida é a fonte durável. |
| Atividade de escrita | `WriteActivitySettings`, `WriteStudyView` | Escrita | `effectivePreset.writeActivityMode` | não | `write_activity_mode` | `translate` | usuário + modo Escrita | `rewrite` é submodo de Escrita, não uma sessão independente. |
| Lado de reescrita | `WriteActivitySettings` | Escrita/Reescrever | `effectivePreset.writeRewriteSide` | não | `write_rewrite_side` | `alternating` | usuário + modo Escrita | A direção de tradução não deve contaminar esta escolha. |
| Correção | `GameSettingsModal`, `WriteStudyView` | Escrita e Misto | `correctionMode` | não | `write_correction_mode` + snapshot | `flexible` | usuário + modo | Alteração no meio da sessão precisa atualizar o snapshot da sessão. |
| Áudio da lista | `Study`, metadados da lista | Flip e superfícies que exibem áudio | `listSettings.ttsEnabled` | não | metadados da lista | definido pela lista | lista | Não é preset de jogo; permanece configuração do conteúdo. |

## Decisões de escopo

- O preset é identificado por usuário, modo e, quando permitido, override da
  lista; não existe um preset por flashcard.
- A sessão inclui a identidade da lista/escopo, modo, `settings_snapshot`, fila,
  índice, rodada, resultados e camada. O snapshot local é fallback imediato, não
  uma segunda fonte concorrente.
- `Reescrever` continua dentro de `write`; a atividade e o lado são campos
  discriminados do preset de Escrita.
- Opções visuais de áudio da lista não são copiadas para preferências globais de
  jogo.
- A tabela não considera migration aplicada nem prova de RLS/Auth. Essas provas
  continuam pendentes e estão explicitadas no relatório de evidências.
