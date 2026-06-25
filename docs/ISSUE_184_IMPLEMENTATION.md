# Issue 184 — Prática Mista Inteligente

## Contrato implementado

- Rodadas automáticas: até 15 cards usa todos; de 16 a 35 usa 10; acima de 35 usa 15.
- Cada tentativa começa com 3 corações.
- Cada erro ou pulo consome 1 coração.
- Ao perder os 3 corações, reinicia apenas a rodada atual com os mesmos cards, nova ordem e novas atividades.
- Ao concluir a rodada, cards errados seguem pendentes e ocupam as primeiras vagas da rodada seguinte.
- Vagas restantes são preenchidas com cards novos.
- O percurso termina somente quando não há cards novos nem pendentes.
- Persistência local funciona para qualquer pessoa; contas autenticadas em listas também salvam o estado completo em `study_sessions.cards_order` com modo `mixed-adaptive`.
- O motor novo está isolado em rota própria para preservar o `Study.tsx` existente.
- A recomendação do modo aparece de forma responsiva na landing, hubs e jogos normais.

## Exercícios da primeira versão

- Escrita
- Múltipla escolha
- Organizar frase

Pronúncia não participa ainda porque o componente existente não expõe resultado correto/incorreto ao motor; ele fornece apenas avanço. Ela deve entrar quando esse contrato for ampliado sem simular acertos falsos.

## Arquivos principais

- `src/features/study/lib/adaptiveMixedSession.ts`
- `src/features/study/hooks/useAdaptiveMixedSession.ts`
- `src/pages/MixedStudy.tsx`
- `src/features/study/components/MixedModeRecommendationBubble.tsx`
- `src/pages/GamesHub.tsx`
- `src/pages/PublicClassGamesHub.tsx`
- `src/App.tsx`
