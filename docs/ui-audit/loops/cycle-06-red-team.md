# Ciclo 06 — red team do shell autenticado

## Premortem e testes

1. **Remount de sessão:** evitado; não existe condição de árvore, hook novo ou `key`.
2. **Provider duplicado:** evitado; providers permanecem inalterados.
3. **Loading convertido em vazio:** evitado; condições e JSX de estado não foram alterados.
4. **Query ou mutation adicional:** evitado; diff não toca hooks, handlers ou Supabase.
5. **Vazamento para jogos/perfil/turmas:** evitado por marcadores exclusivos de Home/Biblioteca.
6. **Classic/Galaxy contaminados:** evitado por dupla escopagem Playful; `.space-ui` permanece.
7. **Overflow mobile:** ausente em 320, 360, 390, 430 e 844 × 390.
8. **Foco e toque:** contrato exige outline de 3 px, offset de 3 px e altura mínima de 44 px.
9. **Reduced motion:** duração limitada a 1 ms no escopo desta onda.
10. **Fixture em produção:** ausente do `dist`.

## Matriz responsiva

| Superfície | Viewport | Altura | Largura útil |
| --- | --- | ---: | ---: |
| Home | 360 × 800 | 1.304 px | 345 px |
| Biblioteca | 360 × 800 | 864 px | 345 px |
| Home | 430 × 932 | 1.304 px | 415 px |
| Biblioteca | 430 × 932 | 996 px | 415 px |
| Home | 844 × 390 | 1.314 px | 829 px |
| Biblioteca | 844 × 390 | 520 px | 829 px |

Em todos os cenários, `scrollWidth` foi igual a `clientWidth`.

## Achados

- P0: nenhum.
- P1: nenhum.
- P2 preexistente: 69 avisos de lint.
- P2 preexistente: dois avisos de sintaxe CSS e chunks grandes no build.
- P2 de validação: sessão autenticada real não disponível no ambiente local.
- P2 planejado: detalhes de pasta/lista, hub/gameplay e turmas permanecem nas ondas seguintes.
