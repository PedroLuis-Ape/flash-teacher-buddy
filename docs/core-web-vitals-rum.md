# Core Web Vitals — diagnóstico local

Atualizado em 2026-07-21.

## Regra ativa

O APE mede LCP, INP e CLS localmente em navegadores compatíveis. O diagnóstico serve para inspecionar a sessão atual e não é um sistema de análise de comportamento.

Os limites usados são:

| Métrica | Bom | A melhorar | Ruim |
|---|---:|---:|---:|
| LCP | até 2.500 ms | até 4.000 ms | acima de 4.000 ms |
| INP | até 200 ms | até 500 ms | acima de 500 ms |
| CLS | até 0,10 | até 0,25 | acima de 0,25 |

## Dados locais

O snapshot da sessão contém somente:

- nome e valor da métrica;
- classificação calculada localmente;
- grupo de rota normalizado, como `/portal/list/:id`;
- classe ampla de dispositivo;
- tipo de navegação;
- horário local da observação.

O coletor não inclui conta, nome, email, URL completa, query string, termos pesquisados, respostas, conteúdo de cards ou identificadores de pastas, listas, turmas e alunos. Rotas desconhecidas viram `/other`, e segmentos dinâmicos são substituídos antes do armazenamento local.

## Persistência e rede

- O snapshot fica apenas em `sessionStorage` durante a sessão atual.
- O coletor não chama endpoint de rede.
- A página de status do sistema pode exibir o snapshot local.
- Falhas no Performance Observer ou no armazenamento da sessão nunca bloqueiam a inicialização do aplicativo.

## Banco

O repositório mantém o schema agregado de Web Vitals para eventual uso futuro. Ele permanece inativo enquanto não existir um endpoint oficial compatível com a arquitetura Lovable/Supabase e validado separadamente em produção.

Uma ativação futura deverá preservar o isolamento da credencial de serviço, limitar e validar o payload, confirmar o projeto `ymahldldyxvwjeruaxpr`, testar CORS e falhas de rede e só então habilitar o envio no navegador.
