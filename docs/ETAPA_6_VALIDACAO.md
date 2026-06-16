# Validação da Etapa 6

Este arquivo registra os critérios de aceite usados pelo CI e pelo preview visual.

## Critérios obrigatórios

- O tema padrão não monta animações galácticas visíveis.
- Celulares usam o nível estático.
- `prefers-reduced-motion`, economia de dados e hardware limitado usam o nível estático.
- O nível estático não renderiza o cometa.
- A faixa galáctica não se move fora do nível completo.
- O cometa é cancelado quando a aba fica oculta.
- Não há rolagem horizontal causada pelos efeitos.
- Typecheck, testes, lint e build devem passar.
