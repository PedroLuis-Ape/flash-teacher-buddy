# Runtime de dados e projeto administrado

O App Piteco possui dois papéis distintos de Supabase durante a transição:

- Projeto administrado pelo repositório e ferramentas: `xrnfhhoxmmstagmelvyi`.
- Backend de produção que contém contas e dados existentes: `ymahldldyxvwjeruaxpr`.

O frontend deve usar o backend de produção até que uma migração completa e validada dos dados seja concluída. Alterar o runtime do frontend para o projeto administrado sem migrar usuários, pastas, listas e flashcards provoca uma aplicação vazia.

Esta separação é temporária, explícita e deve ser removida somente após auditoria e migração de dados.
