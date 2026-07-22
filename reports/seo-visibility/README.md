# Relatórios do loop de visibilidade

Esta pasta guarda a trilha auditável do APE Search Visibility Experiment Loop.

## Arquivos gerados localmente

- `latest-eval.json`: última avaliação determinística produzida por `npm run seo:visibility:score`.
- `loop-log.md`: registro das iterações técnicas da execução atual.
- `codex-last-message.md`: resumo final escrito pelo `codex exec`.
- `benchmarks/YYYY-MM-DD.json`: observações externas com consultas fixas, mecanismo, commit implantado e data.

## Política de versionamento

O README faz parte do repositório. Relatórios de uma investigação podem ser incluídos no PR quando forem necessários para explicar a hipótese e não contiverem dados privados, credenciais ou respostas extensas protegidas por direitos autorais.

Relatórios efêmeros, logs volumosos e resultados que incluam informações sensíveis não devem ser versionados.

## Integridade

- Não invente resultados externos.
- Registre `null` ou `unknown` quando algo não puder ser observado.
- Não altere benchmarks anteriores para fazer uma hipótese parecer melhor.
- Sempre registre commit implantado, data, mecanismo e consulta literal.
- Não atribua causalidade quando a janela de observação não permitir.
