# Landing: clareza e primeira ação

## Diagnóstico e decisão

A página publicada foi inspecionada no navegador: três parágrafos antes do CTA, nove seções editoriais, repetição de autoria/recursos e convite flutuante da extensão. A raiz também abria um guia automaticamente na primeira visita.

A composição escolhida concentra a proposta de valor na abertura, mostra um flashcard demonstrativo e organiza cinco seções curtas. Conteúdo detalhado continua nas rotas de metodologia, evidências, fonte oficial, flashcards e professores.

## Alteração

- Homepage e alias /landing recebem composição e CSS específicos; demais páginas editoriais mantêm o layout existente.
- Fonte canônica config/editorial/home.json compartilhada pelo React, pré-render e FAQ estruturada.
- Abertura de um parágrafo, demonstração com revelação nativa por details, três passos, alunos/professores, autoria datada, metodologia/privacidade e cinco FAQs.
- Navegação principal simplificada. Extensão passa a link no documento; guia continua acessível por ação explícita em /?guia=1 e pode ser fechado e reaberto.
- Sitemap acompanha a revisão de 08/09/2026. O antigo mínimo artificial de oito seções foi substituído por contrato de cinco blocos concisos e abertura de até 45 palavras. Integridade de conteúdo público e schemas preservada.
- Nenhuma alteração de banco, autenticação ou dados de alunos.

## Evidências

- 237 arquivos / 1.488 testes aprovados; typecheck padrão aprovado.
- ESLint completo: zero erros, 71 avisos existentes; arquivos finais de UI alterados também verificados.
- Build aprovado e validação editorial/pré-render de 23 rotas aprovada; score SEO determinístico 100/100. O score não comprova conversão nem indexação.
- Inspeção real do Chrome em desktop e viewport 390×844: CTA na primeira tela mobile, sem overflow horizontal.
- Testados: revelar tradução, expandir FAQ, abertura/fechamento/reabertura do guia e CTA encaminhando o visitante a /auth?mode=signup. Raiz anônima sem modal automático.

## Limites e publicação

Pré-render conserva conteúdo equivalente, mas usa a apresentação estática simplificada existente antes do React montar. Não foram medidos ganhos de conversão. Produção permanece dependente de publicação pela Lovable e smoke pós-publicação.

Rollback: reverter o commit deste PR; sem migration ou operação em dados para desfazer.
