# Fase 0 — plano seguro de limpeza de dados

Data: 23 de junho de 2026

Status: **PLANEJADO — NENHUMA EXCLUSÃO AUTORIZADA**

Este plano define como encontrar e corrigir inconsistências sem apagar dados válidos. Ele só pode ser executado depois de confirmar o backend oficial e obter snapshot/backup verificável.

## 1. Princípios obrigatórios

1. Toda limpeza começa com consulta somente leitura.
2. Nenhuma exclusão ocorre sem backup ou tabela de quarentena.
3. Correções devem ser idempotentes e registradas por lote.
4. O proprietário real vem de relações do backend, nunca de e-mail fixo ou armazenamento local.
5. Dados de Professor A, Professor B, Aluno A e Aluno B devem permanecer isolados durante toda a operação.
6. O lote precisa oferecer relatório antes/depois e procedimento de rollback.

## 2. Ordem de execução

### Etapa A — confirmar ambiente

- confirmar project ref usado por Auth, REST, RPC, Storage e Functions;
- confirmar acesso administrativo ao backend atual;
- registrar versão de migrations e data do snapshot;
- bloquear deploys concorrentes durante a janela de análise.

### Etapa B — inventário somente leitura

Gerar contagens e amostras para:

- usuários Auth sem perfil público;
- perfis sem usuário Auth correspondente;
- perfis com papel ausente, inválido ou contraditório;
- turmas sem professor proprietário;
- memberships sem turma ou sem usuário;
- pastas, listas e cards órfãos;
- cards em camadas sem pai ou com índices duplicados;
- favoritos, lista vermelha e especiais apontando para cards inexistentes;
- glossário duplicado ou sem conta proprietária;
- import batches sem manifesto, relatório ou status terminal;
- transações, compras e saldos incompatíveis;
- arquivos de Storage sem registro e registros sem arquivo.

### Etapa C — classificar cada achado

Cada registro deve receber uma classificação:

- `valid` — manter;
- `repairable` — corrigir automaticamente;
- `needs_owner_decision` — exige decisão do proprietário;
- `quarantine` — mover para quarentena antes de excluir;
- `false_positive` — regra de auditoria precisa ser ajustada.

### Etapa D — simular

Antes da escrita, produzir relatório com:

- quantidade por tabela e classificação;
- IDs afetados em arquivo protegido;
- regra de transformação;
- impacto esperado em relações e RLS;
- SQL de rollback ou restauração.

### Etapa E — aplicar por lotes pequenos

Ordem recomendada:

1. perfis e papéis;
2. ownership de turmas e memberships;
3. pastas, listas, cards e camadas;
4. glossário e dicas;
5. estados de usuário — favoritos, lista vermelha e especiais;
6. importações e manifests;
7. PiTECoin, compras e transações;
8. Storage.

Após cada lote:

- rodar queries de integridade;
- executar testes de isolamento;
- comparar contagens;
- registrar lote, operador, horário e resultado;
- interromper ao primeiro desvio não explicado.

## 3. Queries de integridade a preparar

As queries abaixo são requisitos, não comandos autorizados neste momento:

| Área | Prova necessária |
|---|---|
| Auth/perfis | nenhum usuário esperado sem perfil e nenhum perfil sem Auth |
| Papéis | exatamente um papel efetivo por conta, conforme contrato |
| Turmas | toda turma possui professor proprietário válido |
| Memberships | toda associação aponta para turma e usuário existentes |
| Biblioteca | pasta → lista → card forma cadeia válida e com proprietário consistente |
| Camadas | pai existe, índices são únicos e ordem é determinística |
| Glossário | chave normalizada é única por conta e idioma/contexto definido |
| Estado de cards | nenhum estado aponta para card inexistente ou usuário diferente |
| Importação | batch e manifesto possuem status terminal coerente |
| Economia | saldo deriva de transações válidas; nenhuma compra usa preço do cliente |
| Storage | arquivo e metadado possuem relação rastreável |

## 4. Estratégia de quarentena

Quando exclusão for inevitável:

1. copiar a linha completa para tabela de quarentena com:
   - tabela de origem;
   - chave primária;
   - payload JSON;
   - motivo;
   - lote;
   - timestamp;
2. remover somente após validar a cópia;
3. manter quarentena durante período definido de homologação;
4. fornecer função de restauração por lote.

A estrutura de quarentena não será criada até o backend oficial ser confirmado.

## 5. Critérios de bloqueio

A limpeza deve ser interrompida quando:

- project ref não corresponder ao ambiente aprovado;
- snapshot estiver ausente ou incompleto;
- houver migrations pendentes não compreendidas;
- uma regra afetar mais registros que o previsto;
- ownership não puder ser inferido com segurança;
- teste entre contas demonstrar vazamento;
- saldo ou transação não puder ser reconstruído de forma determinística.

## 6. Rollback mínimo

Cada lote precisa oferecer pelo menos uma destas opções:

- transação única reversível;
- tabela de quarentena + restauração;
- snapshot de banco + procedimento testado;
- migration inversa para DDL.

Não é aceitável usar apenas “corrigir manualmente depois”.

## 7. Evidências para considerar a limpeza concluída

- relatório antes/depois anexado;
- zero órfãos não justificados;
- zero papéis inválidos;
- isolamento A/B aprovado;
- smoke tests de cadastro, biblioteca, turmas, estudo e importação verdes;
- reconciliação de economia sem divergência;
- Storage reconciliado;
- rollback testado em ambiente de teste;
- aprovação explícita antes de produção.

## 8. Estado atual

O projeto `ymahldldyxvwjeruaxpr` está documentado como backend atual, mas não está disponível na conexão administrativa desta auditoria. O projeto `xrnfhhoxmmstagmelvyi` é destino de migração e foi apenas inspecionado em modo leitura.

Consequentemente:

- inventário conceitual: concluído;
- regras e ordem de limpeza: concluídas;
- queries específicas por schema oficial: pendentes;
- simulação: pendente;
- execução: bloqueada;
- rollback prático: pendente.
