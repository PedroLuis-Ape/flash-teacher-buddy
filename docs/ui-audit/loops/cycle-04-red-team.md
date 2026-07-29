# Ciclo 04 — red team da experiência pública

## Testes adversariais

1. **Larguras críticas:** 320, 360, 390, 430 e paisagem 844 × 390.
2. **Overflow horizontal:** nenhum cenário excedeu a largura útil.
3. **Login:** CTA visível, altura total de 844 px e apenas um selo `v1.5`.
4. **Cadastro:** CTA de criação visível e sem overflow.
5. **Menu mobile:** abre, contém acesso ao Portal, fecha por controle explícito e não causa overflow.
6. **Tema claro Playful:** conteúdo e controles permaneceram legíveis.
7. **Galaxy:** caminho visual legado permaneceu ativo e sem quebra horizontal.
8. **Teclado:** links públicos exibem outline sólido de 3 px, offset de 3 px e alvo mínimo de 44 px.
9. **Console novo:** nenhum erro; somente dois avisos preexistentes de future flags do React Router.
10. **Produção:** o ativador de QA local não foi empacotado.

## Matriz responsiva

| Viewport | Altura total | Largura útil |
| --- | ---: | ---: |
| 320 × 568 | 14.007 px | 305 px |
| 360 × 800 | 12.046 px | 345 px |
| 390 × 844 | 11.253 px | 375 px |
| 430 × 932 | 10.285 px | 415 px |
| 844 × 390 | 7.359 px | 829 px |

## Achados

- P0: nenhum.
- P1: nenhum.
- P2 preexistente: dois avisos de future flags do React Router.
- P2 de integração: a correção do contrato de rota pública está isolada na PR #356 e não foi duplicada.
- P2 planejado: páginas públicas dinâmicas e superfícies internas serão tratadas nas próximas ondas.

## Vetoes

- Integridade de dados: liberado; não houve operação de banco.
- Privacidade: liberado; nenhum dado privado foi adicionado.
- Acessibilidade: liberado para o escopo desta onda.
- Performance: liberado; bundle dentro do orçamento.
- Regressão Classic: liberado por comparação exata.
