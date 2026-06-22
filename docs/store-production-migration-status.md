# Estado da migração de produção da Loja do App Piteco

- Backend usado atualmente pela Lovable: `ymahldldyxvwjeruaxpr`.
- Projeto novo preparado para receber a migração: `xrnfhhoxmmstagmelvyi`.
- O backend antigo não pode ser removido nem trocado antes de backup, migração integral, validação e corte controlado.
- O hotfix de compatibilidade mantém a loja atual visível no backend antigo sem consultar o projeto novo.
- A troca definitiva deve ocorrer apenas depois da migração de Auth, tabelas, dados, RPCs, RLS, Storage e Edge Functions.
