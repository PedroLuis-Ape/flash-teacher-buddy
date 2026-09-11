# Novo fluxo do modo Reescrita

## Objetivo
Transformar somente a atividade **Reescrita** do modo Escrever em um ciclo auditivo real: **OUVIR → REVISAR → REESCREVER → CONCLUÍDO**. O modo Escrever/Traduzir e os demais jogos permanecem inalterados.

## Implementação

### 1. Máquina de estados isolada e testável
- Criar um módulo puro para os estados `LISTENING`, `REVIEW`, `REWRITE` e `COMPLETED`.
- Manter por card: fase, resposta da primeira tentativa, rascunho atual, uso de dicas e se houve erro antes da conclusão.
- Usar a avaliação e normalização atuais de Reescrita; não criar um segundo corretor.
- Proteger cada transição contra Enter/clique duplo e impedir avanço antes de um estado final.

### 2. Experiência de cada fase
- **LISTENING:** não montar no HTML o texto-alvo real nem o componente de glossário desse texto; manter o lado oposto/tradução visível; permitir ouvir quantas vezes quiser com o TTS e a velocidade já existentes; aceitar dicas graduais que não revelem imediatamente a frase completa.
- **Primeiro acerto:** ir para `COMPLETED`, registrar como acerto de primeira e manter o fluxo normal de próximo card.
- **Primeiro erro:** ir para `REVIEW`, revelar a resposta correta, comparação palavra a palavra e mensagens de correção; manter o botão de áudio disponível.
- **REVIEW:** uma ação explícita inicia `REWRITE`, limpa o campo e mantém a resposta correta disponível para estudo.
- **REWRITE:** exigir nova escrita; erros permanecem no mesmo card com correção, e somente a resposta correta libera `COMPLETED`.
- **Conclusão assistida:** registrar no progresso compartilhado como erro/recuperação quando o aluno errou a primeira tentativa, preservando a distinção já suportada pelo motor; acerto inicial continua sendo acerto.

### 3. Persistência e navegação
- Persistir o estado mínimo da Reescrita por identidade estável de sessão/card, usando a chave e o ciclo de vida da sessão atual, sem banco novo nem arquitetura paralela.
- Restaurar fase, rascunho e primeira tentativa após recarregar ou sair/retomar a mesma sessão.
- Limpar o estado transitório ao concluir, pular, trocar definitivamente de card, reiniciar ou descartar a sessão.
- Preservar voltar ao card anterior, gesto de navegação, pular e retomada; ao voltar, reabrir o card no estado coerente salvo.

### 4. UI, acessibilidade e isolamento
- Alterar apenas a apresentação da Reescrita dentro da tela compartilhada de escrita.
- Reativar o glossário interativo somente depois que a resposta for revelada; em `LISTENING`, o alvo não será renderizado nem passado a `InteractiveText`.
- Manter foco, regiões `aria-live`, rótulos dos botões, navegação por teclado e alvos de toque.
- Ajustar a barra de ações sem larguras fixas para 360, 390 e 412 px, preservando tradução, campo, áudio, dica, pular e corrigir sem sobreposição.

## Arquivos previstos
- `src/features/study/lib/writeRewriteFlow.ts` e testes: máquina de estados, dicas e serialização segura.
- `src/features/study/components/WriteStudyView.impl.tsx`: renderização e transições específicas da Reescrita.
- `src/features/study/components/WriteStudyView.tsx`: bloqueio de envio/navegação, layout móvel e passagem do estado persistido.
- Um pequeno módulo de snapshot satélite da Reescrita, seguindo o padrão já usado pela camada visível da sessão.
- `src/pages/Study.tsx`: fornecer a identidade da sessão e limpar/salvar o snapshot nos limites existentes, sem mudar o motor dos outros modos.
- Testes de contrato e integração existentes da Reescrita serão atualizados sem remover garantias do modo Traduzir.

## Validação
- Testes unitários de todas as transições, normalização, dicas sem revelação total e serialização/restauração.
- Testes de integração para: alvo ausente do HTML em `LISTENING`, tradução visível, TTS repetível, glossário bloqueado/restaurado, primeiro acerto, erro→revisão→reescrita, repetição até acertar, pular, voltar e recarregar.
- Regressões para modo Traduzir e demais jogos, além de Enter/clique duplo.
- Verificação visual em 360, 390 e 412 px quando houver uma sessão autenticada acessível.
- Executar `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build` e conferir o log final do preview.

## Fora do escopo
- Nenhuma alteração em banco, autenticação, RLS, referências de projeto, TTS global, glossário global, outros modos ou sistema visual.

## O que ainda faltará após a implementação
- Se o preview continuar sem uma sessão autenticada acessível, ficará pendente apenas a validação visual real dentro de uma lista de estudo; todas as validações automatizadas e de viewport possíveis serão executadas.
- A migração multilíngue geral já existente no roadmap continuará separada deste trabalho.
