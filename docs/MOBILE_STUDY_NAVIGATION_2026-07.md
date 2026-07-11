# Correção da navegabilidade mobile no estudo

## Contexto

Em aparelhos Android, os controles de navegação do estudo apresentavam baixa confiabilidade de toque. O problema era mais evidente nos botões de card anterior/próximo e nos controles de camada, mas também afetava a sensação geral dos modos Flip, Escrita, Múltipla Escolha, Organizar Palavras e Pronúncia.

## Sintomas observados

- toque em anterior/próximo nem sempre era reconhecido;
- botões de camada tinham área visual pequena e texto comprimido;
- a barra global do aplicativo permanecia fixa na sessão de estudo, apesar de a rota ser tratada como tela cheia;
- em alguns navegadores móveis, o estado usado para impedir o clique posterior a um swipe podia permanecer ativo e consumir o toque seguinte;
- animações de troca de card eram longas para aparelhos móveis e aumentavam a sensação de atraso;
- chips e alternativas tinham áreas visuais clicáveis, mas nem sempre uma área de toque confortável.

## Causas encontradas

### Barra global na tela de estudo

`PrivateShell` já classificava `/study` e `/mixed-study` como rotas de tela cheia para esconder cabeçalho e rodapé, mas continuava montando `ApeTabBar`. A barra fixa ocupava a região inferior e podia competir com controles do jogo, principalmente componentes sticky.

### Estado residual depois de swipe

`StudyCardDeck` usa um bloqueio de clique para impedir que o clique sintetizado pelo navegador, logo após um swipe, acione outro controle. Em navegadores que não emitem esse clique, o bloqueio podia permanecer até o próximo toque real.

### Alvos compactos

Os controles de camada usavam altura visual de 32 px. Os botões de card anterior/próximo eram apenas ícones de 48 px, com pouco contexto visual. Chips do modo Organizar Palavras podiam ter 36 px.

## Alterações

- a barra global não é montada em `/study` nem `/mixed-study`;
- o gesto do deck só começa quando há navegação por swipe disponível, existe exatamente um toque e o alvo não é interativo;
- toques em botões, campos, links e controles nunca são interpretados como swipe;
- o bloqueio de clique posterior ao swipe possui expiração automática de 500 ms;
- `touchcancel` limpa todo estado transitório;
- botões mobile de card anterior/próximo passam a ter rótulos, borda, fundo e altura mínima de 56 px;
- botões de camada passam a ocupar duas colunas, com altura mínima superior a 48 px;
- alternativas, chips e controles recebem comportamento apropriado para ponteiro grosseiro;
- animações mobile foram encurtadas e tiveram deslocamentos reduzidos;
- preferências de movimento reduzido e modo de desempenho continuam respeitadas.

## Modos revisados

### Flip

- anterior/próximo ampliados;
- swipe preservado;
- toque para revelar preservado;
- ferramentas e áudio permanecem fora da captura de swipe.

### Escrita

- barra sticky deixa de competir com a navegação global inferior;
- Corrigir, Dica e Pular mantêm áreas mínimas de toque.

### Múltipla Escolha

- alternativas recebem área mínima confortável e feedback de toque;
- feedback e botão Próximo card permanecem funcionais.

### Organizar Palavras

- chips passam a respeitar mínimo móvel de 44 px;
- scroll vertical não é interpretado como navegação horizontal.

### Pronúncia

- controles continuam usando o deck comum e deixam de sofrer sobreposição da barra global.

## Escopo de segurança

Esta branch não altera:

- autenticação;
- cliente ou runtime Supabase;
- banco de dados e migrations;
- importadores;
- conteúdo dos flashcards;
- motor de resultados ou persistência da sessão;
- regras de favoritos, Lista Vermelha ou Cards Especiais.

## Testes

Os testes de lógica verificam:

- toque simples em controle interativo não inicia swipe;
- multitoque não inicia swipe;
- swipe horizontal deliberado navega na direção correta;
- scroll vertical e pequenos movimentos são ignorados;
- limites de primeiro e último card são respeitados;
- dispositivos móveis usam animação leve;
- movimento reduzido e modo de desempenho desativam a animação.

## Rollback

O rollback consiste em reverter os arquivos desta branch. Não há operação de banco nem transformação de dados. A sessão de estudo e o conteúdo dos usuários permanecem inalterados.
