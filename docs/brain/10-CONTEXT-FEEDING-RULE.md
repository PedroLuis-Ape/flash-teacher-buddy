---
category: documentation
cssclasses:
  - ape-ai-note
aliases:
  - START-HERE
  - PROTOCOLO-DE-CONTEXTO
type: protocol
status: active
area: knowledge-management
last_reviewed: 2026-09-13
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[03-ARCHITECTURE]]"
  - "[[04-DECISIONS]]"
  - "[[06-BUGS]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[09-ASTRA-HANDOFF]]"
  - "[[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]]"
  - "[[27-CONTEXT-PACKET-E-TELEMETRIA]]"
  - "[[areas/visual-polish]]"
  - "[[areas/motion-system]]"
  - "[[areas/adaptive-learning]]"
  - "[[areas/supabase-runtime]]"
  - "[[12-PROCESS-LOG-2026-09-12]]"
  - "[[README]]"
---

# START HERE — Protocolo de contexto do App Piteco

## Fechamento de sessão (formato)

Toda tarefa que mudou o estado durável do projeto termina com uma entrada curta e datada em **FECHAMENTOS**,
no topo de [[01-CURRENT-STATE]], neste formato:

`### FECHAMENTO <AAAA-MM-DD>` · **Finalizado** · **Pronto até** · **Não entrou** ·
**Em espera por decisão** (ou **Depende de**).

O objetivo é econômico: um agente novo lê **um bloco** e sabe onde o projeto
parou, sem varrer o vault. Detalhe longo continua nas notas de sessão linkadas;
aqui fica só o estado datado. Se uma informação antiga ficar incorreta, atualize
a entrada existente — não empilhe versões contraditórias.

Esta é a nota central permanente para qualquer trabalho relacionado ao App
Piteco / APE Education. Ela é uma rota de entrada e uma regra de operação; não
é um substituto para as notas profundas de arquitetura, áreas, decisões,
bugs, testes, riscos ou handoff.

## Regra estrutural — leitura condicional

Política canônica (fonte única, não duplicar): `C:\Users\pedro\.codex\policies\second-brain-policy.md`.

Consultar a memória **não é o primeiro passo de toda tarefa**. Níveis:

1. **0 — simples/local** (CSS, texto, tipagem, lint, teste, erro evidente): não consultar; não gravar.
2. **1 — normal**: no máximo o índice [[00-HOME]]; não abrir automaticamente o que ele aponta.
3. **2 — sistema conhecido** (persistência, flashcards, auth, importação, banco, arquitetura, progresso,
   gamificação): índice → 1 ou poucas notas do domínio → parar quando houver contexto suficiente.
4. **3 — exige histórico** (decisão arquitetural, bug dependente de histórico, contradição, retomada
   antiga): busca direcionada com `rg`, somente o que responde à pergunta atual.

Regras de custo sempre válidas: nunca ler o vault inteiro nem seguir referências recursivamente por
reflexo; **busca antes de leitura** (localize o termo e abra só o arquivo/trecho útil); nota grande se
lê por trecho — de [[01-CURRENT-STATE]] (60+ KB) use apenas o bloco **FECHAMENTOS** mais recente;
`brain-manifest.json` (~70 KB) é artefato derivado e se consulta por filtro, nunca integralmente.

O caminho operacional confirmado do vault externo é
`C:\Users\pedro\Documents\App-Piteco-Brain`. O nome
`C:\Users\pedro\Documents\App-Piteco-Braine` não existe e não deve originar
uma segunda estrutura.

## READ ONCE -> COMPACT -> SHARE -> REUSE (regra de custo de contexto)

Regra vigente para eliminar releitura redundante do Segundo Cérebro dentro da
MESMA tarefa. Schema do packet, comandos e telemetria estão em
[[27-CONTEXT-PACKET-E-TELEMETRIA]].

1. **READ ONCE** - quando a tarefa exigir memória, consultar uma única vez, pelo caminho mais estreito:
   o índice [[00-HOME]] e, no máximo, as notas do domínio afetado. O manifesto
   `docs/brain/brain-manifest.json` é artefato derivado e grande: consulte por filtro, nunca integralmente.
2. **COMPACT** - transformar a leitura em um CONTEXT PACKET compacto
   (`node scripts/context-packet.mjs new`): objetivo, regras relevantes,
   arquitetura, contratos, decisões, riscos, arquivos, invariantes e incertezas
   abertas, mais PONTEIROS com `sha256` para as notas relevantes. O packet não
   copia o vault e não substitui o código/Git.
3. **SHARE** - entregar o MESMO packet às etapas seguintes (worker, reviewer,
   correção), sempre com o mesmo `brain_version` e `packet_hash`.
4. **REUSE** - quem já recebeu um packet válido NÃO refaz o preflight completo.
   Presume o packet válido até evidência contrária
   (`context-packet validate`) e só busca contexto quando faltar informação
   material.

### Invalidação

O packet só é invalidado ou rebaseado por mudança MATERIAL:

- objetivo ou escopo da tarefa mudou;
- alguma nota referenciada pelo packet mudou (`REF_CHANGED`) ou deixou de
  existir (`REF_MISSING`);
- contrato, decisão ou risco referenciado mudou;
- domínio/área da tarefa mudou.

Nunca invalidar por minutos decorridos, por ansiedade ou por "reler para ter
certeza": drift global do vault (nota que o packet não referencia) é reportado
como `DRIFT` e não obriga reconstrução.

### Retrieval sob demanda

Faltou informação material:

1. ler **UMA** nota (`context-packet read --note-path <nota>`);
2. **PATCH** do packet (`context-packet patch --reason "<motivo>"`) para que o
   próximo agente não repita a leitura;
3. continuar a execução, no mesmo `brain_version`.

Reler o vault inteiro ou reconstruir o packet como resposta a uma lacuna
pontual é proibido.

### Papéis

- **MAIN**: lê uma vez, cria e compartilha o packet, decide invalidação.
- **WORKER**: executa a partir do packet; não refaz preflight; lacuna pontual =
  uma nota + patch.
- **REVIEWER**: recebe objetivo, regras relevantes, diff, testes, evidências e
  riscos pelo packet e NÃO relê o vault inteiro; busca UMA nota quando o fato
  material não estiver coberto.
- **CORREÇÃO / SEGUNDA REVISÃO**: continuam do mesmo packet patchado.

### Fechamento

No fim da tarefa, atualizar apenas conhecimento durável na nota-fonte correta,
sem reabrir o vault inteiro. O custo de contexto da tarefa fica no ledger
`.superpowers/sdd/brain-telemetry.jsonl` e é lido com
`node scripts/brain-telemetry.mjs report`.

## Como recuperar contexto sem desperdiçar contexto

Quando a memória for necessária, comece pelo índice [[00-HOME]]. Para estado/retomada, leia apenas o
bloco **FECHAMENTOS** mais recente de [[01-CURRENT-STATE]] — não o arquivo inteiro. Depois use as
palavras-chave da tarefa para seguir somente o subgrafo necessário:

- comportamento/arquitetura → [[03-ARCHITECTURE]] → [[04-DECISIONS]];
- bug ou regressão → [[06-BUGS]] → [[08-RISKS]] → [[07-TESTS]];
- estado, retomada ou próxima ação → [[01-CURRENT-STATE]] →
  [[09-ASTRA-HANDOFF]] → o processo recente;
- UI/mobile/motion → [[areas/visual-polish]] → [[areas/motion-system]] →
  [[07-TESTS]];
- aprendizado e processo → [[areas/adaptive-learning]] →
  [[learning/00-LEARNING-HUB]];
- banco, sessões, jogos, importação ou glossário → [[areas/supabase-runtime]]
  e as notas históricas preservadas em `imports/` somente quando o núcleo
  específico for relevante.

As notas em `imports/` são contexto histórico preservado, não uma segunda
fonte ativa. Quando uma informação histórica for usada, comparar com o código
atual e marcar a conclusão como `[HISTORICAL]`, `[REVALIDATE]`, `[UNKNOWN]` ou
`[VERIFIED-REPO]` conforme a evidência disponível.

## Durante o trabalho

Registrar somente conhecimento que seja durável e útil para uma tarefa futura:

- causas-raiz demonstradas e condições de reprodução;
- decisões técnicas e alternativas rejeitadas quando a razão importar;
- mudanças de arquitetura e limites de responsabilidade;
- contratos de identidade, estado, persistência, migrations, RPCs e RLS;
- riscos, incompatibilidades, bloqueios e incertezas ainda abertas;
- testes que protegem o comportamento e evidências de browser/dispositivo;
- progresso atual, handoff e próximo passo seguro.

Separar fato de hipótese. O código/Git atual, o banco correto, os testes e a
execução real vencem uma nota antiga que não tenha sido revalidada.

## O que não registrar

Não transformar o Segundo Cérebro em:

- log de commits;
- diário de execução linha a linha;
- cópia de conversas ou de arquivos-fonte;
- depósito de mensagens temporárias, tentativas descartadas ou detalhes que
  um agente pode obter trivialmente do código.

Um registro cronológico só deve existir quando preservar decisões, evidências,
falhas, bloqueios ou handoff que seriam caros de reconstruir. Nesse caso,
conectá-lo à área, aos bugs, às decisões, aos testes e aos riscos relacionados.

## Ao terminar uma etapa importante

Não atualizar é o resultado normal. Se (e somente se) a etapa gerou conhecimento durável novo,
revisar o Segundo Cérebro e:

1. atualizar a nota de área ou a nota de arquitetura já existente, quando ela
   for a fonte correta;
2. criar uma decisão, bug, risco ou checkpoint somente se houver conhecimento
   durável que não caiba na fonte existente;
3. conectar a informação nova às notas relacionadas por wikilinks internos;
4. atualizar [[01-CURRENT-STATE]] somente com o estado atual compacto;
5. registrar testes, limitações e próximo passo seguro em [[07-TESTS]],
   [[08-RISKS]] ou no processo quando aplicável;
6. se uma informação antiga ficou incorreta, corrigir a fonte existente e
   explicar a transição — não criar uma versão contraditória ao lado.

Toda nova anotação do agente deve preservar a classe `ape-ai-note`, mantendo
as anotações em vermelho pelo snippet `.obsidian/snippets/ape-ai-notes.css`.
Properties/YAML, wikilinks, backlinks e a estrutura histórica devem ser
preservados.

## Grafo e navegação

O índice principal é [[00-HOME]]. O mapa factual é [[01-CURRENT-STATE]]. O
protocolo de conexões está em [[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]]. Use
Backlinks e Local Graph quando disponíveis para descobrir dependências, mas
não crie links apenas para aumentar a densidade do grafo.

As conexões principais deste protocolo são:

[[03-ARCHITECTURE]] · [[04-DECISIONS]] · [[06-BUGS]] · [[07-TESTS]] ·
[[08-RISKS]] · [[09-ASTRA-HANDOFF]] · [[areas/visual-polish]] ·
[[areas/motion-system]] · [[areas/adaptive-learning]] ·
[[areas/supabase-runtime]] · [[12-PROCESS-LOG-2026-09-12]] · [[README]]

## Fontes de verdade

- Git e o código atual são a fonte de verdade da implementação.
- O backend real é a fonte de verdade de dados e schema quando a tarefa tocar
  em persistência, Supabase, migrations, RPCs ou RLS.
- Testes e browser/dispositivo fornecem evidência de comportamento executado.
- O vault externo é a entrada operacional oficial do Obsidian. Se um checkout
  do repositório contiver uma cópia em `docs/brain/`, ela será somente um
  espelho versionado para revisão e continuidade no Git.
- Nenhuma cópia deve evoluir como memória independente ou contraditória;
  mudanças materiais devem ser reconciliadas com o vault oficial.

## Próximo passo padrão

O primeiro passo é resolver com o que já está no contexto e no código. A memória entra apenas nos
níveis 1–3 definidos acima:

> **Se a tarefa exigir contexto histórico, consultar o índice e recuperar apenas o que está
> conectado à tarefa atual.**

Ao terminar:

> **Se (e somente se) surgiu conhecimento durável novo, conectá-lo de volta ao Segundo Cérebro.**
> Quando não surgiu, não existe atualização de memória — e esse é o resultado esperado.

O objetivo é que um agente futuro recupere rapidamente o estado, as decisões,
os riscos e o próximo movimento sem reconstruir todo o contexto do zero.
