# Roadmap do Portal Público e Tema Galáctico

## Etapa 1 — Navegação e nova estrutura do portal
Status: concluída.

## Etapa 2 — Pesquisa real e perfil público do professor
Status: concluída.

## Etapa 3 — Configuração pública pelo professor
Status: concluída.

- Bio pública e especialidades.
- Controle de perfil público e presença na pesquisa.
- Prévia local, link público e publicação individual de pastas.

## Etapa 4 — Histórico local do visitante
Status: concluída.

- Histórico local limitado a 12 itens.
- Expiração após 90 dias.
- Professores, pastas, listas, estudos e atividades recentes.
- Rota, posição de rolagem e progresso visível.
- Seção “Continue de onde parou”.
- Remoção individual ou limpeza completa.
- Nenhum uso de IP.

## Etapa 5 — Sincronização anônima opcional no servidor
Status: concluída.

- Desligada por padrão.
- Ativação explícita pelo visitante.
- Cliente Supabase isolado do login principal.
- Sessão anônima protegida por RLS owner-only.
- Histórico anônimo com expiração por inatividade de até 90 dias.
- Nenhum IP, fingerprint, nome ou e-mail armazenado na tabela de histórico.
- Migração automática para `user_portal_history` quando uma conta entra.
- Exclusão da cópia anônima após a migração.
- Controle para sincronizar, desativar e apagar a cópia do servidor.

## Etapa 6 — Ajuste das animações do modo galáctico
Status: implementada nesta branch, aguardando validação e merge.

- Nível completo para desktops capazes.
- Nível equilibrado para tablets, telas intermediárias e hardware mediano.
- Nível estático para celular, movimento reduzido, economia de dados ou hardware limitado.
- Estrelas com tempos longos, variados e dessincronizados.
- Cometa mais lento, raro e com fade gradual.
- Pausa das animações quando a aba fica oculta.
- Fundo mobile reduzido, sem cometa, máscaras, pseudocamadas ou blur decorativo.
- Testes automatizados para a seleção dos níveis e orçamentos visuais.

## Progresso

- Etapas concluídas: 1, 2, 3, 4 e 5.
- Etapa atual: 6.
- Etapas restantes depois do merge desta branch: nenhuma.
