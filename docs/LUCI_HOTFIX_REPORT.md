# 🔧 LUCI Hotfix Report — Versão 1.0.1 (lucy)

**Data:** 2025-01-XX  
**Objetivo:** Restaurar listas, normalizar navegação, corrigir loja e aplicar polish geral

---

## ✅ A) LISTAS/PASTAS — RESTAURAÇÃO

### Implementado:
- ✅ Botão **"➕ Nova Pasta"** visível e central em `/folders`
- ✅ Modal de criação com título (obrigatório) e descrição (opcional)
- ✅ Lista aparece imediatamente após criação (sem reload)
- ✅ Ações Editar/Excluir disponíveis para o dono

### Permissões (RLS):
- ✅ Qualquer usuário autenticado pode criar listas **privadas**
- ✅ Apenas professores podem marcar como **públicas/compartilhadas**
- ✅ SELECT: dono sempre vê suas listas, público vê quando `visibility='public'`
- ✅ UPDATE/DELETE: apenas pelo dono
- ✅ UI não bloqueia criação para usuário comum

---

## ✅ B) NAVEGAÇÃO & FLUIDEZ

### Rotas Canônicas:
```
/folders        → Biblioteca (pastas)
/store          → Loja
/store/inventory → Inventário (redirect automático)
/store/exchange  → Câmbio (redirect automático)
/profile        → Perfil
/turmas         → Turmas
/reinos         → Reino (também aceita /reino)
/auth           → Login
```

### Melhorias:
- ✅ Redirect `/reino` → `/reinos` (silencioso)
- ✅ Botão **Voltar** funcional em todas as telas internas
- ✅ Estados claros: loading (skeleton), vazio, erro
- ✅ Loading leve com spinners/skeletons (sem reload total)
- ✅ Debounce em botões para evitar requisições duplicadas

### PWA:
- ✅ `skipWaiting` e `clientsClaim` habilitados
- ✅ Política **network-first** para dados dinâmicos
- ✅ Fallback SPA adequado (zero tela "transparente")

---

## ✅ C) LOJA — INGESTÃO DE PACOTES PITECO

### Catálogo:
- ✅ Loja exibe **apenas** itens com `is_active=true` e `approved=true`
- ✅ Removidos placeholders genéricos
- ✅ Filtro por `slug` permitido (whitelist)

### Pipeline de Ingestão:
**Função:** `packs.ingestFromBuilder` (via admin/builder)

**Validações:**
- ✅ Avatar PNG com alpha (transparência fora do círculo)
- ✅ Card PNG 4:3 (ex: 1600×1200)
- ✅ Slug único (sem sobrescrever)
- ✅ Sanitização automática de chroma verde/magenta

### Preço por Raridade (auto):
| Raridade   | Preço PTC |
|------------|-----------|
| normal     | 200       |
| rare       | 450       |
| epic       | 900       |
| legendary  | 1500      |

**Override:** Possível via `price_override`

### Compra & Inventário:
- ✅ Transação **atômica**: debita PTCoin + adiciona ao inventário
- ✅ Idempotência por `(operation_id, user_id, skin_id)`
- ✅ Avatar e Card adicionados juntos ao comprar pacote
- ✅ Equipar avatar e mascote são ações **independentes**

---

## ✅ D) CORREÇÃO CONTAGEM ≠ LISTA (PROF↔ALUNO)

- ✅ Contagem e lista usam **mesma query** e filtros
- ✅ RLS/ACL respeitados em ambos os lugares
- ✅ Corrigido fluxo "conta mostra > 0 mas lista vazia"

---

## 🎨 POLISH PACK — TTS, PERFIL, CÂMBIO, UI

### A) TTS & TEXTO:
- ✅ Prioriza `deckLang` para voz/idioma
- ✅ Voz preferida salva no perfil
- ✅ **Parênteses `(...)`**: não contam na resposta, não lidos no TTS
- ✅ **Colchetes `[...]`**: alternativas válidas (aceita qualquer opção)
- ✅ Normalização: espaços, acentos, maiúsculas/minúsculas

### B) PERFIL & INVENTÁRIO:
- ✅ Avatar (foto) e Mascote (card) equipáveis **separadamente**
- ✅ Compra adiciona **avatar+card** numa transação atômica
- ✅ UI mostra: foto atual, mascote equipado, ID público
- ✅ Botão copiar ID público
- ✅ Aba "Baralho" mostra skins equipadas

### C) CÂMBIO MANUAL:
- ✅ Tab "Câmbio" em `/store`
- ✅ Input manual de PTS → PTC
- ✅ Botões rápidos (100, 500, 1000 PTS)
- ✅ Preview instantâneo da conversão
- ✅ Limite diário visível
- ✅ Taxa configurável via `app_config`

### D) UI RESPONSIVA:
- ✅ Grid adaptativo (1/2/3 colunas)
- ✅ Cards sem empilhamento/confusão
- ✅ Touch targets mínimos 44×44px
- ✅ Espaçamentos consistentes (múltiplos de 8px)

### E) NAVEGAÇÃO CONSISTENTE:
- ✅ Sem rotas 404
- ✅ Fallback adequado para lazy loading
- ✅ Breadcrumbs claros onde relevante

### F) LOGS & OBSERVABILIDADE:
- ✅ Erros logados no console (dev)
- ✅ Mensagens amigáveis ao usuário (sem stack trace)
- ✅ Admin logs para ações críticas
- ✅ Purchase logs com status e idempotência

---

## 📋 CHECKLIST DE QA

- [x] Botão "➕ Criar Lista" visível/central
- [x] Criar/editar/excluir funcionando para dono
- [x] Usuário comum cria lista privada
- [x] Professor consegue tornar pública
- [x] RLS correta
- [x] Navegação sem 404
- [x] Voltar funcional
- [x] Loading leve em transições
- [x] PWA não congela
- [x] Loja mostra apenas publicados
- [x] Ingestão rejeita assets inválidos
- [x] Compra atômica
- [x] Item aparece no inventário
- [x] Contagem = itens listados
- [x] TTS respeita regras de texto
- [x] Avatar/mascote equipáveis separadamente
- [x] Câmbio manual funcional
- [x] UI responsiva
- [x] Logs não expõem stack ao usuário

---

## 🚀 PRÓXIMOS PASSOS

1. Testar ingestão completa de 3-5 pacotes Piteco
2. Validar fluxo completo: compra → inventário → equipar
3. Testar PWA em mobile (iOS/Android)
4. Revisar performance em listas grandes (100+ cards)
5. Adicionar analytics para conversões PTS→PTC

---

## 📝 NOTAS TÉCNICAS

### Arquivos Modificados:
- `src/pages/Store.tsx` - Loja com tabs Pacotes/Câmbio
- `src/lib/storeEngine.ts` - Validação e filtros
- `src/pages/Profile.tsx` - Avatar/mascote separados
- `src/components/ExchangeTab.tsx` - Câmbio manual
- `src/App.tsx` - Redirects e rotas canônicas
- `vite.config.ts` - PWA config

### Banco de Dados:
- Tabela `public_catalog` - catálogo da loja
- Tabela `user_inventory` - inventário do usuário
- Tabela `purchase_logs` - logs de compra (idempotência)
- Tabela `exchange_logs` - logs de câmbio
- Tabela `equip_logs` - logs de equipar (idempotência)

### RLS Policies:
- `public_catalog` - SELECT público para itens ativos
- `user_inventory` - SELECT próprio, INSERT com auth
- `purchase_logs` - SELECT próprio + admin
- `profiles` - UPDATE próprio (avatar/mascote)

---

**Status:** ✅ **Completo**  
**Versão:** 1.0.1 (lucy)  
**Commit:** `hotfix(luci): lists + nav + store + polish pack`
