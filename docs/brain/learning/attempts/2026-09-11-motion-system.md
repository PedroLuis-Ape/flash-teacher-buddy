---
cssclasses:
  - ape-ai-note
type: learning-attempt
status: active
area: ui-motion
date: 2026-09-11
related:
  - "[[areas/motion-system]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[12-PROCESS-LOG-2026-09-11]]"
  - "[[learning/00-LEARNING-HUB]]"
---

# Tentativa adaptativa — Motion System

## Hipótese

Uma camada CSS-first com tokens compartilhados e ponte mínima de ponteiro
permite ampliar a sensação de resposta do App Piteco sem introduzir uma
dependência de animação, alterar lógica de estudo ou criar movimento excessivo
em telas densas.

## Expectativa e resultado observado

- Expectativa: o primeiro slice do Games Hub teria tilt limitado no desktop,
  neutralidade em touch/reduced motion e preservaria foco/teclado.
- Resultado: essa expectativa foi confirmada no preview local; seis cards
  renderizaram, não houve overflow e Enter preservou a rota.
- Falha encontrada: o primeiro adaptador de `forwardRef` expôs um tipo React
  somente leitura incompatível com o hook. Diagnóstico: a ponte precisava
  aceitar ref mutável internamente. Correção: cast localizado em `assignRef`,
  sem relaxar a API pública nem tocar em dados.

## Próximo experimento

Aplicar os mesmos tokens a Home, cards/listas/coleções, navegação, overlays,
feedback e progresso, sempre começando por contrato de fonte/teste vermelho e
retestando desktop, mobile, reduced motion, teclado e overflow. Nenhuma lição
ampla foi promovida ainda; a observação permanece específica desta tentativa.

## Resultado da expansão

- A hipótese permaneceu válida: a expansão foi feita sem dependência nova e sem
  tocar nos fluxos de dados/estudo.
- O contrato novo passou 4/4 após a correção do teste de semântica de `type`; o
  contrato do Games Hub passou 6/6 com os seis modos reais.
- Próxima verificação: typecheck, suite completa, lint, build, `brain:check` e
  preview responsivo com foco em overflow, reduced motion e layout shift.

## Correção adaptativa

- Observação: a regra genérica de escala do ícone vencia as regras específicas
  dos seis modos por precedência CSS.
- Diagnóstico: as assinaturas tinham especificidade equivalente e foram
  declaradas antes da regra genérica.
- Correção: seletores específicos passaram a incluir a classe da superfície,
  sem `!important`, mantendo a cascata legível.
- Reteste: o preview confirmou respostas específicas por modo, sem overflow;
  a lição permanece local à camada CSS até aparecer recorrência em outro
  componente.

## Fechamento da tentativa

- Expectativa final confirmada no ambiente local: suite, typecheck, lint e build
  passaram, e a matriz mínima de desktop/mobile/reduced motion não registrou
  overflow nem efeito em coarse/reduced motion.
- Limitação: sem preview Lovable autenticado acessível, a publicação não foi
  inferida a partir do build local.
- Lição reutilizável: ao combinar tokens globais com assinaturas locais,
  testar a cascata compilada por modo; especificidade explícita e legível é
  preferível a `!important`.

## Auditoria complementar

- A hipótese de cobertura foi testada procurando cards interativos fora do
  recorte inicial; três superfícies relevantes foram encontradas na loja e no
  classroom.
- A correção foi mínima e o contrato passou 5/5. A expectativa é que os
  mesmos guards de hover, foco e reduced motion se apliquem sem alterar as
  ações existentes; o reteste completo é o próximo gate.

## Integração e aprendizado pós-merge

### Intended

Integrar o Motion System ao `main` preservando os oito commits remotos que
chegaram depois do ponto de divergência e mantendo o arquivo Supabase local
fora do escopo.

### Actual

O `origin/main` avançou para `2b477d80`; o `main` foi atualizado por
fast-forward e recebeu o merge `e4f36f44`. A primeira suíte pós-merge encontrou
um teste stale (`Marcar como difícil`) embora o runtime já usasse `Reforço`.
Após alinhar a expectativa do contrato, a suíte passou `257/257` arquivos e
`1576/1576` testes.

### Why

A divergência entre o rótulo e o teste veio do avanço remoto de reforço, não
da implementação visual. O comportamento continuou delegado aos componentes
de estudo e o contrato de apresentação não acompanhou a renomeação.

### Reusable lesson

Ao mesclar branches que alteram rótulos de UI, executar a suíte no resultado
mesclado antes do push e distinguir contrato textual stale de regressão de
runtime. Atualizar o contrato para a linguagem vigente é preferível a inserir
texto morto no componente apenas para satisfazer o teste.

Status: VALIDATED_LESSON, escopo restrito a contratos textuais de UI.

Related: [[areas/motion-system]] · [[07-TESTS]] · [[08-RISKS]] · [[12-PROCESS-LOG-2026-09-11]]
