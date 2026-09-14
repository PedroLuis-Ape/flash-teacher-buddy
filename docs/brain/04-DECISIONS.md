---
cssclasses:
  - ape-ai-note
---

# Decisões

## Preservar a identidade

Evolução do App Piteco atual; não criar uma nova aplicação nem substituir a linguagem visual.

## Mobile-first

Uma tela só é aprovada depois de funcionar nos seis tamanhos móveis exigidos, além de tablet e desktop.

## Efeitos com função

Microinterações devem comunicar toque, acerto, erro, progresso ou conclusão. Sem blur pesado, partículas constantes, flashes ou animações que causem layout shift.

## Dados fora do escopo

Não tocar em Supabase, RLS, auth, sessões, progresso, importadores, algoritmos ou persistência durante o polimento visual.

## Evidência antes da afirmação

Testes estáticos não substituem screenshot, interação real e inspeção do console. Lovable preview deve ser usado se estiver disponível; se não, documentar a limitação.

## Integração

Commits lógicos e reversíveis. Não fazer merge, push ou publicação sem o gate final e revisão do diff.

## Biblioteca — preferências locais e emoji por pasta — 2026-09-14

- [DECISAO VIGENTE] O produto oferece dois modos de visualização sem remover o modo existente: listas começam em lista; pastas começam em grade; a escolha é persistida por dispositivo.
- [DECISAO VIGENTE] A pasta mantém `📁` como representação padrão, permite emoji específico e oferece reversão explícita para o padrão. A ação nunca altera conteúdo, progresso ou a estrutura da pasta.
- [DECISAO VIGENTE] A personalização usa sincronização na nuvem quando `folders.emoji` estiver disponível e fallback local enquanto a migration não for aplicada. A UI deve continuar honesta sobre esse estado.

Related: [[areas/visual-polish]] · [[01-CURRENT-STATE]] · [[08-RISKS]]

## Importação MCP — autoridade de destino e pré-checagem — 2026-09-14

- [DECISAO VIGENTE] Destino de importação (pasta e lista) é resolvido pelo catálogo que espelha o contrato do RPC oficial — dono, `system_kind = 'user'`, sem turma e sem lixeira. O caminho de leitura mantém autoridade por pasta; as duas autoridades não se misturam mais dentro do mesmo fluxo.
- [DECISAO VIGENTE] Plano default nunca escolhe em silêncio: nome duplicado responde `ambiguous` com candidatos e exige `destination`/`destination_plan` explícito.
- [DECISAO VIGENTE] Preview e execute replicam a pré-checagem do gateway: `card_conflict = 'replace'` com pacote em camadas falha com `E_LAYERED_REPLACE_UNSUPPORTED` antes de tocar o backend.
- [DECISAO VIGENTE] A RPC de capability é aditiva: `get_import_capabilities_v2` acrescenta o diagnóstico real do glossário oficial e a v1 permanece como fallback honesto, com glossário `unknown` em vez de suposto.
- [DECISAO VIGENTE] `build` antes de `mcp:bundle`: o plugin Vite reescreve o wrapper Deno com caminho absoluto do Windows e só a regeneração posterior deixa o artefato válido.

Related: [[areas/mcp-reference-ids-and-importers]] · [[areas/mcp-agent-api]] · [[01-CURRENT-STATE]] · [[08-RISKS]]
