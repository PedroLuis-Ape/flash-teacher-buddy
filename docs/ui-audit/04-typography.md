# 04 — Typography and Readability

1. **Escopo vistoriado:** texto principal/secundário, muted, opacidade, glassmorphism, placeholders, labels, descrições e números.
2. **Arquivos analisados:** CSS global, componentes shadcn, landing, shell, modais, hub e estudo.
3. **Rotas analisadas:** landing, auth, home, biblioteca, portal, hub e estudo.
4. **Evidências:** uso amplo de `text-muted-foreground`, classes de opacidade, alpha backgrounds e backdrop blur; tamanhos explícitos de 10/11 px; Nunito já cobre acentos e pesos necessários.
5. **Problemas:** texto “apagado”, hierarquia baseada em transparência e corpo pequeno em áreas densas.
6. **Severidade:** P1.
7. **Causas:** muted genérico para múltiplas funções e opacidade aplicada em containers.
8. **Três propostas:** A) trocar fonte; B) manter Nunito e corrigir escala/peso/semântica; C) fonte nova só para display.
9. **Recomendação:** B nesta série; avaliar display separado somente com licença, privacidade e custo comprovados.
10. **Impacto mobile:** corpo mínimo legível, line-height maior e descrições condensadas por disclosure.
11. **Impacto desktop:** melhor leitura em painéis densos sem inflar toda a interface.
12. **Acessibilidade:** texto normal alvo 7:1 no Playful; nunca abaixo de AA; disabled continua legível.
13. **Performance:** zero nova fonte e zero peso adicional no caminho crítico.
14. **Riscos:** aumentar tamanho sem corrigir layout; perda de hierarquia ao tornar tudo igualmente forte.
15. **Testes:** contraste automatizado/manual, 200%/400%, nomes longos, PT/EN e placeholders.
16. **Arquivos que mudariam:** tokens tipográficos, primitives Text/Label, estilos por superfície e testes.
