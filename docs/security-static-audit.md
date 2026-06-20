# Auditoria estática das Edge Functions

## Objetivo

Esta verificação é executada localmente e no GitHub Actions. Ela é somente leitura, não acessa o banco, não publica funções e não gera custo adicional.

## O que o CI valida

- cada diretório de função possui `index.ts`;
- cada função explicitamente gerenciada em `supabase/config.toml` possui `verify_jwt` declarado;
- apenas funções registradas como públicas podem usar `verify_jwt = false`;
- funções gerenciadas privadas devem usar `verify_jwt = true`;
- uma função não pode ser simultaneamente pública e classificada como elevada;
- as listas de política não podem apontar para funções inexistentes;
- configurações sem diretório correspondente bloqueiam o CI.

Diretórios legados ainda ausentes de `supabase/config.toml` aparecem como avisos no relatório, e não como aprovação implícita. Isso permite introduzir a auditoria sem alterar em massa funções que ainda não foram verificadas individualmente.

## Política atual

A função `ping` é o único endpoint público permitido. Ela funciona como health check sem leitura ou escrita no banco.

As funções classificadas como elevadas são:

- `kingdoms-import-csv`;
- `audit-ab-consistency`;
- `repair-ab`;
- `announcements-create`.

Essa classificação não concede permissão. Ela registra que essas funções exigem revisão especial, JWT obrigatório e controles explícitos de autenticação e escopo no código.

## Famílias revisadas gradualmente

A família de anúncios agora possui configuração explícita:

- `announcements-create`: privada, JWT obrigatório e classificada como elevada por usar operações administrativas;
- `announcements-list`: privada e JWT obrigatório;
- `announcements-update`: privada e JWT obrigatório.

Nenhuma dessas alterações publica funções ou modifica o banco. Elas apenas tornam o contrato de segurança verificável no repositório e no CI.

## Relatório

O comando abaixo gera `security-audit-report.json`:

```bash
npm run check:security
```

O relatório é publicado como artefato temporário do workflow. Ele contém somente nomes de funções, estado de gerenciamento, configuração de JWT e classificação da política. Não contém chaves, tokens, senhas ou dados de usuários.

## Próxima migração segura

As funções legadas devem ser adicionadas gradualmente a `supabase/config.toml` depois de revisão individual. O CI passa a tratá-las como gerenciadas assim que a configuração explícita é incluída. Nenhuma função é publicada ou alterada automaticamente por este processo.

## Limitação conhecida

A auditoria estática confirma a coerência do repositório. Ela não substitui a auditoria de RLS, permissões, logs e configuração implantada no projeto Supabase de produção. Essa parte permanece bloqueada até existir acesso administrativo comprovado ao project ref usado pelo domínio publicado.
