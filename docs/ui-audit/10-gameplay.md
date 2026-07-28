# 10 — Gameplay Experience

1. **Escopo vistoriado:** Flip, Escrever, Múltipla escolha, Organizar frase, Misto, Pronúncia, Rodadas de Domínio e Fluxo Contínuo.
2. **Arquivos analisados:** tela de estudo, componentes de card/HUD/resposta, favoritos, Foco Vermelho, camadas, áudio, conclusão e snapshots.
3. **Rotas analisadas:** estudo e retomada de sessão.
4. **Evidências:** tela principal supera 2.000 linhas; ações, persistência e apresentação estão próximas; recursos recentes de repetir card, classificar pulo, presets, recovery e camadas são invariantes.
5. **Problemas:** risco alto de regressão, área principal comprimida no mobile e estados visuais inconsistentes.
6. **Severidade:** P1; qualquer perda de sessão/dado seria P0.
7. **Causas:** componente monolítico e recursos adicionados verticalmente.
8. **Três propostas:** A) CSS global sobre a tela; B) adaptadores visuais e primitives, sem tocar engine; C) reescrever cada modo.
9. **Recomendação:** B; extrair apresentação somente após testes de caracterização.
10. **Impacto mobile:** card e ação principal dominam; secundários em drawer/accordion; HUD compacto.
11. **Impacto desktop:** painel contextual lateral, sem mudar sequência ou atalhos.
12. **Acessibilidade:** foco pós-resposta, anúncios de estado, não depender de cor, target 44 px e reduced motion.
13. **Performance:** feedback CSS imediato; nada deve aguardar animação para persistir; medir INP por modo.
14. **Riscos:** alterar classificação de pulo, repetição, mastery, favoritos, Red Focus, snapshot, camadas ou avanço.
15. **Testes:** matriz por modo/ação, reload, recovery, offline transitório, duas abas, atalhos, camadas, respostas longas e três execuções críticas.
16. **Arquivos que mudariam:** tokens/primitives de estudo, componentes visuais e testes; engines/hooks críticos ficam congelados na primeira onda.
