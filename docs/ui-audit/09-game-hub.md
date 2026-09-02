# 09 — Game Hub and Session Settings

1. **Escopo vistoriado:** seleção de modo, presets, direção, correção, formato, áudio, atalhos, reinício e subpáginas.
2. **Arquivos analisados:** hub de jogos, dialogs/settings, hooks de presets e componentes de seleção.
3. **Rotas analisadas:** hub e preparação de sessões.
4. **Evidências:** restauração do último preset por modo e presets recentes são invariantes já corrigidas em `main`; modais concentram múltiplos grupos.
5. **Problemas:** densidade, scroll/dupla rolagem, transparência e risco de esconder a configuração efetiva.
6. **Severidade:** P1.
7. **Causas:** todas as configurações apresentadas no mesmo nível e apresentação acoplada a controles críticos.
8. **Três propostas:** A) tabs; B) resumo compacto + subpáginas/sheet; C) wizard obrigatório.
9. **Recomendação:** B, mantendo presets e valores exatamente como hoje.
10. **Impacto mobile:** resumo sempre visível, CTA fixo seguro e grupos em sheet sem dupla rolagem.
11. **Impacto desktop:** painel lateral/popover com comparação rápida.
12. **Acessibilidade:** seleção por texto/ícone/forma, grupos nomeados, foco restaurado e atalhos documentados.
13. **Performance:** lazy mount de subpainéis; não recalcular sessão ao apenas trocar apresentação.
14. **Riscos:** resetar preset, alterar defaults ou reiniciar sessão inadvertidamente.
15. **Testes:** último preset por modo, reload, duas abas, foco, 320 px, teclado, audio/atalhos e reinício.
16. **Arquivos que mudariam:** componentes de hub/settings e CSS/tokens; lógica de preset só recebe testes de proteção.
