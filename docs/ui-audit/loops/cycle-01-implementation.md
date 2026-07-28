# Ciclo 01 — implementação

## Mudança focada

Foi criado um contrato semântico aditivo para o Piteco Play:

- texto primário, secundário, auxiliar e desabilitado;
- superfícies canvas, base, elevada, rebaixada e overlay;
- ações primária, secundária, perigosa e desabilitada;
- feedback de sucesso, erro, aviso e informação;
- tokens de progresso, XP, PiteCOIN, favorito e foco vermelho;
- bordas, foco, raios, sombras e movimento.

As regras expressivas permanecem sob `html[data-visual-style="playful"]`. O bloco `:root` fornece apenas aliases compatíveis com o sistema atual.

## Primitivos

- `Button`: mantém o contrato existente, expõe variante/tamanho e garante alvo de 44 px.
- `Card`: aceita superfície e densidade, sem criar `tabIndex` ou papel de botão.
- `Badge`: acrescenta estados semânticos e indicadores de produto.
- `Text`: concentra tom, tamanho e peso.
- `Surface`: concentra elevação e densidade.

## Acessibilidade

- Meta de contraste 7:1 para texto, ações e feedback em claro/escuro.
- Contraste mínimo 4,5:1 no estado desabilitado.
- Foco visível de 3 px.
- Estado pressionado tátil sem atraso funcional.
- Movimento reduzido força durações de 1 ms.
- Estado não depende somente de cor nos exemplos de QA.

## Laboratório de QA

`tools/visual-qa/primitives.html` é servido apenas pelo Vite em desenvolvimento. Ele permite alternar claro/escuro e Clássico/Piteco Play sem gravar preferências ou acessar o banco.

- [Piteco Play desktop](./assets/pr3-playful-primitives-desktop-1440.png)
- [Piteco Play mobile](./assets/pr3-playful-primitives-mobile-320.png)
