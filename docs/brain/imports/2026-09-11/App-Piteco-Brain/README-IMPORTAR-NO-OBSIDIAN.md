---
cssclasses:
  - ape-ai-note
---

# Como usar este vault

Este pacote foi preparado para funcionar diretamente como um vault do Obsidian.

## Passos
1. Descompacte `App-Piteco-Brain.zip`.
2. Abra o Obsidian.
3. Escolha **Open folder as vault / Abrir pasta como cofre**.
4. Selecione a pasta `App-Piteco-Brain`.
5. Comece por [[00-HOME]] e depois [[01-CURRENT-STATE]].

## Convenção de evidência
- **[VERIFICADO-REPO]**: confirmado no código/documentação atual do GitHub.
- **[VERIFICADO-ADMIN-DB]**: confirmado por consulta somente leitura ao Supabase administrativo/gerenciado.
- **[HISTÓRICO]**: reconstruído de auditorias, commits, planos ou conversas anteriores; pode ter sido superado.
- **[DECISÃO]**: intenção/contrato de produto já discutido, não necessariamente implementado.
- **[REVALIDAR]**: importante, mas precisa ser confirmado no runtime/produção atual.
- **[DESCONHECIDO]**: não há evidência suficiente.

## Fonte de verdade
1. Código/GitHub atual = fonte canônica da implementação.
2. Banco correto do ambiente = fonte canônica do schema/runtime daquele ambiente.
3. Testes = prova técnica parcial; não substituem QA real no navegador.
4. Obsidian = memória operacional, decisões, riscos e handoff.
5. Conversa do agente = memória temporária.

## Regra para qualquer agente
Antes de trabalhar:
- leia [[01-CURRENT-STATE]];
- leia a nota da área;
- confira [[16-DECISIONS]];
- confira [[15-KNOWN-BUGS-AND-RISKS]];
- verifique Git/commits recentes.

Depois de trabalhar:
- atualize a nota da área;
- registre decisão nova;
- atualize bugs/testes;
- atualize [[01-CURRENT-STATE]] apenas com o resumo atual.
