# 13 — Teacher, Student and Classroom UX

1. **Escopo vistoriado:** professor, aluno, turmas, membros, solicitações, convites, atividades, progresso, onboarding e papéis.
2. **Arquivos analisados:** telas e componentes de turma, painéis, modais administrativos e navegação por papel.
3. **Rotas analisadas:** áreas de professor, aluno, turma e detalhes administrativos.
4. **Evidências:** fluxos de membership foram endurecidos recentemente; telas têm densidade maior e requisitos de autorização próprios.
5. **Problemas:** risco de infantilizar administração, ações densas em mobile e regressão de pertencimento ao mexer em componentes.
6. **Severidade:** P1.
7. **Causas:** compartilhamento incompleto de primitives e layouts responsivos locais.
8. **Três propostas:** A) aplicar ornamentação completa; B) mesma base Playful com densidade “work”; C) kit administrativo separado.
9. **Recomendação:** B, com marca discreta, superfícies sólidas e ações inequívocas.
10. **Impacto mobile:** tabelas viram listas/cards acessíveis; ações críticas em menus nomeados; dialogs com safe-area.
11. **Impacto desktop:** maior densidade, filtros persistentes e hierarquia clara.
12. **Acessibilidade:** cabeçalhos de dados, confirmação, foco, mensagens de autorização e alternância de papel explícita.
13. **Performance:** paginação/virtualização onde já necessária; não renderizar decoração por linha.
14. **Riscos:** vazamento entre usuários/turmas, perda de contexto de papel e alterações acidentais de membership.
15. **Testes:** autorizado/não autorizado, turma compartilhada, isolamento, mobile, nomes longos, loading/erro e regressão de membership.
16. **Arquivos que mudariam:** componentes visuais de turma/admin e testes; regras de acesso permanecem fora do redesign.
