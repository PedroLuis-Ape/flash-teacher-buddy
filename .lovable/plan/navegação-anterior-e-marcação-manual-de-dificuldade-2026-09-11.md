# Navegação anterior e marcação manual de dificuldade

## Objetivo
Adicionar uma ação consistente de **Card anterior** em Flip, Escrever/Reescrever, Múltipla escolha, Organizar palavras, Pronúncia e Misto, tanto no fluxo contínuo quanto nas rodadas de domínio.

## Comportamento
- Exibir uma ação **Marcar como difícil** em todos os jogos, salvando o card em **Reforço**, sem exigir erro, favorito ou Lista Vermelha. A mesma ação permite removê-lo do Reforço.
- Exibir um controle acessível e confortável no celular em todos os modos enquanto houver um card anterior.
- Manter o atalho configurável de “Card anterior” funcionando nos mesmos contextos.
- Ao voltar, abrir o card anterior no estado inicial para permitir refazê-lo.
- Em rodadas de domínio, desfazer somente o resultado corrente daquele card dentro da rodada antes de refazê-lo; a nova resposta substitui a anterior na sessão, sem avançar duas vezes nem duplicar pontuação.
- Preservar ordem da rodada, card/camada atual, favoritos, direção, filtros e retomada da sessão.
- No primeiro card, manter a ação desativada ou oculta de forma coerente.

## Implementação incremental
1. Criar no motor de rodadas uma operação pura e testada para recuar um card e reabrir seu resultado com segurança.
2. Fazer `useStudyEngine` expor uma única ação de retorno válida nos fluxos contínuo e por rodadas.
3. Usar essa ação na página de estudo, removendo o bloqueio atual das rodadas.
4. Adicionar o controle visual compartilhado abaixo do conteúdo para todos os modos; manter os controles próprios do Flip sem duplicação visual.
5. Encaminhar a navegação aos cartões do modo Misto e aos gestos/atalhos existentes.
6. Integrar o controle de dificuldade ao menu comum dos cards em todos os modos, reutilizando a persistência de Reforço já existente.
7. Adicionar testes de regressão para retorno contínuo, retorno em rodada, substituição da resposta e limites no primeiro card.

## Validação
- Testes focados do motor e dos modos de estudo.
- Verificação de tipos, lint, suíte completa e build.
- Teste visual/interativo em celular e desktop, incluindo card com camadas e uma rodada de domínio.

## Fora deste lote
- Tradução das strings restantes do projeto e os demais lotes multilíngues continuam pendentes.
- Nenhuma alteração de banco, autenticação, permissões ou regras de pontuação remota.
- “Difícil” não altera automaticamente favoritos nem Lista Vermelha.
