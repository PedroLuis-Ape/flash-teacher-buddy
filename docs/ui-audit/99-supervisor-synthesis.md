# 99 — Síntese do Visual Experience Supervisor

## Decisão executiva

Direção recomendada: **Piteco Play**.

Piteco Play é um sistema visual opcional, tátil e expressivo, composto por superfícies sólidas, bordas visíveis, sombras curtas e firmes, botões com estado pressionado, silhuetas de card mais memoráveis e acentos próprios de hélice, órbita e adesivo. Ele não muda a engine, o conteúdo, a progressão, a persistência ou o banco.

O novo sistema não deve ser implementado como outra `PaletteId`. O contrato final deve separar:

- `appearance`: `light | dark | system`;
- `visualStyle`: `classic | galaxy | playful`;
- `palette`: cor escolhida, preservando valores legados durante a migração.

O código atual possui quatro paletas, mas apenas duas famílias estruturais reconhecíveis: padrão (`black`, `green`, `white`) e Galaxy. Piteco Play torna-se a terceira família visual sem apagar nenhuma escolha existente.

## Condições antes do primeiro PR funcional

1. Recuperar as seções 9–19 da especificação ou confirmar que não existem.
2. Aprovar a direção Piteco Play e a série de PRs abaixo.
3. Corrigir em PR isolado a divergência que redireciona `/pt-br` e `/en` públicos para autenticação.
4. Manter toda a série sem migration, RPC, Auth, RLS, chave ou escrita em produção.

## Conceitos comparados

### Conceito A — Piteco Soft

- Superfícies sólidas e arredondadas.
- Paleta moderada.
- Sombra curta e movimento discreto.
- Mantém composição próxima da atual.

### Conceito B — Piteco Play

- Superfícies sólidas com contornos nítidos.
- Botões táteis e estados pressed inequívocos.
- Cards com recortes/silhuetas próprias.
- Badges, adesivos e órbitas como acentos contextuais.
- Hierarquia forte, menos transparência, feedback por texto + ícone + forma + cor.
- Densidade “play” em estudo e “work” em professor/admin.

### Conceito C — Piteco Adventure

- Missões, mapas, inventários e cenários ilustrados.
- Maior presença narrativa e celebrações.
- Transformação extensa de navegação, hub e progresso.

## Matriz de decisão

Escala qualitativa: forte, aceitável, fraco. “Forte” significa melhor aderência relativa ao critério, não garantia sem teste.

| Critério | Piteco Soft | Piteco Play | Piteco Adventure |
|---|---|---|---|
| Originalidade | aceitável | forte | aceitável |
| Identidade Piteco | aceitável | forte | forte |
| Legibilidade | forte | forte | aceitável |
| Mobile | forte | forte | fraco |
| Acessibilidade | forte | forte | aceitável |
| Performance | forte | aceitável/forte | fraco |
| Complexidade | forte | aceitável | fraco |
| Manutenção | forte | aceitável/forte | fraco |
| Impacto perceptível | aceitável | forte | forte |
| Baixo risco de cópia | forte | forte | fraco |

Piteco Play vence porque entrega diferença perceptível e autoria sem exigir outro produto, outra engine ou um pacote pesado de assets.

## Sistema Piteco Play

### Tokens semânticos

- Texto: `text-primary`, `text-secondary`, `text-supporting`, `text-disabled`.
- Superfície: `surface-canvas`, `surface-base`, `surface-raised`, `surface-sunken`, `surface-overlay`.
- Ação: `action-primary`, `action-secondary`, `action-danger`, estados hover/pressed/focus/disabled.
- Feedback: `feedback-success`, `feedback-error`, `feedback-warning`, `feedback-info`.
- Produto: `progress`, `xp`, `pitecoin`, `favorite`, `red-focus`, sem substituir feedback semântico.
- Geometria: raios por função, borda visível e sombra curta sem blur excessivo.
- Motion: `instant`, `fast`, `standard`, `celebration`; reduced motion desde o boot.

### Regras de composição

- Texto principal nunca usa opacidade do container.
- Glassmorphism não é base do Playful.
- Hover nunca é a única forma de descobrir uma ação.
- A ação principal do estudo domina o mobile.
- Gamificação não altera recompensa, domínio ou persistência.
- Admin/professor compartilha tokens, mas usa densidade mais sóbria.
- Ilustrações não entram no caminho crítico e não escondem conteúdo.

## Arquitetura e compatibilidade

1. Criar um contrato versionado de preferência visual local.
2. Ler esse contrato no script de primeiro frame antes do React.
3. Migrar sem apagar `ape:palette` e `theme`.
4. Aplicar atributos no elemento raiz; não montar duas árvores.
5. Manter compatibilidade com `black`, `green`, `white` e `galaxy`.
6. Trocar estilo sem reload e sincronizar entre abas.
7. Declarar sincronização entre dispositivos como **não suportada nesta série**, pois não há contrato remoto de preferências.
8. Fornecer rollback por feature flag/build, preservando valores antigos.

## Série de PRs e hipóteses

### PR 0 — Auditoria e decisão

Hipótese: uma síntese versionada reduz divergência e impede que redesign toque invariantes críticas.

- Apenas `docs/ui-audit/`.
- Nenhuma mudança de runtime.

### PR 1 — Manifesto único de rotas públicas

Hipótese: uma fonte tipada única elimina a divergência entre shell, guarda e prerender.

- Corrigir `/pt-br` e `/en` com testes anônimo/autenticado.
- Não ampliar fronteiras público/privado além das rotas já declaradas públicas.

### PR 2 — Fundação de preferência visual

Hipótese: separar appearance/style/palette permite troca sem reload e sem flash, preservando escolhas legadas.

- Contrato versionado, boot, migração local, seletor e preview.
- Sem banco.

### PR 3 — Tokens, primitives e contrato de QA

Hipótese: componentes semânticos reduzem cascata e corrigem contraste/foco sem reescrever telas.

- Tokens, Button/Card/Badge/Text/Surface, motion, harness de screenshots e bundle delta.

### PR 4 — Experiência pública

Hipótese: aplicar Playful sobre HTML semântico e compactar seções melhora mobile sem reduzir SEO.

- Landing, auth e páginas públicas.
- Revalidar prerender, canonical, JSON-LD, sitemap, robots e llms.

### PR 5 — Shell, home e biblioteca

Hipótese: navegação adaptativa e ações semânticas melhoram discoverability sem duplicar desktop/mobile.

### PR 6 — Hub e gameplay

Hipótese: adaptadores visuais e progressive disclosure liberam área útil sem tocar na engine.

- Testes de caracterização antes de qualquer extração.
- Preservar presets, pulo classificado, repetir card, mastery, favoritos, Red Focus, camadas, atalhos e recovery.

### PR 7 — Professor, aluno e classroom

Hipótese: densidade “work” com os mesmos tokens melhora administração sem infantilização ou mudança de autorização.

### PR 8 — Certificação

Hipótese: duas rodadas independentes sem P0/P1 e três execuções críticas estáveis dão evidência suficiente para disponibilização opcional.

## Loop supervisionado por onda

Para cada PR funcional:

1. baseline;
2. alteração focada;
3. testes determinísticos;
4. inspeção visual;
5. red team;
6. correção;
7. reinspeção;
8. relatório em `docs/ui-audit/loops/`.

Limites:

- no máximo 10 ciclos por onda;
- duas rodadas consecutivas sem P0/P1;
- três execuções dos testes críticos;
- duas rodadas de red team;
- `BLOCKED_EXTERNAL` para ambiente, dados, credenciais ou descoberta indisponível;
- resultado final `AAA_APPROVED` ou `AAA_BLOCKED`.

## Gates obrigatórios

- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `npm run build`
- `npm run seo:visibility:score`
- HTML em `dist`, canonical, JSON-LD, sitemap, robots, llms e prerender quando público
- bundle/CSS delta
- contraste e axe
- screenshots mobile/desktop
- fluxo crítico de estudo três vezes
- regressão de estilos Classic e Galaxy

## Veto

- Mobile veta dupla rolagem, CTA oculto, alvo insuficiente ou card comprimido.
- Acessibilidade veta falha AA, foco invisível, interação não semântica ou movimento obrigatório.
- Performance veta aumento não justificado de JS/CSS, jank ou INP acima do alvo.
- Marca veta cópia reconhecível ou perda da identidade Piteco.
- Gameplay veta qualquer mudança de persistência, classificação, domínio, recuperação ou sequência.

## Rollout e rollback

- Disponibilização inicial opcional, com Classic como fallback.
- Feature flag de build para ocultar Playful sem apagar a preferência.
- Se um gate falhar, desabilitar somente o novo estilo.
- Nunca fazer rollback destrutivo de dados ou schema.
- Publicação somente pela Lovable, após revisão humana.
- Nenhum merge, deploy ou publicação automática pelo agente.

## Estado da certificação

`AAA_BLOCKED`

Motivos:

- implementação ainda não começou por regra da própria especificação;
- seções 9–19 não foram recebidas;
- regressão P0 de rota pública precisa de PR isolado;
- build completo depende de descoberta pública externa indisponível no baseline.

O bloqueio não indica falha do conceito. Ele impede declaração prematura de conclusão.
