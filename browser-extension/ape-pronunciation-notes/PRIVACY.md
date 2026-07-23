# Privacidade — APE Pronúncia e Notas

A extensão processa o texto selecionado localmente no navegador para reproduzir a pronúncia e salvar notas.

## Dados armazenados

- texto salvo pelo próprio usuário;
- título e endereço da página de origem;
- data de criação da nota;
- preferência de idioma e voz.

## Onde os dados ficam

Na primeira versão, todos os dados ficam em `chrome.storage.local`. Eles não são enviados ao Supabase, ao APE Education nem a terceiros pela extensão.

## Permissões

A extensão precisa funcionar em páginas HTTP e HTTPS para exibir a barra de seleção. Ela não coleta automaticamente o conteúdo completo das páginas; atua somente sobre o texto que o usuário seleciona e sobre as ações que ele inicia.
