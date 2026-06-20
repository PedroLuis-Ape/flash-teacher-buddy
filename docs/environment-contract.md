# Contrato de ambiente do App Piteco

## Estado confirmado

O frontend versionado e `supabase/config.toml` apontam para o mesmo project ref de produção documentado: `ymahldldyxvwjeruaxpr`.

A conexão Supabase disponível nesta automação lista apenas:

- `rnriudxxafcnftjiysue` — projeto legado inativo;
- `xrnfhhoxmmstagmelvyi` — projeto novo ativo, mas sem evidência de que atende o domínio publicado.

Nenhuma migration, Edge Function ou alteração de dados deve ser aplicada nesses dois projetos apenas por semelhança de nome. Mudanças de backend permanecem bloqueadas até existir acesso explícito ao projeto `ymahldldyxvwjeruaxpr` ou uma evidência verificável de migração do ambiente publicado.

## Invariantes verificadas pelo CI

O comando `npm run check:environment` bloqueia publicação quando:

- `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL` ou a chave publicável estiver ausente;
- a URL não usar HTTPS;
- o host da URL não corresponder ao project ref;
- `supabase/config.toml` apontar para outro projeto;
- a chave JWT do frontend não tiver role `anon`;
- a chave publicável pertencer a outro project ref;
- a `.env` versionada contiver variáveis de servidor, senhas, service role, token administrativo, segredo JWT ou chave privada;
- a `.env` versionada contiver variáveis que não sejam públicas e prefixadas com `VITE_`.

O validador nunca imprime a chave publicável.

## Política temporária da `.env`

A `.env` ainda permanece no repositório por compatibilidade com o deploy atual. Apesar de os valores `VITE_` serem enviados ao navegador por definição, isso não autoriza colocar segredos nesse arquivo.

Enquanto as variáveis da plataforma de publicação não forem confirmadas, a regra é:

1. somente valores públicos `VITE_` podem existir na `.env` versionada;
2. sobrescritas locais devem usar `.env.local` ou `.env.*.local`;
3. nenhuma chave service role, senha do banco, token da Management API ou segredo de assinatura pode ser adicionada;
4. a retirada definitiva da `.env` só deve ocorrer depois de um preview comprovar que a plataforma injeta todas as variáveis necessárias.

## Critério para desbloquear o backend

A fase de banco será desbloqueada quando pelo menos uma destas condições for atendida:

- o projeto `ymahldldyxvwjeruaxpr` aparecer na conexão administrativa disponível;
- houver acesso administrativo explícito a esse projeto;
- o ambiente publicado passar a apontar para outro project ref e essa alteração estiver comprovada no frontend, na plataforma de deploy e no Supabase.

Até lá, o trabalho seguro limita-se a validações de frontend, CI, documentação, testes e mudanças que não escrevam em banco desconhecido.
