# Roadmap do Portal Público e Tema Galáctico

Este documento organiza a implantação em etapas pequenas, cada uma entregue em um PR separado sempre que possível.

## Etapa 1 — Navegação e nova estrutura do portal

Status: concluída e mesclada.

- Cabeçalho público reutilizável.
- Botão de voltar com fallback seguro.
- Remoção das pastas aleatórias da página principal.
- Busca visual por professor.
- Cards de professores recomendados.

## Etapa 2 — Pesquisa real e perfil público do professor

Status: implementada no PR 15, aguardando merge.

- Pesquisa real por nome, slug, bio e especialidades.
- Perfil público navegável por slug.
- Avatar, nome, bio, especialidades e contadores públicos.
- Pastas e materiais agrupados por professor.
- RPCs públicas seguras sem exposição de e-mail, APE ID ou UUID interno.

## Etapa 3 — Configuração pública pelo professor

Status: pendente.

- Editar bio pública.
- Editar especialidades.
- Ativar ou desativar o perfil pesquisável.
- Visualizar o próprio perfil público antes de publicar.
- Controlar quais materiais aparecem publicamente.

## Etapa 4 — Histórico local do visitante

Status: pendente.

- Identificador anônimo local no navegador.
- Professores visitados recentemente.
- Últimas pastas, listas e atividades abertas.
- Retomada do último item e posição.
- Opção para limpar o histórico.
- Persistência somente no mesmo navegador/dispositivo.

## Etapa 5 — Sincronização anônima opcional no servidor

Status: pendente e opcional.

- Sessão anônima com identificador aleatório.
- Sincronização do histórico entre visitas do mesmo navegador.
- Expiração automática de dados.
- Migração do histórico para uma conta criada posteriormente.
- Nenhum uso de IP como identificador principal.

## Etapa 6 — Ajuste das animações do modo galáctico

Status: pendente. Deve ser a última etapa deste roadmap.

### Objetivo

Refinar as animações do tema galáctico somente em desktop e tablets com boa capacidade, preservando o modo simplificado já adotado em dispositivos móveis e de baixa performance.

### Separação por capacidade

Usar a mesma lógica de detecção de capacidade já aplicada ao Plano 2:

- mobile, dispositivo lento ou `prefers-reduced-motion`: fundo estático, sem cometa e com estrelas fixas ou brilho mínimo;
- desktop ou tablet com boa capacidade: animações completas com os ajustes descritos abaixo.

### Estrelas no desktop

- Usar easing suave, preferencialmente `ease-in-out`.
- Variar a duração entre aproximadamente 2 e 4 segundos.
- Aplicar atrasos e fases diferentes para evitar sincronização artificial.
- Animar apenas `opacity` e, quando necessário, `transform`.
- Evitar propriedades que causem layout ou pintura pesada contínua.
- Manter entrada, ápice e saída do brilho suaves.

### Cometa no desktop

- Reduzir a velocidade aproximadamente pela metade.
- Aumentar a duração da travessia para tornar o cometa perceptível.
- Manter a trajetória atual.
- Aplicar fade-in e fade-out graduais.
- Garantir que a cauda acompanhe sem tremor.
- Não executar o cometa em mobile ou dispositivos classificados como limitados.

### Mobile

Nenhum efeito novo deve ser adicionado.

- Fundo simplificado.
- Sem cometa.
- Sem animações contínuas pesadas.
- Estrelas estáticas ou com brilho muito sutil.
- Performance tem prioridade sobre riqueza visual.

### Verificação final

- Confirmar estrelas mais orgânicas no desktop.
- Confirmar cometa mais lento e visível.
- Confirmar ausência de tremores no rastro.
- Confirmar que mobile continua sem cometa e sem travamentos.
- Testar tablets de baixa performance no modo simplificado.
- Verificar `prefers-reduced-motion`.

## Progresso geral

- Etapa 1: concluída.
- Etapa 2: implementada, aguardando merge.
- Etapas 3, 4, 5 e 6: pendentes.
