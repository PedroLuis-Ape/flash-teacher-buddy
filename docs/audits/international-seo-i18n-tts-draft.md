# RASCUNHO — Auditoria internacional, SEO/GEO e TTS do App Piteco

> Estado: rascunho vivo para revisão. Não representa decisão definitiva e não autoriza merge, migration ou publicação.
>
> Branch: `draft-international-seo-i18n-audit`
>
> Base: Plano Mestre de Auditoria e Implementação, código atual da `main` e consulta somente leitura ao Supabase oficial `xrnfhhoxmmstagmelvyi`.

## 1. Objetivo deste rascunho

Organizar uma implementação gradual para que o APE/App Piteco seja:

- encontrável por mecanismos de busca;
- legível e citável por mecanismos de IA;
- seguro para conteúdo público e privado;
- preparado para páginas públicas em português e inglês;
- capaz de separar idioma da interface, idioma do conteúdo e locale do TTS;
- compatível com dados, importadores e fluxos existentes;
- testável em uma branch e em Deploy Preview antes de qualquer decisão definitiva.

## 2. Regra de segurança do trabalho

Durante a fase de rascunho:

- nenhuma mudança será mesclada na `main`;
- nenhuma migration será aplicada no Supabase de produção;
- nenhuma preferência de usuário existente será alterada;
- nenhuma rota pública atual será removida;
- nenhum fluxo privado será transformado em página indexável;
- o preview deve usar conteúdo demonstrativo e ser marcado como `noindex`;
- decisões ainda abertas ficam registradas como hipóteses, não como requisito fechado.

## 3. Estado atual confirmado

### 3.1. Aplicação e build

- React 18 + Vite 6 + React Router 6.
- O build executa Vite, pré-renderização de páginas públicas, validação do HTML pré-renderizado e verificação de bundle.
- `react-helmet-async` já controla metadados por página.
- `i18next`, `react-i18next` e detector de idioma já estão instalados.

### 3.2. Fundação SEO/GEO existente

Já existem:

- `public/robots.txt` separando rotas públicas e privadas;
- `public/sitemap.xml` com páginas públicas canônicas;
- `public/llms.txt` descrevendo produto, autoria e escopo público;
- `SEOHead` com título, descrição, canonical, robots, Open Graph, Twitter Cards, idioma, JSON-LD e alternates;
- sete páginas públicas incluídas no pré-render;
- dados estruturados para site, organização, software, página, breadcrumb e recursos de aprendizagem;
- validação automatizada do conteúdo pré-renderizado;
- redirecionamento do domínio sem `www` para o domínio canônico.

### 3.3. Fundação de internacionalização existente

Já existem:

- recursos em português e inglês;
- detecção por `localStorage`, navegador e atributo do HTML;
- fallback em português;
- persistência local pelo `i18nextLng`;
- arquivos `src/locales/pt/translation.json` e `src/locales/en/translation.json`.

Limitações encontradas:

- os códigos de interface são `pt` e `en`, enquanto o plano trabalha com locales explícitos como `pt-BR`;
- há um único arquivo grande por idioma, sem namespaces por módulo;
- a preferência é local, não está claramente sincronizada com a conta;
- ainda não existe arquitetura pública com URLs `/pt-br/...` e `/en/...`;
- o inventário completo de strings fixas ainda precisa ser gerado;
- não há garantia atual de ausência de português misturado em uma interface inglesa.

### 3.4. Fundação de TTS existente

O estudo já usa `useTTS`, que:

- normaliza códigos de idioma;
- converte códigos curtos para BCP-47;
- busca voz no locale exato e depois no idioma-base;
- cancela áudio anterior;
- trata navegador sem suporte, erro e timeout;
- possui modo natural;
- possui modo didático palavra por palavra;
- interrompe áudio ao esconder ou abandonar a página.

Também existe um registro central de idiomas com inglês, português, espanhol, francês, alemão, italiano, japonês, mandarim, coreano, russo, árabe e hindi.

Risco encontrado:

- `src/lib/AudioService.ts` permanece no projeto como serviço legado e é explicitamente fixo em `en-US` e `pt-BR`;
- todos os imports desse serviço legado precisam ser inventariados antes de remoção ou substituição;
- o registro associa bandeiras a idiomas, embora o plano determine que bandeiras não devem ser a única identificação;
- ainda não há preferência persistida de voz, sotaque ou modo de pronúncia na conta.

### 3.5. Banco atual — consulta somente leitura

Campos relacionados a conteúdo e áudio encontrados:

- `folders.lang_a`;
- `folders.lang_b`;
- `folders.tts_enabled`;
- `lists.lang`;
- `lists.lang_a`;
- `lists.lang_b`;
- `lists.tts_enabled`;
- `flashcards.lang`.

Não foram encontrados, nesta primeira consulta:

- `interface_locale`;
- `explanation_locale`;
- `preferred_tts_locale`;
- `preferred_tts_voice`;
- `pronunciation_mode`;
- `timezone`;
- preferências regionais de data, número e moeda.

Nenhuma alteração de banco é proposta como definitiva neste rascunho.

## 4. Matriz preliminar de rotas

### 4.1. Públicas e indexáveis hoje

| Rota | Tipo | Estado sugerido |
|---|---|---|
| `/` | institucional | indexável e pré-renderizada |
| `/portal` | diretório público | indexável, mas precisa estratégia dinâmica |
| `/ingles-para-iniciantes` | conteúdo educacional | indexável e pré-renderizada |
| `/atividades-de-ingles` | conteúdo educacional | indexável e pré-renderizada |
| `/flashcards-de-ingles` | conteúdo educacional | indexável e pré-renderizada |
| `/para-professores` | caso de uso | indexável e pré-renderizada |
| `/about` | institucional/autoria | indexável e pré-renderizada |

### 4.2. Públicas condicionais

Só devem ser indexáveis quando a entidade estiver explicitamente publicada, possuir conteúdo suficiente e tiver URL estável.

| Família de rota | Risco atual | Direção do rascunho |
|---|---|---|
| `/portal/professor/:slug` | perfil vazio, removido ou não pesquisável | canonical próprio; 404/410 real quando inválido |
| `/portal/folder/:id` | ID opaco e conteúdo possivelmente removido | avaliar slug estável; index apenas se público |
| `/portal/collection/:id` | conteúdo raso ou duplicado | index condicionado à qualidade e disponibilidade |
| rotas públicas de estudo/jogo | páginas utilitárias e conteúdo duplicado | normalmente `noindex,follow`; indexar página editorial do material, não cada modo |

### 4.3. Privadas e não indexáveis

- `/dashboard`;
- `/profile`;
- `/folders`;
- `/folder/:id`;
- `/list/:id` e modos de estudo privados;
- `/collection/:id` privada;
- `/search`;
- `/store`, inventário e troca;
- `/gifts`;
- `/reinos` e detalhes internos;
- `/turmas` e painéis de professor/aluno;
- `/professor/alunos/*`;
- `/my-teachers`;
- `/painel-professor`;
- `/notes`, `/goals`, `/trash`;
- importadores;
- configurações;
- auditoria, status e relatório de problema;
- todas as rotas administrativas.

A autenticação e as políticas de acesso continuam sendo a proteção real. `noindex` é apenas uma diretiva adicional.

### 4.4. Rotas técnicas

| Rota | Tratamento |
|---|---|
| `/auth` | `noindex,nofollow` |
| `/auth/callback` | `noindex,nofollow`, nunca no sitemap |
| `/landing` | manter redirecionamento permanente para a canonical escolhida |
| rota inexistente | HTML/tela com `noindex`, mais status HTTP 404 real |
| entidade pública removida permanentemente | avaliar HTTP 410 |

## 5. Auditoria SEO/GEO — lacunas principais

### P0 — segurança e coerência

1. Confirmar que toda rota privada possui proteção real e não depende apenas do `robots.txt`.
2. Impedir inclusão de dados privados no sitemap, JSON-LD, pré-render ou `llms.txt`.
3. Verificar se a hospedagem devolve HTTP 404/410 real para rotas e entidades ausentes.
4. Garantir que a SPA fallback não transforme todas as URLs inválidas em HTTP 200 indexável.
5. Definir contrato único para classificar uma entidade como pública, pesquisável e indexável.

### P1 — descoberta internacional

1. Definir mapa de URLs em português e inglês.
2. Criar pares recíprocos de `hreflang`.
3. Garantir canonical própria para cada idioma.
4. Pré-renderizar HTML localizado.
5. Gerar sitemap internacional a partir de uma fonte de configuração única.
6. Traduzir e revisar conteúdo, não apenas botões e metadados.
7. Criar páginas de metodologia, autoria, recursos e casos de uso com evidência própria.

### P1 — citabilidade por IA

1. Manter `llms.txt` factual e sincronizado com URLs canônicas.
2. Criar páginas autorais que expliquem metodologia e recursos em profundidade.
3. Identificar claramente produto, organização, fundador e responsáveis pelo conteúdo.
4. Usar dados estruturados somente para informações visíveis.
5. Disponibilizar HTML inicial sem depender de execução de JavaScript.
6. Evitar páginas automáticas rasas, repetitivas ou sem autoria.
7. Criar política de atualização e data de revisão dos conteúdos editoriais.

### P2 — conteúdo público dinâmico

1. Sitemap de professores e materiais públicos.
2. URLs estáveis e legíveis.
3. HTML inicial para perfis e materiais.
4. Política para conteúdo curto, duplicado, arquivado ou removido.
5. Breadcrumb e links internos entre professor, material, nível e tema.

## 6. Arquitetura internacional proposta para avaliação

### 6.1. URLs públicas

Proposta de primeira fase:

```text
/pt-br/
/pt-br/recursos
/pt-br/flashcards
/pt-br/para-professores
/pt-br/sobre

/en/
/en/features
/en/flashcards
/en/for-teachers
/en/about
```

As rotas atuais em português não devem desaparecer imediatamente. Possibilidades a avaliar:

- manter URLs atuais como canonicals temporárias e lançar somente novas páginas em inglês;
- redirecionar gradualmente as URLs atuais para `/pt-br/...`;
- preservar URLs portuguesas existentes e usar `/en/...` apenas para inglês.

A decisão depende de dados reais de indexação e risco de perda de tráfego.

### 6.2. Separação de conceitos

| Conceito | Exemplo | Onde deve viver |
|---|---|---|
| idioma da interface | `pt-BR` | preferência de conta + fallback local |
| idioma das explicações | `pt-BR` | preferência pedagógica |
| idioma do lado A | `en` ou `en-US` | lista/pasta/conteúdo |
| idioma do lado B | `pt-BR` | lista/pasta/conteúdo |
| locale do TTS | `en-US`, `en-GB` | lista/card + preferência de voz |
| idioma da página pública | `en` | rota e metadados |

Nenhuma dessas configurações deve ser inferida automaticamente a partir de uma única variável `language`.

## 7. Fundação de i18n — proposta de evolução

Estrutura a avaliar:

```text
src/locales/
  pt-BR/
    common.json
    auth.json
    navigation.json
    dashboard.json
    study.json
    games.json
    glossary.json
    importer.json
    settings.json
  en/
    common.json
    auth.json
    navigation.json
    dashboard.json
    study.json
    games.json
    glossary.json
    importer.json
    settings.json
```

Regras:

- chaves sem frases completas;
- pluralização nativa do i18next;
- interpolação em vez de concatenação;
- relatório de chaves ausentes no CI;
- fallback explícito;
- carregamento por namespace;
- tradução gradual por módulo;
- nenhuma tela deve misturar idiomas silenciosamente.

## 8. TTS — proposta de consolidação

### Manter

- `useTTS` como base do estudo;
- normalização BCP-47;
- cancelamento de áudio anterior;
- modo natural;
- modo palavra por palavra;
- fallback por idioma-base;
- tratamento de timeout e navegador incompatível.

### Auditar antes de alterar

- imports ativos de `AudioService`;
- componentes que chamam `speechSynthesis` diretamente;
- persistência atual de velocidade;
- comportamento no Chrome Android e Safari iOS;
- mudança rápida de card;
- reprodução em segundo plano;
- disponibilidade de `en-GB`, `es-MX` e outros locales.

### Preferências candidatas

```text
interface_locale
explanation_locale
preferred_tts_locale
preferred_tts_voice
speech_rate
pronunciation_mode
```

O formato de armazenamento ainda não está decidido. Avaliar tabela de preferências, JSON versionado ou colunas explícitas.

## 9. Backlog preliminar

### P0

- matriz completa de rotas e proteção;
- teste de status HTTP 404/410;
- inventário de strings fixas;
- inventário de usos de TTS legado;
- contrato público/privado para entidades dinâmicas;
- rollback e feature flags;
- compatibilidade dos importadores.

### P1

- seletor de idioma acessível;
- persistência de idioma na conta;
- namespaces de tradução;
- páginas públicas em inglês;
- hreflang recíproco;
- sitemap internacional;
- pré-render localizado;
- canonical por idioma;
- páginas de metodologia e autoria;
- monitoramento de Core Web Vitals.

### P2

- sitemap dinâmico de professores e materiais;
- conteúdo editorial contínuo;
- espanhol;
- preferências avançadas de voz;
- dados estruturados específicos por material;
- central de ajuda localizada.

### P3

- preços e moedas regionais;
- idiomas RTL;
- tradução colaborativa;
- serviço externo de TTS com cache;
- painel editorial de traduções.

## 10. Sequência futura de implementação — ainda não aprovada

1. Auditoria e linha de base.
2. Feature flags e testes de segurança.
3. Organização dos arquivos de i18n.
4. Seletor de idioma e persistência.
5. Migração gradual de autenticação e navegação.
6. Rotas públicas localizadas em preview.
7. Pré-render, sitemap, canonical e hreflang localizados.
8. Consolidação do TTS e preferências.
9. Conteúdo público dinâmico.
10. Monitoramento e lançamento gradual.

## 11. Preview desta branch

A branch contém uma demonstração isolada em:

```text
/previews/international-seo-draft/
/previews/international-seo-draft/pt-br/
/previews/international-seo-draft/en/
```

O preview demonstra:

- seleção entre Português e English;
- URLs localizadas reais dentro do Deploy Preview;
- indicação visual de canonical e hreflang pretendidos;
- separação entre idioma da interface e locale do áudio;
- TTS nativo em `pt-BR` e `en-US`;
- conteúdo equivalente, mas localizado de forma natural;
- layout responsivo;
- marcação `noindex` para que o protótipo não seja indexado.

## 12. Decisões abertas

1. As URLs portuguesas atuais serão mantidas ou migradas para `/pt-br/`?
2. A página inicial `/` será `x-default`, seletor ou versão portuguesa?
3. Perfis públicos usarão slug permanente ou ID?
4. Listas públicas podem ser indexadas diretamente ou apenas páginas editoriais associadas?
5. Qual conteúdo em inglês será revisado por humano antes da publicação?
6. Preferências internacionais ficam em tabela própria ou em perfil versionado?
7. Espanhol entra apenas depois da estabilização completa de português e inglês?
8. O TTS continuará exclusivamente nativo ou haverá serviço externo opcional?

## 13. Critério para transformar o rascunho em plano definitivo

O documento só deve virar plano de implementação quando houver aprovação explícita sobre:

- mapa de URLs;
- páginas públicas e privadas;
- modelo de preferências;
- estratégia de migração das URLs atuais;
- escopo inicial de tradução;
- comportamento do TTS;
- conteúdo editorial mínimo;
- testes e rollback;
- sequência de lançamento.
