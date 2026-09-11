---
cssclasses:
  - ape-ai-note
---

# Decisões

## Preservar a identidade

Evolução do App Piteco atual; não criar uma nova aplicação nem substituir a linguagem visual.

## Mobile-first

Uma tela só é aprovada depois de funcionar nos seis tamanhos móveis exigidos, além de tablet e desktop.

## Efeitos com função

Microinterações devem comunicar toque, acerto, erro, progresso ou conclusão. Sem blur pesado, partículas constantes, flashes ou animações que causem layout shift.

## Dados fora do escopo

Não tocar em Supabase, RLS, auth, sessões, progresso, importadores, algoritmos ou persistência durante o polimento visual.

## Evidência antes da afirmação

Testes estáticos não substituem screenshot, interação real e inspeção do console. Lovable preview deve ser usado se estiver disponível; se não, documentar a limitação.

## Integração

Commits lógicos e reversíveis. Não fazer merge, push ou publicação sem o gate final e revisão do diff.
