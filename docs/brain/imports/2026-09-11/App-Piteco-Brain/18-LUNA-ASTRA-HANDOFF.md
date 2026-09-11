---
cssclasses:
  - ape-ai-note
---

# Luna → Astra Handoff

## Luna
Executa volume e prepara terreno:
- investiga;
- implementa o que consegue com segurança;
- cria testes;
- documenta;
- evita hacks;
- para quando arquitetura exige revisão superior.

## Astra
Primeiro:
1. ler CURRENT STATE;
2. ler este handoff;
3. ler DECISIONS;
4. revisar commits/diffs;
5. rodar baseline;
6. classificar entregas;
7. só depois editar.

## Classificações
- **FINAL** — robusto e validado.
- **REVIEW_RECOMMENDED** — funciona, decisão merece revisão.
- **PARTIAL_SAFE** — parte segura feita sem forçar restante.
- **BLOCKED** — sem caminho seguro/validável.

## Proibido para Luna
- timeout arbitrário;
- reload para mascarar estado;
- limpar storage;
- catch silencioso;
- magic value;
- estado duplicado;
- CSS só para screenshot;
- bypass;
- arquitetura paralela desnecessária;
- refactor gigante sem contrato.

## Astra deve olhar primeiro
1. produção vs schema de sessões;
2. Rewrite recém-implementado;
3. `useStudyEngine.ts`;
4. importadores;
5. glossário contextual;
6. mobile/motion;
7. extensão Chrome.

## Handoff mínimo
problema → causa → arquivos → solução → testes → browser evidence → riscos → classificação.
