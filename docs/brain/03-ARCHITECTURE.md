---
cssclasses:
  - ape-ai-note
---

# Arquitetura e limites

## Stack

React 18, TypeScript, Vite, Tailwind, shadcn/ui, Radix, Lucide, React Router, React Query e Supabase.

## Fronteiras

- O polimento deve ser aditivo e visual.
- Handlers, query keys, payloads, identidade de cards, sessões, progresso e persistência permanecem intactos.
- Preferir CSS/Tailwind e componentes existentes; não adicionar biblioteca pesada de animação sem benefício concreto.
- Efeitos móveis devem priorizar `transform` e `opacity`, com `prefers-reduced-motion`.

## Contratos visuais

- `ape-content-safe-bottom` para reserva de conteúdo.
- `ape-action-cluster` para agrupamento responsivo de ações.
- `ape-interactive-surface` para resposta de toque/foco.
- `ape-overlay-scroll` para regiões de overlay roláveis.

## Navegação e dados

Mudanças de navegação são aceitáveis apenas para clareza visual/retorno seguro, sem alterar rotas públicas, auth ou contexto dos dados. Qualquer achado funcional deve ser documentado separadamente.

## Contrato de ambientes Supabase

O mapa de runtime está detalhado em [[areas/supabase-runtime]]. Em resumo,
`src/integrations/supabase/platformRuntime.ts` mantém o projeto de dados de
produção `ymahldldyxvwjeruaxpr` separado do projeto administrado
`xrnfhhoxmmstagmelvyi`. O cliente do navegador deve resolver por
`readPlatformRuntime()`; nenhuma troca parcial de URL, project ref ou chave é
aceitável. Consumidores auxiliares ainda diretos estão marcados como
`[REVALIDATE]` e não devem ser tratados como conformes até auditoria própria.

## Motion proposto

O sistema de motion, quando aprovado, deve ser uma camada visual aditiva e
independente das fronteiras de dados, estudo e navegação. Ver
[[areas/motion-system]] para proposta, alternativas e gate de aprovação.
