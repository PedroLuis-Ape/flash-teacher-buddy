# RASCUNHO — Matriz de rotas, acesso e indexabilidade

> Documento de auditoria. Nenhuma classificação abaixo deve ser tratada como mudança definitiva sem validar autenticação, resposta HTTP, conteúdo e regras do Supabase.

## Legenda

- **INDEX**: página pública com valor próprio, canonical e inclusão possível no sitemap.
- **INDEX CONDICIONAL**: somente quando a entidade estiver publicada, pesquisável, disponível e com conteúdo suficiente.
- **NOINDEX**: pode ser acessível, mas não deve aparecer em mecanismos de busca.
- **PRIVADA**: exige autenticação/autorização e também deve usar noindex.
- **TÉCNICA**: callback, redirecionamento, erro ou rota operacional.

## Rotas estáticas

| Rota | Componente/área | Classe atual proposta | Sitemap | Pré-render | Observação de auditoria |
|---|---|---:|---:|---:|---|
| `/` | entrada pública | INDEX | sim | sim | pode virar `x-default` ou versão principal; decisão aberta |
| `/landing` | landing legada | TÉCNICA | não | não | manter redirecionamento permanente para canonical |
| `/dashboard` | painel | PRIVADA | não | não | bloquear acesso anônimo e emitir noindex |
| `/ingles-para-iniciantes` | conteúdo editorial | INDEX | sim | sim | candidata a `/pt-br/ingles-para-iniciantes` |
| `/atividades-de-ingles` | conteúdo editorial | INDEX | sim | sim | candidata a versão inglesa com pesquisa própria |
| `/flashcards-de-ingles` | conteúdo editorial | INDEX | sim | sim | não traduzir palavra-chave de forma literal sem pesquisa |
| `/para-professores` | caso de uso | INDEX | sim | sim | criar equivalente natural em inglês |
| `/about` | autoria/institucional | INDEX | sim | sim | reforçar autoria, metodologia e data de revisão |
| `/portal` | diretório público | INDEX | sim | sim | conteúdo dinâmico precisa HTML inicial e política de qualidade |
| `/auth` | autenticação | NOINDEX | não | não | `noindex,nofollow`; não expor mensagens sensíveis |
| `/auth/callback` | callback | TÉCNICA | não | não | `noindex,nofollow`; evitar conteúdo indexável |
| `/profile` | conta | PRIVADA | não | não | dados pessoais |
| `/folders` | organização pessoal | PRIVADA | não | não | conteúdo privado por padrão |
| `/glossary` | glossário da conta | PRIVADA | não | não | não confundir com glossário editorial público |
| `/search` | busca interna | NOINDEX | não | não | evitar indexação de combinações infinitas de busca |
| `/store` | loja interna | PRIVADA | não | não | não usar como página pública de preços |
| `/store/inventory` | inventário | PRIVADA | não | não | dados da conta |
| `/store/exchange` | câmbio interno | PRIVADA | não | não | dados da conta |
| `/gifts` | presentes | PRIVADA | não | não | conteúdo transacional |
| `/reinos` | gamificação | PRIVADA | não | não | não indexar estado individual |
| `/reino` | alias de gamificação | PRIVADA | não | não | avaliar redirecionamento interno único |
| `/turmas` | turmas | PRIVADA | não | não | a versão pública deve usar rota pública separada |
| `/turmas/professor` | painel de turmas | PRIVADA | não | não | dados de professor/alunos |
| `/turmas/aluno` | painel de turmas | PRIVADA | não | não | dados do aluno |
| `/professor/alunos` | gestão de alunos | PRIVADA | não | não | dados educacionais pessoais |
| `/my-teachers` | professores vinculados | PRIVADA | não | não | relação de conta |
| `/painel-professor` | painel docente | PRIVADA | não | não | não confundir com página pública “para professores” |
| `/settings/public-profile` | edição pública | PRIVADA | não | não | a página editada pode ser pública; a edição nunca |
| `/notes` | notas | PRIVADA | não | não | conteúdo pessoal |
| `/goals` | metas | PRIVADA | não | não | conteúdo pessoal |
| `/goals/new` | criação de meta | PRIVADA | não | não | operacional |
| `/import` | importador | PRIVADA | não | não | arquivos e dados da conta |
| `/import/super` | Super Importador | PRIVADA | não | não | arquivos e dados da conta |
| `/trash` | lixeira | PRIVADA | não | não | conteúdo removido |
| `/settings/performance` | configuração | PRIVADA | não | não | preferência de conta/dispositivo |
| `/settings/shortcuts` | configuração | PRIVADA | não | não | pode existir ajuda pública separada |
| `/audit` | reparo interno | PRIVADA | não | não | ferramenta sensível |
| `/special-cards` | cards especiais | PRIVADA | não | não | avaliar se há página editorial pública separada |
| `/system-status` | status interno | NOINDEX | não | não | se virar status público, usar domínio/rota específica |
| `/reportar-problema` | suporte | NOINDEX | não | não | pode haver página pública de contato separada |

## Rotas dinâmicas privadas

| Família | Classe | Regra |
|---|---:|---|
| `/folder/:id` | PRIVADA | pasta da conta; autenticação e autorização obrigatórias |
| `/list/:id` | PRIVADA | lista da conta; nunca entrar no sitemap |
| `/list/:id/games` | PRIVADA | modo utilitário; noindex mesmo quando acessível |
| `/list/:id/study` | PRIVADA | modo utilitário; noindex |
| `/list/:id/mixed-study` | PRIVADA | modo utilitário; noindex |
| `/collection/:id` | PRIVADA | coleção interna; usar rota pública separada quando publicada |
| `/collection/:id/games` | PRIVADA | modo utilitário |
| `/collection/:id/study` | PRIVADA | modo utilitário |
| `/collection/:id/mixed-study` | PRIVADA | modo utilitário |
| `/reino/:code` | PRIVADA | estado de gamificação |
| `/reino/importar` | PRIVADA | operação de importação |
| `/admin/catalog` | PRIVADA | autorização administrativa forte |
| `/admin/logs` | PRIVADA | dados operacionais sensíveis |
| `/admin/gifts` | PRIVADA | autorização administrativa forte |
| `/turmas/:turmaId` | PRIVADA por padrão | separar claramente da eventual rota de turma pública |
| `/turmas/:turmaId/import/super` | PRIVADA | importação de conteúdo da turma |
| `/professor/alunos/:alunoId` | PRIVADA | dado educacional pessoal |
| `/professores/:professorId` | ambígua | auditar: nome sugere perfil, mas não está no namespace público `/portal` |
| `/notes/:id` | PRIVADA | nota pessoal |

## Rotas públicas dinâmicas

| Família | Classe | Canonical | Sitemap | Resposta ausente |
|---|---:|---|---:|---|
| `/portal/professor/:slug` | INDEX CONDICIONAL | URL própria e estável | dinâmico | 404 ou 410 real |
| `/portal/folder/:id` | INDEX CONDICIONAL | avaliar slug, ID ou URL editorial | dinâmico | 404/410 real |
| `/portal/collection/:id` | INDEX CONDICIONAL | URL própria somente se material tiver qualidade | dinâmico | 404/410 real |
| `/portal/list/:id/games` | NOINDEX | canonical para página editorial da lista | não | 404 real |
| `/portal/list/:id/study` | NOINDEX | canonical para página editorial da lista | não | 404 real |
| `/portal/list/:id/mixed-study` | NOINDEX | canonical para página editorial da lista | não | 404 real |
| `/portal/collection/:id/study` | NOINDEX | canonical para coleção pública | não | 404 real |
| `/portal/collection/:id/mixed-study` | NOINDEX | canonical para coleção pública | não | 404 real |

## Rota coringa

| Rota | Classe | Requisito |
|---|---:|---|
| `*` | TÉCNICA | tela com noindex já existe; hospedagem deve devolver HTTP 404 real |

## Pares internacionais candidatos

| Português atual/proposto | Inglês proposto | Estado |
|---|---|---|
| `/pt-br/` | `/en/` | demonstrado no preview |
| `/pt-br/recursos` | `/en/features` | proposta |
| `/pt-br/flashcards` | `/en/flashcards` | proposta |
| `/pt-br/para-professores` | `/en/for-teachers` | proposta |
| `/pt-br/sobre` | `/en/about` | proposta |
| `/pt-br/ingles-para-iniciantes` | `/en/english-for-beginners` | validar intenção de busca em inglês |
| `/pt-br/atividades-de-ingles` | `/en/english-learning-activities` | validar intenção de busca em inglês |

## Testes necessários antes de aprovar a matriz

1. Acessar cada rota sem sessão e registrar status HTTP e conteúdo recebido.
2. Repetir com usuário autenticado comum, professor e administrador.
3. Verificar se conteúdo privado aparece no HTML inicial, logs, JSON-LD ou respostas públicas.
4. Confirmar canonical, robots e `html lang` por página.
5. Confirmar que o sitemap não inclui rotas privadas ou utilitárias.
6. Simular entidade pública existente, removida, privada e não pesquisável.
7. Verificar loops e cadeias de redirecionamento.
8. Validar mobile e navegação por teclado.
9. Auditar URLs antigas antes de qualquer redirecionamento internacional.
10. Definir quais páginas públicas dinâmicas possuem conteúdo suficiente para indexação.
