# App Piteco — relatório de auditoria visual e responsividade

Data: 2026-09-11  
Branch: `fix/mobile-visual-audit-20260910`  
Escopo: polimento visual, responsividade, overlays, feedback e hierarquia dos jogos. A lógica de negócio, Supabase, autenticação, progresso, sessões, importação, exportação, algoritmos e SEO não foram alterados.

## Diagnóstico

O problema recorrente era de composição responsiva, não de identidade visual: a barra inferior ocupava o espaço dos cards em algumas rotas; ações e rodapés de overlays competiam com o viewport; e o Hub de jogos apresentava modos e recomendações sem uma hierarquia suficientemente clara em telas pequenas. A publicação atual ainda exibe o comportamento antigo em alguns desses pontos porque não contém esta branch.

## Regra implementada

- Conteúdo de páginas privadas reserva espaço para a navegação móvel e safe-area.
- Overlays usam altura dinâmica (`dvh`/`svh`), corpo com scroll interno e footer acessível.
- Alvos importantes preservam área de toque e foco visível.
- O Hub distingue modos por semântica e estado (`recomendado`, `configurado`, `beta`) sem alterar o lançamento do jogo.
- Feedback de estudo usa estados explícitos, movimento leve e `prefers-reduced-motion`.
- Efeitos decorativos continuam opcionais e não são necessários para compreender a informação.

## Alterações por bloco

1. Shell e tokens: safe-area, área segura inferior, agrupamento de ações, foco e reduced-motion.
2. Home, biblioteca, pastas e detalhe de lista: hierarquia, ações móveis e espaço para a tab bar.
3. Overlays: `Dialog`, `AlertDialog`, `Sheet`, `Popover`, `DropdownMenu`, `Select`, importação/exportação, pasta, card e camadas.
4. Jogos: hierarquia do Hub, recomendações, reserva para chrome móvel e descrições acessíveis.
5. Estudo: feedback, conclusão, ferramentas, ponto de atenção e transições sem bloquear leitura.

## Rotas auditadas

### Privadas

`/dashboard`, `/folders`, `/reinforcement`, `/glossary`, `/profile`, `/goals`, `/store`, `/notes`, `/special-cards`, `/turmas`, `/import`, `/trash`, `/settings/performance`, `/settings/shortcuts`, `/audit`, `/search`, `/list/:id`, `/list/:id/games`.

### Jogos

`study?mode=flip`, `study?mode=write`, `study?mode=multiple`, `study?mode=unscramble`, `study?mode=pronunciation`, `mixed-study?mode=mixed`.

### Públicas/editoriais

`/landing`, `/portal`, `/pt-br/metodologia`, `/pt-br/evidencias`, `/about` e rota 404.

Nas rotas navegadas em Chrome, todas as medições registraram `hasHOverflow: false`. A passagem privada esperou o carregamento dos dados antes de registrar o resultado.

Uma passagem adicional navegou nominalmente pelas rotas editoriais públicas em português e inglês (`/`, `/landing`, páginas de iniciantes, atividades, flashcards, professores, `/pt-br/*`, `/en/*`, `/about`), pelo `/portal` e por uma rota 404. Todas retornaram título compatível com a rota; `/` redirecionou para `/dashboard` conforme o comportamento de entrada autenticada.

## Interações reais

- Landing: revelar o cartão demonstrativo e abrir uma pergunta do FAQ.
- Escrita: preencher o campo, confirmar foco e verificar que `Corrigir` permanece visível e habilitado; também verificado em landscape.
- Estudo: abrir e fechar o menu de configurações da sessão.
- Biblioteca: abrir e cancelar `Nova Pasta` sem criar dados.
- Hub: carregar e inspecionar os seis modos, switches e recomendação.
- Console do build local: nenhum `error` ou `warning` capturado durante a inspeção pública.

## Viewports

Matriz final verificada em CSS: `320x568`, `360x800`, `375x812`, `390x844`, `412x915`, `430x932`, `768x1024`, `1280x720`, `1366x768`, `1440x900`, `1920x1080`.

Também foi verificado landscape mobile (`844x390`) para o modo de escrita: campo e `Corrigir` permaneceram acessíveis, sem overflow horizontal.

## Screenshots e comparação

- Referências antes/publicação atual: `artifacts/visual-polish/production-*-baseline.png`.
- Matriz de estudo conferida: `artifacts/visual-polish/exact-study-*.png`.
- Conjuntos de atenção e jogos estão nomeados por rota e viewport na mesma pasta.
- A landing local da branch foi reaberta em `http://127.0.0.1:4318/landing` e comparada visualmente em 390px; a composição manteve o hero, CTA, demonstração e passos sem corte.

## Efeitos adicionados ou reduzidos

Adicionados/refinados: press feedback, foco, transições curtas de estado, feedback de resposta, entrada suave da recomendação e progressão visual do Hub.  
Reduzidos: transformações e animações em reduced-motion/performance; não foram adicionadas bibliotecas pesadas, partículas contínuas, blur global ou animações de layout.

## Validação técnica

Executada na branch com os binários versionados em `node_modules`:

- typecheck app e node: passou;
- Vitest completo: 249 arquivos, 1.542 testes passaram;
- lint: exit 0, 0 errors e 72 warnings existentes;
- build Vite + cadeia de prerender: passou;
- `seo:visibility:score`: 100/100;
- `preview:smoke` em porta isolada: passou, incluindo mobile 360/390/412 e estados de falha.

## Ciclos e riscos restantes

Foram concluídos seis blocos incrementais de implementação, uma segunda passagem global de rotas, uma rodada dedicada de viewport, recalibração do DPR do Chrome e uma re-inspeção visual de landing, Hub e estudo. O número de ciclos não foi contado individualmente por cada rota; os registros acima são a contagem confiável disponível.

O projeto Lovable foi aberto em `https://lovable.dev/projects/b6f1ba83-b44c-4a41-8589-b1e5380cf1ea`, mas o próprio editor retornou `You don't have access`: o projeto é privado e a conta conectada (`pedro55luizy@gmail.com`) não tem permissão. Nenhuma solicitação de acesso foi enviada. A aba Chrome publicada foi usada como referência e interação real; o build local foi usado para validar a branch. O merge e a publicação não fazem parte deste relatório e ainda exigem verificação pós-deploy.

Após o usuário relatar que acessou a conta correta, a nova inspeção não encontrou nenhuma aba Chrome exposta à sessão CUA. A tentativa no navegador interno abriu o projeto sem sessão autenticada e exibiu novamente `You don't have access`, com opções de login. A comparação direta do preview permanece pendente de uma aba autenticada acessível à automação.

Também foi tentado o controle direto do Windows pela habilidade Computer Use, mas a ponte retornou `Trusted RPC service is not configured: sky` antes de listar janelas. Nenhuma ação foi executada no desktop.

Durante a navegação repetida da publicação, o console também registrou avisos pré-existentes de `PortalHistorySync`/`EconomyContext` e múltiplas instâncias do GoTrueClient. Como a missão visual proíbe alterações de autenticação, sincronização e backend, esses achados foram mantidos fora do escopo e não foram mascarados.

O preview local não recebeu credenciais nem sessão do usuário. Por isso, o shell do Hub público abriu com os modos renderizados, mas o ID público usado na publicação não foi encontrado pelo runtime local sem configuração de dados; isso limita a validação local do deck, não da composição visual do Hub.

Na checagem final em 320px, o mesmo ID público de amostra também retornou `Lista não encontrada` na publicação, enquanto a pasta pública correspondente continuou listando `002 Negativo`, `003 Interrogativo` e `001 Presente`. O Hub manteve seus controles e seis modos renderizados. Esse achado indica uma inconsistência de dados/publicação fora do escopo visual; não foi alterado para preservar conteúdo e regras do usuário.

## Rollback

Os blocos estão separados nos commits `cc6ccc45`, `b3f0cfc1`, `8181c66e`, `bb2c7e15`, `007709f7`, `1d2b4e02` e `ef9b1148`. Para desfazer com segurança, reverta somente os commits visuais na branch de integração, preservando a alteração pré-existente em `supabase/functions/mcp/index.ts`.
