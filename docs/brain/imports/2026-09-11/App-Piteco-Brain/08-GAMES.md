---
cssclasses:
  - ape-ai-note
---

# Games

## Inventário conhecido
**[VERIFICADO-REPO + auditoria]**

### Flip
virar, TTS, resposta, next/previous, subset, ordem, favoritos, Red Focus, conclusão, retomada.

### Write
traduzir/reescrever, lado A/B/alternado, correção flexível/rigorosa, accepted answers e teclado mobile.

### Multiple Choice
alternativas, resposta, progresso, cuidado com double click.

### Unscramble
ordenação/reconstrução, touch/drag/tap, validação.

### Mixed via Study
Combina modos incluindo Flip no motor compartilhado.

### Mixed adaptativo
Combina Write/Multiple Choice/Unscramble e possui lógica adaptativa própria.

### Mastery
Rounds, missed/unseen, jornada e conclusão por rodada.

### Pronunciation beta
Microfone/pronúncia; precisa teste real de permissão/dispositivo.

### Outros settings/modos
Race, gamified, highlights, red focus aparecem no ecossistema. Inventariar o runtime atual antes de refactor.

## Configurações conhecidas
- continuous/mastery
- sequential/random
- all/favorites
- A→B / B→A / any
- Red Focus
- Fast Mode
- Play both/single
- lado A/B.

## Regra de produto
- não criar engine paralelo para um jogo isolado;
- progresso usa identidade correta;
- último card é caso obrigatório;
- feedback visual responde a estado real;
- mobile e teclado são parte do DoD.

## Estado de QA 09/09
Muitos contratos estavam verdes por testes, mas abertura/jogabilidade/mobile de vários modos ainda estavam marcados como parciais no browser autenticado.
