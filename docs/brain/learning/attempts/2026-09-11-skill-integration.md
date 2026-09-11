---
cssclasses:
  - ape-ai-note
type: attempt
date: 2026-09-11
agent: Codex
domain: knowledge-management
related:
  - "[[README]]"
  - "[[areas/adaptive-learning]]"
  - "[[learning/00-LEARNING-HUB]]"
  - "[[learning/LESSON-INDEX]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[12-PROCESS-LOG-2026-09-11]]"
---

# Attempt — integração das Skills e brain:check

## Goal

Instalar as duas Skills fornecidas, migrar o vault existente para `docs/brain/`
e obter uma checagem determinística da memória conectada.

## Hypothesis

Depois de adicionar o learning hub e os índices à cópia migrada, o checker
passaria sem alterar a história do vault.

## Expected result

`brain:check` deveria retornar `BRAIN_CHECK_PASS`, preservando os links e o
histórico importado.

## Falsifying evidence

Qualquer nota nuclear ausente, frontmatter inválido, wikilink ativo não
resolvido, ID canônico duplicado, placeholder de agente ou ausência de log de
sessão.

## Confidence

medium

## Action

- Instalação exata das Skills validada pelo `quick_validate.py`.
- Cópia não destrutiva de `App-Piteco-Brain` para `docs/brain/`.
- Criação do learning hub, índices e templates.
- Primeira execução do checker no vault migrado.

## Observed result

A primeira execução falhou com seis erros: três links explícitos para notas em
`imports/`, um wikilink de exemplo não existente, um link para a pasta
`learning/` e este registro de tentativa ainda ausente.

## Prediction error

A expectativa tratou todos os links arquivados como se fossem memória ativa e
não distinguiu um exemplo textual de um link semântico real. Também não
considerou que a própria evidência da tentativa precisaria existir antes do
primeiro passe verde.

## Root-cause hypothesis

CAUSA DEMONSTRADA: o checker inicialmente usava somente arquivos ativos tanto
para escanear quanto para resolver links. Isso rejeitava referências históricas
válidas e não detectava que dois links novos ainda apontavam para um destino
inexistente.

## Corrective next experiment

Resolver links contra o histórico preservado sem escanear `imports/` como
memória ativa; remover o placeholder de exemplo; apontar para o hub real;
registrar esta tentativa; executar o mesmo checker novamente.

## Retest

Após a correção, o mesmo teste focado do checker passou em 2/2 casos e a
execução no vault migrado retornou `BRAIN_CHECK_PASS`.

## Learning value

OBSERVATION. A distinção entre conteúdo ativo e histórico precisa ser parte
explícita do checker. Ainda não há evidência suficiente para promover uma
heurística geral de arquitetura do App Piteco.

## Related notes

[[areas/adaptive-learning]] · [[learning/00-LEARNING-HUB]] · [[README]] ·
[[01-CURRENT-STATE]] · [[07-TESTS]] · [[08-RISKS]] ·
[[12-PROCESS-LOG-2026-09-11]]
