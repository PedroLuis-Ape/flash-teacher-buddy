# Hotfix — layout mobile no tema Galáxia

## Sintoma

Na Home mobile, a navegação inferior aparecia no topo e o conteúdo era empurrado para fora da viewport. Cards, estatísticas e a seção de turmas ficavam comprimidos e sobrepostos.

## Causa raiz

`src/styles/space-ui-stars.css` aplicava `position: relative` à `.space-ui-tabbar` no tema Galáxia. Isso anulava o `position: fixed` usado no mobile. Como a barra está dentro de um container flex horizontal, ela passava a ocupar espaço no fluxo e deslocava toda a Home para a direita.

## Correção

- O tema Galáxia não altera mais o modelo de posicionamento da barra.
- Mobile recebe uma proteção explícita com `position: fixed` e largura de `100vw`.
- O conteúdo recebe `min-width: 0`, `width: 100%` e `max-width: 100%` para impedir novo estouro horizontal.
- Desktop continua usando a navegação sticky definida no layout principal.
