# Fluidez de navegação sem perda visual

Relacionado à issue #128 e ao PR #130.

## O que mudou

- O motor visual do Galáxia passou a ser carregado sob demanda.
- CSS exclusivo, listeners, estrelas, cometas e o asset Base64 não entram no shell dos outros temas.
- Durante a pintura inicial de uma nova rota, as animações decorativas são pausadas por poucos quadros e retomadas automaticamente.
- A transição da rota no Galáxia usa somente opacidade e não mantém uma camada `will-change` permanente.

## O que não mudou

- quantidade de estrelas;
- nebulosas, planetas, lua ou poeira;
- cometas;
- resolução dos assets;
- qualidade `standard` ou `high` escolhida pelo usuário;
- presets de desempenho;
- regras do Supabase.

## Roteiro de validação

1. Entrar com uma conta.
2. Usar o tema Preto e navegar por dashboard, pastas, lista, jogos e estudo.
3. Mudar para Galáxia e repetir o mesmo fluxo.
4. Confirmar que todos os elementos visuais continuam presentes.
5. Confirmar que a troca de páginas não apresenta travadas ou deslocamentos de layout.
6. Repetir em desktop e mobile.
