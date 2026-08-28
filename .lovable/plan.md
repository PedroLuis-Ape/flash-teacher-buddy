# APE multilíngue — pt-BR, en, es, fr, it

Objetivo: internacionalizar a interface existente de ponta a ponta, sem redesenhar telas, sem tocar no motor de estudos, sem alterar schema ou dados de cards.

## Estado atual verificado

- Já existe infraestrutura i18next: `src/i18n/config.ts` com `LanguageDetector`, persistência em `localStorage` (`i18nextLng`), fallback `pt`, e catálogos `src/locales/pt/translation.json` e `src/locales/en/translation.json` (97 linhas cada, ~40 chaves).
- Somente 3 arquivos consomem tradução hoje: `AppSidebar.tsx`, `LanguageSwitcher.tsx`, mais os formatadores `src/lib/formatters.ts` e `src/lib/dateUtils.ts` (que já leem o locale do i18n).
- O inventário heurístico existente (`scripts/audit-i18n-strings.mjs`) reporta 735 arquivos analisados, 396 com candidatos e 2.779 strings candidatas; há 570 chamadas `toast.*` no código.
- `i18n.language` não é usado por TTS (`src/lib/AudioService.ts`, `src/lib/edgeTTS.ts` não aparecem entre os consumidores) — a auditoria da Fase TTS confirma/documenta isso por arquivo antes de qualquer alteração.

Conclusão: completar a infraestrutura existente, não criar um segundo sistema.

## Arquitetura final

```text
src/i18n/
  index.ts        (init único, re-export compatível com src/i18n/config.ts)
  languages.ts    (AppLocale, APP_LOCALES, fallback, locale Intl)
  detect.ts       (precedência de locale)
  resources/
    pt-BR/ en/ es/ fr/ it/
      common.json auth.json home.json nav.json library.json study.json
      settings.json import.json teacher.json store.json goals.json errors.json
```

- `AppLocale = "pt-BR" | "en" | "es" | "fr" | "it"`; `pt` legado é normalizado para `pt-BR` (usuários atuais não perdem o idioma).
- Precedência: escolha explícita → preferência persistida → idioma compatível do navegador → `pt-BR`.
- Persistência em `localStorage` (sem migration de banco). Sincronização cross-device fica documentada como melhoria futura.
- `document.documentElement.lang` atualizado na troca; troca sem reload, preservando rota, sessão, card e formulário.
- Seletor: `LanguageSwitcher` existente ganha os 5 idiomas com nomes nativos; nenhuma tela é redesenhada.

## Regras invioláveis

- Nenhum conteúdo do usuário passa por `t()`: nomes de listas, pastas, termos, traduções de cards, glossários, explicações, nomes de alunos/professores, conteúdo importado.
- Idioma da interface é independente de `lang_a`/`lang_b`. Trocar interface nunca altera idiomas da lista.
- TTS continua derivando voz do lado do card (`langA`/`langB`), nunca de `i18n.language`. Normalizador de locale de voz (pt/pt-BR, en/en-US/en-GB, es, fr, it) se necessário.
- Identidade sempre por enum/ID (`scope === "favorites"`, `activityMode === "rewrite"`), nunca por texto traduzido.
- `technicalId`, códigos de erro, IDs e logs não são traduzidos.

## Ordem de execução (loop auditar → implementar → traduzir → testar → reauditar)

1. Infra canônica + `languages.ts` + precedência + seletor + scripts de auditoria/validação.
2. Navegação + Home (prioridade escolhida): sidebar, bottom bar, headers, breadcrumbs, dialogs de navegação.
3. Auth + onboarding.
4. Biblioteca: pastas, listas, coleções, busca, lixeira.
5. Study: Flip, Write, Reescrever, Traduzir, Multiple Choice, Unscramble, Pronunciation, Mixed, Mastery/Rodadas, Extenso, Favoritos, Lista Vermelha, cards em camadas — instruções, botões, feedback, progresso, resultados, recovery, loading, empty states.
6. Configurações, Perfil, Metas.
7. Importadores (global, super global, lista existente, JSON/CSV/texto, glossários, preview, reset/undo).
8. Turmas e Painel do Professor.
9. Gamificação, Store, Reinos, presentes.
10. Erros, toasts, acessibilidade e formulários varridos por área a cada lote (não como fase separada no final).
11. SEO público multilíngue (bloco separado, abaixo).

Cada lote: migrar área → traduzir nos 5 idiomas → testes da área nos 5 locales → reauditar → `typecheck` + testes + lint da área.

## Qualidade e consistência

Glossário interno de UI com uma tradução oficial por conceito (Flashcard, Lista, Pasta, Favorito, Lista Vermelha, Modo, Rodada, Sessão, Continuar, Reescrever, Traduzir, Dica, Explicação, Configurações). Espanhol internacional, francês e italiano naturais; pt-BR preservado.

Pluralização pelo i18next; números, datas e tempo relativo por `Intl` usando o locale canônico (reaproveitando `formatters.ts` e `dateUtils.ts`).

## Ferramentas de verificação (novas)

- `scripts/audit-i18n.mjs` + `npm run i18n:audit` — strings de UI prováveis hardcoded, com allowlist explícita (logs, IDs técnicos, nomes próprios, conteúdo de usuário, valores de schema, dados SEO localizados).
- `scripts/validate-i18n-keys.mjs` + `npm run i18n:validate` — paridade dos 5 catálogos: chave ausente, chave extra suspeita, interpolação incompatível, pluralização faltando.
- `renderWithLocale(component, locale)` em test utils; modo estrito que registra `missingKey`/fallback nos testes — uma área só é DONE com `missingKeys = 0` e `fallbackHits = 0`.
- Smoke E2E via Playwright por idioma: Auth → Home → Biblioteca → Pasta → Lista → Study → responder card → configurações → favoritos → sair → continuar sessão → Perfil; fluxo professor; fluxo importador. Teste de troca ao vivo (pt → es → fr → it → pt) preservando estado.
- Layout em 320/375/390/768/1024/desktop, ajustando responsividade quando fr/it estourarem (sem reduzir fonte global).

## Matriz de auditoria

`docs/audits/i18n-audit.md` com colunas: Área | Arquivo | Strings | Internacionalizado | Namespaces | pt-BR | en | es | fr | it | Status. Nenhuma área marcada DONE com texto visível hardcoded.

## SEO público multilíngue (bloco separado)

Analisar a arquitetura pública/prerender existente antes de criar rotas. Escopo: rotas localizadas `/es/`, `/fr/`, `/it/` (pt-BR permanece na raiz, en avaliado junto), `hreflang` recíproco + `x-default`, canonical por locale, `og:locale`/`og:locale:alternate`, sitemap por locale e JSON-LD com `inLanguage` correto. Conteúdo traduzido com revisão de qualidade, sem geração automática em massa. Rotas privadas continuam sem tradução de URL. Este bloco não bloqueia a entrega do app privado e é reportado separadamente.

## Riscos e limites

- Volume alto (~2.779 candidatos, 570 toasts): mudanças incrementais por área, sem reescrita de telas.
- Sem alteração de Supabase project ref, Auth, RLS, migrations, schema ou dados.
- Sem publicação automática. Itens impossíveis de resolver no código são registrados como BLOCKED com evidência, impacto e ação necessária.

## Checks finais

`npm run typecheck`, `npm run test`, `npm run lint`, `npm run build`, `npm run i18n:audit`, `npm run i18n:validate`. Relatório final com tabela ÁREA | pt-BR | en | es | fr | it | TESTADO.
