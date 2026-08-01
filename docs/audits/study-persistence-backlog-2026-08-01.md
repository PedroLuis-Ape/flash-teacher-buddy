# Backlog tecnico pos-fase — estudo e persistencia

Este backlog registra apenas itens P2/P3 ou validacoes operacionais fora do escopo de correcao desta fase. Nenhum item abaixo bloqueia os gates locais desta rodada; nao implementar sem um bug P0/P1 reproduzivel ou uma tarefa explicita.

## P2 — validacao operacional

- Executar E2E autenticado em ambiente isolado para duas contas, duas abas, reload, pagehide, logout/login, renovacao de token, offline/online, mobile, turmas e colecoes.
- Repetir o percurso Hub -> jogo -> primeiro card -> resposta -> sair -> retornar nos sete modos, confirmando card, camada, ordem e preset.
- Aplicar as migrations aditivas no projeto autorizado, regenerar tipos e validar os RPCs de claim/progresso com rollback operacional previamente aprovado.
- Medir respostas fora de ordem e reconexao com rede lenta no runtime publicado pela Lovable.

## P3 — manutencao posterior

- Remover fallbacks legados somente depois do periodo de observacao pos-migration.
- Avaliar a convergencia arquitetural do runtime adaptativo de Pratica Mista com o nucleo comum, sem reescrever um fluxo funcionando por preferencia.
- Tratar os avisos preexistentes de hooks/fast-refresh e os avisos de CSS/chunks em uma tarefa separada.

## Regra de parada

Esta fase nao implementa estes itens. Se algum deles revelar um problema P0/P1 reproduzivel, abrir uma nova correcao focada com teste e rollback definidos.
