---
cssclasses:
  - ape-ai-note
aliases:
  - START-HERE
  - PROTOCOLO-DE-CONTEXTO
type: protocol
status: active
area: knowledge-management
last_reviewed: 2026-09-12
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
  - "[[areas/visual-polish]]"
  - "[[areas/motion-system]]"
  - "[[areas/adaptive-learning]]"
  - "[[areas/supabase-runtime]]"
  - "[[12-PROCESS-LOG-2026-09-12]]"
  - "[[README]]"
---

# START HERE — Protocolo de contexto do App Piteco

Esta é a nota central permanente para qualquer trabalho relacionado ao App
Piteco / APE Education. Ela é uma rota de entrada e uma regra de operação; não
é um substituto para as notas profundas de arquitetura, áreas, decisões,
bugs, testes, riscos ou handoff.

## Regra estrutural obrigatória

Antes de iniciar qualquer nova tarefa no App Piteco:

1. consultar o Segundo Cérebro;
2. buscar primeiro somente as informações relacionadas à tarefa atual;
3. seguir os links/conexões encontrados para recuperar decisões, arquitetura,
   bugs anteriores, migrations, contratos, testes e progresso relevante;
4. conferir o conhecimento recuperado contra o código, Git e ambiente atual;
5. evitar reler todo o repositório ou todo o Segundo Cérebro quando as
   informações necessárias já estiverem documentadas e conectadas.

O caminho operacional confirmado do vault externo é
`C:\Users\pedro\Documents\App-Piteco-Brain`. O nome
`C:\Users\pedro\Documents\App-Piteco-Braine` não existe e não deve originar
uma segunda estrutura.

## Como recuperar contexto sem desperdiçar contexto

Comece sempre por [[01-CURRENT-STATE]] e por esta nota. Depois use as
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

Antes de encerrar uma etapa significativa, revisar o Segundo Cérebro e:

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

Antes de qualquer nova implementação, correção, investigação ou refatoração,
o primeiro passo padrão é:

> **Consultar o Segundo Cérebro e recuperar apenas o contexto conectado à
> tarefa atual.**

Ao terminar:

> **Revisar se o trabalho gerou conhecimento durável que precisa ser
> conectado de volta ao Segundo Cérebro.**

O objetivo é que um agente futuro recupere rapidamente o estado, as decisões,
os riscos e o próximo movimento sem reconstruir todo o contexto do zero.
