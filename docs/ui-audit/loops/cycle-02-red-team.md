# Ciclo 02 — red team visual

## Testes adversariais

1. **Mobile estreito:** laboratório testado em 320, 360, 390 e 430 px.
2. **Overflow:** `scrollWidth` igual a `clientWidth` em 360, 390 e 430 px.
3. **Texto longo:** títulos, descrições e labels extensos permaneceram dentro dos containers.
4. **Teclado:** foco visível com outline sólido de 3 px e offset de 3 px.
5. **Alvo tátil:** controles compartilhados com altura/largura mínima de 44 px.
6. **Redução de movimento:** durações reduzidas para 1 ms por media query.
7. **Estado desabilitado:** contraste AA sem reduzir a opacidade do container.
8. **Semântica:** card visualmente interativo não recebe `tabIndex` ou papel de botão automaticamente.
9. **Console limpo:** novas abas do aplicativo e do laboratório sem erros ou avisos.
10. **Produção:** laboratório ausente do `dist`.

## Galaxy

O modo Galaxy possui partículas e camadas animadas, portanto hashes de screenshot não são um oráculo confiável. A verificação foi funcional e visual:

- seletor continuou operável;
- conteúdo permaneceu legível;
- nenhuma quebra horizontal foi observada;
- nenhum erro novo de console ocorreu.

Evidências:

- [branch atual](./assets/pr3-galaxy-mobile-390-after.png)
- [base da PR](./assets/pr3-galaxy-mobile-390-parent.png)

## Achados

- P0: nenhum.
- P1: nenhum.
- P2 preexistente: dois avisos de sintaxe CSS no build e chunks grandes já conhecidos.
- P2 planejado: o seletor de Piteco Play para usuários será tratado em PR posterior; nesta PR o modo permanece ativável apenas pelo contrato de preferência já aprovado e pelo laboratório local.
