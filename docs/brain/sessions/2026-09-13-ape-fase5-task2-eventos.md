---
type: session
date: 2026-09-13
agent: codex-orchestrator
area: seo-public-web
related:
  - "[[01-CURRENT-STATE]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
---

# Session — Fase 5, Task 2: eventos first-party no banco

## Objective

Medir ativação sem PII e sem terceiros: tabela insert-only para o cliente,
acesso só por RPC com allowlist fechada, limite de payload e throttle.

## O que foi implementado

- `public.product_event` (`id`, `name`, `payload`, `locale`, `surface`,
  `occurred_on`, `created_at`) com check constraint dos 11 nomes permitidos,
  payload obrigatoriamente objeto e teto de 512 bytes.
- RLS habilitada, **zero policies**, `revoke all` de `public, anon, authenticated`
  na tabela: o cliente não lê nem escreve direto.
- `record_product_event_v1(_name, _payload, _locale, _surface)`:
  allowlist de nomes; allowlist de chaves **por evento**; filtra com
  `jsonb_each ... where key = any(v_allowed_keys)`; descarte silencioso de nome
  desconhecido (`unknown_event`); `payload_too_large`; throttle de 300 eventos
  por nome por minuto (`throttled`).

## Verificação em produção (projeto `ymahldldyxvwjeruaxpr`)

```
rls_enabled   = true      policies = 0
anon_select   = false     anon_insert = false
security_definer = true   config = {search_path=public}   anon_execute = true

evento válido  -> {"accepted": true, "name": "public_search_used"}
payload gravado = {"has_filters": true, "result_count": 3}
  (a chave fora da allowlist foi descartada antes do insert)
evento inválido -> {"accepted": false, "reason": "unknown_event"}   (nada gravado)
linhas após a verificação -> 0 (a linha de teste foi removida)
```

## Risco conhecido

[DECISION] O throttle é global por nome: um cliente abusivo pode consumir a cota
daquele nome na janela. Alternativa sem PII não existe hoje; aceito e documentado
em vez de identificar dispositivo ou usuário.

## Next step

Task 3 da Fase 5: helper de cliente `trackProductEvent` e instrumentação das
superfícies públicas.

## Classification

REVIEW_RECOMMENDED — implementado pelo controller; revisão independente pendente.
## Fix round 1 (revisão independente)

- [IMPORTANT corrigido] A allowlist de chaves filtrava só o primeiro nível: um
  objeto aninhado dentro de uma chave permitida era gravado inteiro e virava
  canal de PII (reproduzido em produção pelo revisor). Agora só sobrevivem
  valores escalares — `jsonb_typeof(entry.value) in ('string','number','boolean')`.
  Verificado em produção: o objeto aninhado foi descartado.
- [IMPORTANT corrigido] `_locale` e `_surface` eram texto livre (até 16/64 bytes),
  ou seja, uma caixa de texto anônima. Agora são validados como token
  (`^[A-Za-z-]{2,16}$` e `^[a-z0-9-]{1,64}$`); superfície fora do padrão devolve
  `invalid_surface` — verificado em produção.
- [IMPORTANT corrigido] O throttle era um check-then-insert não atômico: rajadas
  concorrentes estouravam o limite. Agora a contagem é serializada por
  `pg_advisory_xact_lock(hashtext('product_event:' || _name))`.
- [IMPORTANT corrigido] Faltava o bloco de backup de produção exigido pelo
  programa. Registrado no arquivo: o objeto não existia antes da migration
  (`to_regclass` = null, 0 funções).
- [MINOR corrigido] `revoke all on sequence public.product_event_id_seq` para
  `anon`/`authenticated`; verificado: `has_sequence_privilege` = false.
- [MINOR corrigido] O teste que checava PII era vazio (a palavra não aparecia no
  SQL). Passou a afirmar as defesas reais.
- [PENDING] Retenção da tabela insert-only ainda não tem política de expurgo;
  decisão registrada como pendência antes de haver tráfego real.
