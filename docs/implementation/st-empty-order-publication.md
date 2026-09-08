# Preparação de publicação do PR 392

O gate de publicação identificou vulnerabilidades altas em três dependências transitivas. Atualizações pontuais, sem mudança de major nem relaxamento da política de segurança:

- brace-expansion: 5.0.8 → 5.0.9 (override existente).
- fast-uri: 3.1.4 → 3.1.7 (lockfile).
- nanoid: 3.3.16 → 3.3.18 (lockfile).

A auditoria após instalação limpa registra zero vulnerabilidades altas/críticas de produção e zero críticas na árvore completa. Permanecem quatro moderadas e uma baixa em produção, e três altas restritas ao desenvolvimento, permitidas pela política atual. Não se afirma ausência total de vulnerabilidades.

Nenhuma migration, configuração de backend ou publicação remota foi executada. A publicação continua pela Lovable após sincronizar main. O teste de retomada na conta real continua necessário após publicar; testes automatizados do motor usam transporte simulado.

Rollback: reverter o commit funcional do PR caso necessário, preservando estas atualizações de segurança.
