# Inventário do Visual Experience Supervisor

## Estado e hipótese

Hipótese da auditoria: o App Piteco pode ganhar um terceiro sistema visual expressivo sem duplicar telas, alterar persistência de estudo ou tocar no banco, desde que aparência, paleta e estilo deixem de ser o mesmo eixo.

Estado desta entrega: auditoria e síntese somente. Nenhuma alteração funcional, migration, RPC, Auth, RLS, chave, project ref, publicação ou escrita remota foi executada.

## Entrada recebida e limite conhecido

- A especificação principal termina no início da seção 8.
- A continuação recebida começa na seção 20.
- As seções 9 a 19 não estavam nos anexos. Antes da implementação completa, elas precisam ser recuperadas ou declaradas inexistentes.
- Trechos corrompidos por marcadores `contentReference` na continuação foram interpretados somente como falhas de colagem, sem inventar requisitos.

## Baseline de código

- Base auditada: `origin/main` em `28cf7c97`.
- Branch de auditoria: `codex/ui-aaa-audit-synthesis`.
- O checkout principal e suas mudanças locais não foram alterados.
- Publicação continua exclusivamente pela Lovable.
- Backend de contas e dados de produção: `ymahldldyxvwjeruaxpr`.
- Projeto Supabase administrativo: `xrnfhhoxmmstagmelvyi`.
- O novo estilo não requer banco; a preferência deve permanecer local nesta série até existir um contrato explícito e testado para sincronização entre dispositivos.

## Arquitetura visual encontrada

- `src/lib/palettes.ts` define `black`, `green`, `white` e `galaxy`.
- A paleta hoje também força `light` ou `dark`; portanto, aparência e paleta não são independentes.
- `galaxy` combina cor e efeitos visuais, funcionando parcialmente como estilo.
- `src/hooks/usePalette.ts` persiste `ape:palette` localmente e sincroniza entre abas.
- `src/hooks/useTheme.ts` mantém outro estado local de tema, com contrato diferente.
- O script inicial em `index.html` lê `theme`, mas não `ape:palette`; há risco de primeiro frame incorreto.
- A cascata está distribuída entre `index.css`, `space-ui-v1.css` e `space-layouts.css`, com seletores amplos, identificadores legados e `!important`.
- Não foi encontrada preferência visual persistida no perfil do usuário.

## Superfícies inventariadas

- Experiência pública: landing, páginas SEO, autenticação e perfis públicos.
- Shell privado: header, sidebar, navegação inferior, home, biblioteca, pastas, listas, metas, loja, perfil e notificações.
- Hub e preparação de sessão: modos, presets e configurações.
- Estudo: Flip, Escrever, Múltipla escolha, Organizar frase, Misto, Pronúncia, Rodadas de Domínio e Fluxo Contínuo.
- Professor, aluno, turmas e administração.
- Estados transversais: loading, vazio, erro, offline, modais, drawers, foco, teclado, touch e conteúdo longo.

## Evidências determinísticas

- Typecheck: passou.
- Vitest: 184 arquivos e 1.131 testes passaram.
- Lint: 0 erros e 69 avisos preexistentes.
- Build Vite: compilou 3.880 módulos; a etapa posterior de descoberta pública ficou `BLOCKED_EXTERNAL` por indisponibilidade de dados/RPC público.
- Orçamento direto: JavaScript gzip total aproximado de 1.009 KiB; maior chunk aproximado de 219 KiB gzip; CSS aproximado de 44 KiB gzip.
- Pontuação local de visibilidade SEO: 100/100.
- Viewports inspecionados: 320×568, 390×844 e 1440×900, sem overflow horizontal na landing.
- A landing ocupa aproximadamente 28,7 viewports em 320 px e 8 viewports em desktop, indicando excesso de comprimento mobile.
- Regressão confirmada: abrir `/pt-br` sem sessão redireciona para `/auth`.

## Riscos prioritários

- P0 — classificação divergente de rotas públicas entre shell e guarda de sessão.
- P1 — baixo contraste e excesso de texto atenuado/transparência.
- P1 — aparência, paleta e estilo acoplados; migração ingênua pode quebrar preferências existentes.
- P1 — ausência de contrato visual automatizado e matriz de screenshots.
- P1 — controles não semânticos, ações apenas em hover e lacunas de nome acessível.
- P1 — componentes de estudo muito grandes e apresentação acoplada a lógica crítica.
- P2 — primeiro frame e splash podem discordar da preferência persistida.
- P2 — landing mobile excessivamente longa.
- P2 — chunks grandes e CSS global com dívida de cascata.

## Fronteiras de segurança

- Não alterar project refs, Auth, RLS, migrations, RPCs ou dados.
- Não duplicar engines de estudo nem reimplementar persistência.
- Não prometer sincronização entre dispositivos sem backend próprio para preferências.
- Não carregar ilustrações pesadas no caminho crítico.
- Não remover estilos ou preferências antigas durante a migração.
- Não incluir páginas privadas em sitemap, `llms.txt` ou conteúdo público.

## Próxima decisão

O supervisor recomenda “Piteco Play”, detalhado em `99-supervisor-synthesis.md`, condicionado a:

1. recuperar ou dispensar explicitamente as seções 9–19;
2. corrigir a classificação de rotas públicas em PR isolado;
3. aprovar uma série incremental de PRs, sem merge ou publicação automática.
