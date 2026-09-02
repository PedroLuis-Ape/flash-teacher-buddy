# 03 — Design System Architecture

1. **Escopo vistoriado:** tokens, temas, paletas, estilo, Tailwind/shadcn, CSS variables, estados e cascata.
2. **Arquivos analisados:** `src/lib/palettes.ts`, `src/hooks/usePalette.ts`, `src/hooks/useTheme.ts`, `src/index.css`, `src/styles/space-ui-v1.css`, `src/styles/space-layouts.css`, `index.html`.
3. **Rotas analisadas:** superfícies públicas, shell, hub e estudo por compartilharem a mesma cascata.
4. **Evidências:** quatro `PaletteId`; `applyPalette` também troca light/dark; boot inline lê apenas `theme`; seletores amplos e `!important`; IDs antigos ainda aparecem no CSS.
5. **Problemas:** eixos acoplados, duas fontes de verdade, primeiro frame divergente e alto risco de regressão global.
6. **Severidade:** P1.
7. **Causas:** crescimento incremental por paleta, sem contrato versionado de preferência e tokens semânticos completos.
8. **Três propostas:** A) adicionar uma quinta paleta; B) criar `data-visual-style` independente e manter paletas legadas; C) reescrever todos os componentes para um segundo kit.
9. **Recomendação:** B. Contrato versionado: `appearance`, `palette`, `visualStyle`; compatibilidade bidirecional durante migração.
10. **Impacto mobile:** tokens de densidade e safe-area por contexto, sem fork de componentes.
11. **Impacto desktop:** mesma árvore semântica, com densidade responsiva.
12. **Acessibilidade:** tokens explícitos para texto, foco, seleção, sucesso, erro, alerta e disabled.
13. **Performance:** atributos no `<html>`, CSS estático e boot inline mínimo; sem provider pesado.
14. **Riscos:** dupla aplicação de atributos, specificity wars, flash e perda da preferência antiga.
15. **Testes:** migração de storage, primeira pintura, troca sem reload, duas abas, light/dark/system, quatro paletas e reset.
16. **Arquivos que mudariam:** boot visual, biblioteca de preferências, hooks, seletor, tokens CSS, Tailwind e testes.

## Contrato recomendado

- `appearance`: `light | dark | system`
- `visualStyle`: `classic | galaxy | playful`
- `palette`: mantida como dimensão de cor e compatibilidade; `galaxy` legado migra para estilo `galaxy` sem apagar o valor original até o rollback ser seguro.
- `data-visual-style` e `data-appearance` no elemento raiz.
- Sem sincronização remota nesta série.
