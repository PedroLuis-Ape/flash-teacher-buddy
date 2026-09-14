---
category: decision
area: piteco
status: active
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

## Time CLARA como subagentes padrão — vigente em 2026-09-14

- [DECISAO VIGENTE] Os subagentes do App Piteco são o time CLARA — `clara_brain`, `clara_explorer`, `clara_worker` e `clara_reviewer` — sempre criados com `agent_type` explícito. Fluxo: Brain (contexto) → Explorer (mapa) → Worker (implementação) → Reviewer (revisão) → Brain (conhecimento durável).
- [DECISAO VIGENTE] Todo subagente usa `model = gpt-5.6-luna` e `reasoning_effort = high`; proibido `xhigh`, `ultra` e escalonamento automático. A MAIN mantém o modelo que o usuário configurou e decide qualquer troca quando o subagente devolve BLOCKED.
- [DECISAO SUBSTITUIDA] A decisão de 2026-09-12 de fixar as Claras em DeepSeek `deepseek/deepseek-v4-flash` com esforço `ultra` está substituída pela linha acima.
- [DECISAO VIGENTE] Nenhuma Clara substitui os gates técnicos nem os “Acordos de trabalho” (não trabalhar em `main`, sem merge/deploy/migration remota automática, escopo de escrita disjunto, sem Supabase/auth/dados de produção em subagente).

## Protocolo CCL — Clara Compact Language

- [DECISAO VIGENTE] O projeto adota o CCL como protocolo interno de comunicação compacta entre agentes. Registry do projeto em `docs/brain/registry/ccl-registry.json` e nota [[25-CCL-REGISTRY]]; spec global em `C:\Users\pedro\.codex\ccl\`.
- [DECISAO VIGENTE] Handoffs internos saem em **L1**; **L2** só com a mesma versão/hash (`CL1` + `rv` conferido); **L0** para crítica, nuance, segurança, produção e decisão humana. ID desconhecido → `EXP`; `rv` divergente → NACK e fallback L1/L0. IDs do registry são imutáveis e nunca reutilizados.
- [DECISAO VIGENTE] Representação de contexto é adaptativa — NATURAL / NATURAL_SHORT / CCL_L1 / CCL_L2 conforme COLD / WARM / CONFLICT — com retrieval seletivo e proibição de carregar o vault inteiro. **CCL v3 está congelado.**
- [DECISAO VIGENTE] Conteúdo de flashcards (criar, enriquecer, organizar, importar) segue `FLASHCARD_AGENT.md` como fonte operacional; schema ativo, importadores oficiais e banco continuam sendo a autoridade final.

Related: [[05-AGENTS]] · [[10-CONTEXT-FEEDING-RULE]] · [[25-CCL-REGISTRY]] · [[27-CONTEXT-PACKET-E-TELEMETRIA]]
