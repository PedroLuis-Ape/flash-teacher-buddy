# Etapa 6 — Otimização final do modo Galáxia

## Objetivo

Manter a identidade visual do tema Galáxia sem aplicar o mesmo custo de animação a todos os dispositivos.

## Níveis automáticos

### Completo

Aplicado a desktops capazes.

- 10 estrelas decorativas.
- Tempos individuais entre aproximadamente 9 e 15 segundos.
- Faixa galáctica com movimento sutil de 34 segundos.
- Cometa com travessia de 3,2 segundos.
- Primeira aparição após 25–45 segundos.
- Próximas aparições em intervalos de 65–120 segundos.

### Equilibrado

Aplicado a tablets, telas intermediárias, ponteiro por toque ou hardware mediano.

- 7 estrelas decorativas.
- Movimento mais discreto.
- Faixa galáctica sem animação contínua.
- Cometa com travessia de 3,8 segundos.
- Aparições mais raras, em intervalos de até aproximadamente 165 segundos.
- As preferências de desempenho do usuário continuam tendo prioridade.

### Estático

Aplicado quando qualquer uma destas condições é detectada:

- largura de até 767 px;
- `prefers-reduced-motion`;
- atualização de tela lenta;
- economia de dados;
- até 4 GB de memória reportada;
- até 4 núcleos lógicos reportados.

Comportamento:

- 4 estrelas estáticas;
- nenhum cometa;
- nenhuma animação da faixa galáctica;
- fundo reduzido de nove para quatro camadas principais;
- sem máscaras, pseudocamadas ou brilho por estrela;
- remoção de backdrop blur decorativo;
- contenção horizontal para evitar rolagem lateral no Chrome Android.

## Ciclo de vida

- O nível é recalculado quando a janela muda de tamanho.
- Mudanças em movimento reduzido, ponteiro, atualização de tela e economia de dados são observadas.
- O cometa é cancelado e os temporizadores são interrompidos quando a aba fica oculta.
- Ao retornar à aba, um novo ciclo é agendado sem disparo imediato.
- Ao trocar o tema, todas as animações e temporizadores são limpos.

## Testes automatizados

`src/lib/galaxyPerformance.test.ts` cobre:

- desktop capaz → nível completo;
- tablet/tela intermediária → nível equilibrado;
- celular → nível estático;
- movimento reduzido e economia de dados → nível estático;
- memória e CPU limitadas → nível estático;
- quantidade de estrelas por nível;
- cometa mais lento e raro no nível equilibrado.

## Checklist visual

1. Testar o tema padrão e confirmar ausência de efeitos galácticos.
2. Ativar Galáxia em desktop e observar estrelas suaves, sem piscadas simultâneas.
3. Manter a página aberta até a passagem gradual do cometa.
4. Alternar para outra aba e confirmar que nenhum cometa surge ao retornar imediatamente.
5. Testar em largura de celular e confirmar fundo estático e ausência de rolagem horizontal.
6. Ativar movimento reduzido no sistema operacional e confirmar ausência total de animações.
7. Alternar os presets de desempenho e confirmar que `balanced` e `light` reduzem os efeitos.
