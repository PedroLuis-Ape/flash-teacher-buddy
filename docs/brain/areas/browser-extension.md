---
category: architecture
area: extension
cssclasses:
  - ape-ai-note
type: area
domain: extension
status: active
priority: high
last_reviewed: 2026-09-13
related:
  - "[[01-CURRENT-STATE]]"
  - "[[04-DECISIONS]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[12-PROCESS-LOG-2026-09-12]]"
  - "[[imports/2026-09-11/App-Piteco-Brain/12-BROWSER-EXTENSION]]"
  - "[[imports/2026-09-11/App-Piteco-Brain/areas/extension]]"
  - "[[imports/2026-09-11/App-Piteco-Brain/10-IMPORT-EXPORT]]"
---

# Extensão Salvar nas Notas

## Objetivo

O checkout operacional da extensão continua em
`C:\Users\pedro\Documents\Codex\2026-05-09\salvar-nas-notas`.

O App Piteco é dono do schema e dos builders oficiais de importação. A
extensão apenas salva notas localmente, oferece pronúncia e monta um pacote
para o aluno usar em uma IA externa.

## Função Criar flashcards com IA

[VERIFIED-REPO] O painel `notes.html` possui a ação **Criar flashcards com
IA**. Ela usa notas marcadas quando existirem e permite escolher notas visíveis
ou todas as notas textuais.

Fluxo:

NOTAS LOCAIS
→ pacote preparado localmente
→ aluno cola em ChatGPT/DeepSeek/Gemini
→ IA gera `app-piteco-super-import` 2.0
→ aluno importa em `/import/super`
→ estudo

Nada é enviado automaticamente para IA, App Piteco ou servidor do
desenvolvedor.

## Formato exportado

O arquivo `ape-ai-flashcard-request.txt` contém:

- identificação `APE_AI_FLASHCARD_REQUEST`;
- contrato e rota de destino;
- escopo e contagem de notas;
- preferências de idioma, tradução, nível, quantidade e preset;
- notas textuais sem URL, título, data ou imagem;
- prompt oficial do App Piteco;
- regras pedagógicas e de glossário;
- instrução final de saída JSON.

O aluno pode revisar, copiar ou baixar exatamente o mesmo conteúdo.

## Fonte única do prompt

[VERIFIED-REPO] O snapshot é gerado no checkout da extensão por
`tools/sync-ape-ai-contract.mjs`. O script carrega diretamente os builders do
App Piteco em `src/features/global-import/prompts/presets.ts` e o schema rico
em `src/features/smart-import/schema.ts`.

O artefato `ape-ai-contract.generated.js` registra:

- schema `app-piteco-super-import`;
- versão `2.0`;
- commit-fonte do App Piteco;
- hash dos arquivos-fonte;
- hash e texto dos presets `batch`, `detailed` e `complete`;
- regras oficiais de glossário contextual.

Comandos de proteção:

```bash
node tools/sync-ape-ai-contract.mjs --check
node tools/validate-official-contract.mjs
node tools/test-ai-export.cjs
```

A extensão não copia Zod nem cria um schema JSON paralelo.

## Glossário e layered cards

O preset completo permite cards normais, `glossary` dentro das listas,
`word_hints` contextuais, explicações, exemplos, notas de uso e erros comuns.
O pacote exige `scope`, `kind`, `expression` e `segments` quando aplicáveis.

O Super Importador atual gera somente cards normais. Interpretações úteis são
cards separados; a mesclagem em camadas continua manual na tela da lista.

## Permissões e privacidade

[VERIFIED-REPO] Permissões obrigatórias: `activeTab`, `contextMenus`,
`scripting`, `storage`, `tts` e `unlimitedStorage`.

[VERIFIED-REPO] O mini pop-up automático é um `content_script` declarado para
`http://*/*` e `https://*/*`, com `browser-tts.js` e `content.js`. Não existe
uma chave separada de `host_permissions`.

Esse acesso é um requisito técnico da função principal: o Chrome não permite
observar automaticamente a seleção em qualquer site apenas com `activeTab`.
O menu de contexto permanece como alternativa, mas a captura automática não
pode ser opcional sem quebrar o fluxo esperado pelo aluno.

## Testes

[VERIFIED-RUNTIME] O pacote 1.8.0 foi carregado em Chromium com Manifest V3.
Os fluxos de painel, persistência, lixeira, edição, TTS, exportação TXT e
exportação para IA passaram. O content script estático apareceu automaticamente
em uma página HTTP sem toggle ou permissão adicional.

[VERIFIED-REPO] O exemplo de referência do prompt completo passou pelo schema
oficial `smartImportPackageSchema`.

[VERIFIED-TEST] O motor `browser-tts.js` usa `speechSynthesis`, favorece vozes
naturais/online, usa uma voz local do navegador quando não houver remota e cai
para `chrome.tts` quando o navegador não oferece vozes.

[VERIFIED-REPO] A preferência é sempre normalizada para natural; uma seleção
antiga de voz do sistema não consegue inverter a prioridade do navegador.

[VERIFIED-REPO] O idioma padrão é `en-US`. Em modo automático, o texto é
detectado antes da fala; pistas locais reforçam textos curtos em português,
espanhol, francês, alemão e italiano.

[VERIFIED-REPO] Play, pausa e retomada usam o estado de `speechSynthesis`.
O mini pop-up mantém os dois controles e o painel alterna **Pausar voz** e
**Retomar voz**.

[VERIFIED-REPO] O watchdog de início é cancelado quando a fala começa, o estado
volta a `idle` em timeout e o fallback não reinicia uma fala que já produziu
conteúdo. O módulo de voz também é idempotente para não apagar subscribers.

[HISTORICAL] A tentativa de tornar o mini pop-up opcional nas versões 1.6.3 e
1.6.4 quebrou a experiência: o Chrome preservava a permissão antiga, mas o
registro dinâmico não era ativado. A abordagem foi abandonada em 1.7.0.

[VERIFIED-REPO] O ícone oficial novo usa o mascote APE. Os PNGs de 16, 32, 48
e 128 px foram gerados localmente; `icons/icon-master.png` é a fonte e não é
incluída na distribuição.

[PENDING] Importação autenticada real não foi executada, para não escrever no
banco de produção. A validação foi limitada ao schema e ao parser oficial.

## Riscos

- A política pública em
  `public/privacy/piteco-notes.html` precisa ser publicada pela Lovable antes
  do envio final à Chrome Web Store.
- O `content_script` amplo exige justificativa clara na Chrome Web Store,
  porque a função automática não possui alternativa compatível com `activeTab`.
- A migration `20260910154058_preserve_contextual_word_hints.sql` precisa
  estar aplicada no backend antes de aceitar todos os campos contextuais.
- O snapshot é atualizado por ferramenta local; se o builder do App Piteco
  mudar sem regenerar o artefato, `--check` deve bloquear o pacote.
- `unlimitedStorage` permanece uma permissão ampla, justificada pela
  preservação das notas, mas ainda pode gerar pergunta na revisão da loja.

## Pacote verificado

[VERIFIED-RUNTIME] O artefato final desta rodada é
`C:\Users\pedro\Downloads\Salvar-nas-Notas-v1.8.0.zip`.

`manifest.json` está na raiz, não há `.git`, `node_modules`, secrets, tools ou
documentação interna no ZIP. SHA-256:
`4610cc616cfc8057d2b97132b3f6d75f7ecba5c21bf0d897d22718727434a97c`.

## Próximo passo

1. Publicar a política de privacidade atualizada pela Lovable.
2. Validar uma importação autenticada com um pacote gerado por IA.
3. Enviar `Salvar-nas-Notas-v1.8.0.zip` à Chrome Web Store.

## Integração App Piteco ↔ extensão 1.9.0 — 2026-09-13

[FATO CONFIRMADO] O app detecta a extensão por mensagem externa
(`chrome.runtime.sendMessage(<EXTENSION_ID>, { type: "PITECO_EXTENSION_PING" })`)
com timeout curto; canal ausente, erro do canal ou timeout contam como "missing"
(não instalada) e nunca lançam.
[POSSIVELMENTE OBSOLETO — corrigido em 2026-09-13] A redação anterior dizia que
"ausência de `chrome.runtime` (Firefox/Safari/mobile) é tratada como 'unsupported'".
Isso confundia compatibilidade de navegador com canal externo; ver a seção
"Compatibilidade decidida pelo navegador, não por `chrome.runtime`" no fim desta nota.

[DECISAO VIGENTE] Configuração única em `src/features/browser-extension/extensionConfig.ts`:
`EXTENSION_ID` (`gomkkomamhecmmomcpjmioikjadpddnh`), `WEB_STORE_URL` sem UTM,
`SHOW_DELAY_MS` 5 s, `AUTO_DISMISS_MS` 15 s, `SNOOZE_DURATION_MS` 7 dias.

[DECISAO SUBSTITUIDA em 2026-09-13] O convite era montado só no shell autenticado
(`PrivateShell`) e exigia login — inalcançável na landing pública.
[DECISAO VIGENTE] Existe UM convite: `src/features/browser-extension/ExtensionInstallPrompt.tsx`,
com UM ponto de montagem (`BrowserExtensionPromptMount`, em `GlobalLayout`). A landing pública
é elegível SEM login; o app autenticado continua elegível; rotas de estudo em tela cheia e
Safe Mode suprimem o convite. Superfície e gates vivem em `extensionPromptPolicy.ts`.
Não renderiza nada durante a espera (sem elemento invisível focável), tem X com `aria-label`
e o CTA apenas abre a Chrome Web Store em nova aba (`target="_blank"`, `rel="noopener noreferrer"`).
O app NUNCA instala a extensão.

[DECISAO VIGENTE] Persistência local, sem Supabase: `piteco_extension_prompt_dismissed_until`
(localStorage, snooze de 7 dias no X) e `piteco_extension_prompt_seen_session`
(sessionStorage, visto na sessão). O auto-dismiss NÃO gera snooze.

[DECISAO VIGENTE] A extensão ganhou `externally_connectable` apenas com
`https://apeeducation.org/*` e `https://www.apeeducation.org/*` e um listener
`chrome.runtime.onMessageExternal` que responde somente ao ping, validando `sender.origin`
com fallback para `sender.url`. Sem canal genérico e sem novo `host_permissions`; o
empacotador passa a falhar se alguém ampliar esse contrato.

[VERIFIED-RUNTIME] Pacote 1.9.0 gerado por `tools/package-chrome-web-store.mjs` (valida
manifest, ícones e ausência de código remoto): 17 arquivos, `manifest.json` na raiz,
SHA-256 `3a9eabbd66cdd299c233d745e3a8929984ae2326bb33e5646a9a6a14e536462c`. Release em
`salvar-nas-notas-extension-1.9.0.zip` na raiz do checkout da extensão.

[FOLLOW-UP] O ambiente tem duas cópias da extensão: o checkout operacional (1.9.0) e a
cópia legada versionada no repositório do app (`browser-extension/ape-pronunciation-notes`,
1.0.0 "APE Pronúncia e Notas"), ainda coberta pelo contrato de teste. Não foram unificadas.

[PENDING] QA ponta a ponta no navegador real (instalar pela loja e ver o convite desaparecer
ao voltar o foco) não foi executado; a garantia atual é de contrato + unidade.

Related: [[sessions/2026-09-13-extensao-salvar-nas-notas]] · [[07-TESTS]] · [[08-RISKS]]

## Correção — convite elegível na landing pública (2026-09-13)

[DECISAO SUBSTITUIDA] O convite não pode depender de login. Antes desta rodada ele
existia apenas em `PrivateShell` e exigia a prop `authenticated`, então o visitante
da landing nunca o via (o ping da extensão nem era disparado).

[DECISAO VIGENTE] Superfície e elegibilidade ficam em
`src/features/browser-extension/extensionPromptPolicy.ts`:

- `public-landing` — `/` e `/landing`, elegível SEM autenticação;
- `authenticated-app` — rotas privadas autenticadas;
- `null` — outras páginas públicas, rotas de estudo em tela cheia e Safe Mode.

[DECISAO VIGENTE] Existe UM ponto de montagem,
`src/features/browser-extension/BrowserExtensionPromptMount.tsx`, chamado uma vez por
`GlobalLayout`. Não montar o convite em `PublicShell`/`PrivateShell` de novo.

[VERIFIED-REPO] Os 7 gates auditáveis são `extensionDetected`, `browserCompatible`,
`isDesktop`, `authenticated` (diagnóstico, NÃO gate), `snoozeActive`,
`seenThisSession` e `finalEligibility`, com `reasonNotShown` explicando a primeira
barreira. Em desenvolvimento o snapshot sai em `window.pitecoExtensionPromptDebug`.

[VERIFIED-TEST] Cobertura: `extensionPromptPolicy.test.ts` (matriz dos gates e das
superfícies), `extensionIntegration.test.tsx` (A..J, K1–K5 na landing e M1–M5 de
montagem única) e `browserExtension.contract.test.ts` (exatamente um ponto de montagem
em `src`).

Related: [[sessions/2026-09-13-convite-extensao-landing-publica]] · [[06-BUGS]] ·
[[learning/lessons/2026-09-13-gate-auth-em-superficie-publica]] · [[07-TESTS]]

## Compatibilidade decidida pelo navegador, não por `chrome.runtime` (2026-09-13)

[DECISAO SUBSTITUIDA] O veredito `browserCompatible` vinha de `env.extensionMessaging`
(existência de `chrome.runtime.sendMessage`), tanto em `ExtensionInstallPrompt.tsx` quanto em
`detectExtensionCompatibility`. Em uma página comum esse canal só existe quando ALGUMA extensão
instalada declara `externally_connectable` para aquele domínio — ou seja, ele falta exatamente
na persona-alvo do convite (Chromium desktop SEM a extensão). Consequência medida: veredito
`browser-incompatible` e o convite nunca aparecendo em produção, apesar de toda a correção de
superfície/login.

[DECISAO VIGENTE] `detectExtensionCompatibility` (`extensionStatus.ts`) decide por sinais de
navegador: `navigator.userAgentData.brands` provando Chromium (`Chromium`, `Google Chrome`,
`Microsoft Edge`, `Opera`, `Brave`, ...) e, sem Client Hints, token de user-agent
`Chrome|Chromium|Edg|OPR|SamsungBrowser`; exclusão explícita de mobile
(`userAgentData.mobile` com fallback de UA Android/iPhone) e de Gecko/WebKit puro (Firefox/Safari);
fail-closed para navegador não reconhecido. `chrome.runtime` deixou de ser gate: é apenas o meio de
DETECTAR a extensão (ping de 1,2 s). Canal ausente, erro do canal ou timeout → `missing` →
elegível, sujeito a snooze de 7 dias e à marca de sessão.

[VERIFIED-TEST] `extensionCompatibility.test.ts` (matriz de marcas/UA/mobile) e cenários L1–L5 em
`extensionIntegration.test.tsx`: Chromium desktop sem `chrome.runtime` → compatível + `missing` +
elegível; canal com ping válido → `installed` + oculto; canal com erro/timeout → `missing` +
elegível; Firefox/Safari/mobile → não elegível.

[DECISAO VIGENTE] Guarda do ponteiro de retomada restaurada na camada comum
(`useStudyResumePublisher.deckReady`): o Study publica com `cardsOrder.length > 0` e a Prática
Mista com `state.allCardIds.length > 0`. Deck vazio (sessão ainda carregando) não publica mais
ponteiro de sessão vazia.

Related: [[07-TESTS]] · [[06-BUGS]] · [[08-RISKS]]
