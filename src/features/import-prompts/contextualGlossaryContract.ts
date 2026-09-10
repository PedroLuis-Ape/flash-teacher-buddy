export const CONTEXTUAL_GLOSSARY_RULES = `GLOSSÁRIO HÍBRIDO — PRESERVAÇÃO SEMÂNTICA
Leia a frase completa, o outro lado do card, idiomas, context_tag e exemplos antes de escolher um sentido.
Separe significado base/global, significado contextual por ocorrência e expressão. Nenhuma camada substitui outra.
NÃO TRADUZA PALAVRAS ISOLADAMENTE QUANDO EXISTIR CONTEXTO.
Procure phrasal verbs, idioms, chunks e collocations úteis; não transforme qualquer bigrama em expressão.
workout (treino) não é work out. worked out pode ser deu certo ou malhou conforme front + back.
Registre sentidos específicos somente em word_hints do card; nunca os promova a entradas globais.
Quando o formato de saída aceitar word_hints: use scope contextual, kind word/expression e expression para a forma canônica.
text deve preservar a forma encontrada. Índices são UTF-16, início inclusivo/fim exclusivo, sobre o texto original intacto.
Para turn the light off, use segments com text/startIndex/endIndex para Turn e off, sem incluir the light.
Mantenha palavras individuais úteis e suas notas; não invente traduções literais para partículas.
Não repita traduções idênticas sem necessidade; não misture sentidos de cards diferentes.
Se o formato aceitar somente entradas globais, NÃO inclua campos contextuais nem generalize um sentido exclusivo de um card: solicite o fluxo de cards/Smart Import.
Não altere frases, referências, lados, posições ou evidências para acomodar a tradução.
Cobertura lexical não comprova cobertura de expressões nem qualidade semântica.`;
