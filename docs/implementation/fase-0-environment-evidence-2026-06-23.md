# Fase 0 — evidência complementar de ambiente

Data: 23 de junho de 2026

## Conclusão documental

A documentação já presente em `main` classifica:

- `ymahldldyxvwjeruaxpr` como backend atualmente usado pela Lovable;
- `xrnfhhoxmmstagmelvyi` como projeto novo preparado para uma migração futura;
- `rnriudxxafcnftjiysue` como projeto legado inativo.

Essa classificação também é consistente com `.env` e `supabase/config.toml`, que apontam para `ymahldldyxvwjeruaxpr`.

## O que está confirmado

1. O contrato versionado do frontend é internamente consistente.
2. O backend documentado como atual é `ymahldldyxvwjeruaxpr`.
3. O projeto `xrnfhhoxmmstagmelvyi` não deve substituir o atual sem migração integral e corte controlado.
4. A conexão administrativa disponível nesta auditoria não oferece acesso a `ymahldldyxvwjeruaxpr`.

## O que permanece pendente

Ainda faltam duas evidências para aprovar o Gate 0 de backend:

1. observar no aplicativo publicado chamadas reais para Auth, REST, RPC, Storage e Functions do project ref `ymahldldyxvwjeruaxpr`;
2. obter acesso administrativo ou snapshot verificável do schema, policies, grants, funções, dados de referência e migrations desse projeto.

## Regra operacional

Até essas evidências existirem:

- mudanças de frontend e CI podem continuar em branches isoladas;
- auditorias somente leitura podem continuar no projeto `xrnf...`, claramente identificadas como análise do destino de migração;
- migrations, policies, grants e Edge Functions não podem ser aplicadas em `xrnf...` como se ele já fosse produção;
- `ymah...` não pode ser removido, substituído ou declarado obsoleto.
