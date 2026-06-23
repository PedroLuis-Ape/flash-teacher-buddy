# Fase 0 — procedimento de rollback por camada

Data: 23 de junho de 2026

## 1. Ponto de retorno verificado

| Item | Valor |
|---|---|
| Branch oficial observada | `main` |
| SHA-base | `7487fe8130a058502a8523cf37b75e567f47b63e` |
| Branch de rollback | `rollback-pre-phase1-2026-06-23` |
| Comparação com a `main` no momento da criação | idêntica, 0 commits de diferença |

A branch de rollback não deve receber commits. Ela existe para preservar o ponto anterior aos próximos ciclos de implementação.

## 2. Rollback de frontend

### Quando usar

- tela essencial não carrega;
- login entra em loop;
- estudo perde ou pula cards;
- importador grava em destino incorreto;
- build publicado aponta para ambiente errado;
- erro P0 sem hotfix seguro e pequeno.

### Procedimento

1. congelar novos merges;
2. identificar o primeiro commit defeituoso;
3. comparar o deploy com `rollback-pre-phase1-2026-06-23`;
4. restaurar a branch de publicação para um commit comprovadamente verde;
5. executar contrato de ambiente, segurança, typecheck, testes, lint e build;
6. publicar o rollback;
7. validar login, biblioteca, estudo, turmas e importação;
8. registrar incidente, causa e commit restaurado.

### Regra

Não usar `force push` na `main` como primeira opção. Preferir revert explícito ou mecanismo de rollback da plataforma para preservar histórico.

## 3. Rollback de feature flag ou rollout

Quando a função possuir flag ou parâmetro explícito:

1. ativar o fallback documentado;
2. confirmar que o backend permanece compatível;
3. não apagar dados criados pela versão nova;
4. medir se a falha cessa;
5. manter a flag desligada até correção e nova homologação.

Exemplos atuais:

- Super Importador: `?superImport=legacy` ou comando persistente do botão anterior;
- novo pipeline de status: manter `off`;
- motor inteligente: manter desligado;
- modo offline: manter desligado.

## 4. Rollback de migration

Nenhuma migration deve ser aplicada sem:

- backend oficial confirmado;
- snapshot anterior;
- SQL de verificação;
- estratégia de reversão;
- teste em banco descartável ou branch de desenvolvimento.

### Tipos

#### Migration aditiva

Exemplo: nova tabela ou coluna opcional.

Rollback preferido:

- desligar uso pelo aplicativo;
- preservar dados;
- remover estrutura somente em janela posterior e aprovada.

#### Migration destrutiva ou de transformação

Exemplo: remover coluna, reescrever ownership, consolidar glossário.

Rollback obrigatório:

- snapshot ou tabela de quarentena;
- script inverso testado;
- relatório de linhas afetadas;
- verificação de integridade antes e depois.

### Proibição

Não executar “rollback” apagando migrations do histórico. O banco deve receber uma migration corretiva ou ser restaurado por procedimento controlado.

## 5. Rollback de RLS e grants

1. salvar definição anterior de policies, funções e grants;
2. aplicar alteração em transação quando possível;
3. testar anônimo, usuário A, usuário B, professor e aluno;
4. se usuários legítimos forem bloqueados ou houver exposição, restaurar as definições anteriores;
5. repetir os testes negativos antes de liberar tráfego.

Nunca abrir policy temporariamente para `true` como correção de emergência.

## 6. Rollback de Edge Function

1. registrar versão publicada e hash do código;
2. manter a versão anterior recuperável;
3. publicar a versão anterior com a mesma configuração de JWT e segredos;
4. validar autenticação, payload forjado, idempotência e logs;
5. confirmar que clientes antigos e novos continuam compatíveis.

Não alterar `verify_jwt` apenas para fazer a função voltar a responder.

## 7. Rollback de dados

Usar, nesta ordem:

1. transação ainda aberta;
2. função de desfazer por lote;
3. restauração de quarentena;
4. snapshot do banco;
5. correção manual somente como último recurso documentado.

Importações devem usar identificador de lote. O smoke test atual do Super Importador já comprova importação e desfazer em ambiente de CI.

## 8. Rollback de Storage

1. não sobrescrever arquivos sem preservar versão ou hash;
2. manter manifesto entre registro e objeto;
3. restaurar arquivo e metadado como uma unidade;
4. invalidar cache somente depois da restauração;
5. confirmar que URLs privadas continuam privadas.

## 9. Validação mínima depois de qualquer rollback

- contrato de ambiente;
- autenticação e restauração de sessão;
- isolamento entre usuários;
- abertura de pasta/lista;
- pelo menos uma sessão de estudo;
- turmas e memberships;
- importação simulada ou real com desfazer;
- ausência de erros P0 nos logs;
- comparação de contagens críticas.

## 10. Estado atual

| Camada | Situação |
|---|---|
| Frontend | ponto de retorno criado e comparado com a `main` |
| Rollout por flag | procedimento definido |
| Super Importador | fallback e undo automatizado testados no PR `#154` |
| Backend `ymah...` | rollback prático bloqueado por falta de acesso administrativo |
| Destino `xrnf...` | somente leitura; não tratado como produção |
| Dados e Storage | procedimento definido; execução pendente |

O rollback de frontend está comprovado estruturalmente. O rollback de banco permanece pendente até acesso ao backend oficial e teste em ambiente seguro.
