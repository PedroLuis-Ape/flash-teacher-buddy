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
Status: implementada nesta branch, aguardando validação e merge.

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
Status: pendente e reservado para o final.

- Desktop/tablet capaz: estrelas suaves e dessincronizadas, cometa mais lento e fade gradual.
- Mobile/dispositivo limitado: fundo simplificado, sem cometa e sem novas animações pesadas.

## Progresso

- Etapas concluídas: 1, 2, 3 e 4.
- Etapa atual: 5.
- Etapas restantes depois do merge desta branch: apenas a Etapa 6.
