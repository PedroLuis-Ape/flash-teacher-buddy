# Auditoria estática das Edge Functions

## Objetivo

Esta verificação é executada localmente e no GitHub Actions. Ela é somente leitura, não acessa o banco, não publica funções e não gera custo adicional.

## O que o CI valida

- cada diretório em `supabase/functions` possui `index.ts`;
- cada função está declarada em `supabase/config.toml`;
- cada declaração possui `verify_jwt` explícito;
- apenas funções registradas em `publicFunctions` podem usar `verify_jwt = false`;
- funções privadas devem usar `verify_jwt = true`;
- uma função não pode ser simultaneamente pública e classificada como elevada;
- as listas de política não podem apontar para funções inexistentes;
- configurações sem diretório e diretórios sem configuração bloqueiam o CI.

## Política atual

A função `ping` é o único endpoint público permitido. Ela funciona como health check sem leitura ou escrita no banco.

As funções classificadas como elevadas são:

- `kingdoms-import-csv`;
- `audit-ab-consistency`;
- `repair-ab`.

Essa classificação não concede permissão. Ela registra que essas funções exigem revisão especial, JWT obrigatório e controles explícitos de autenticação e escopo no código.

## Relatório

O comando abaixo gera `security-audit-report.json`:

```bash
npm run check:security
```

O relatório é publicado como artefato temporário do workflow. Ele contém somente nomes de funções, configuração de JWT e classificação da política. Não contém chaves, tokens, senhas ou dados de usuários.

## Limitação conhecida

A auditoria estática confirma a coerência do repositório. Ela não substitui a auditoria de RLS, permissões, logs e configuração implantada no projeto Supabase de produção. Essa parte permanece bloqueada até existir acesso administrativo comprovado ao project ref usado pelo domínio publicado.
