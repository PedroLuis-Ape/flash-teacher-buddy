type PromptPreset = "batch" | "detailed" | "complete";
type PromptScope = "personal" | "classroom";

export function smartInterviewDefaults(preset: PromptPreset, scope: PromptScope): string[] {
  if (scope === "classroom") {
    return [
      "PERFIL INICIAL: TURMA COMPLETA",
      "- Camadas automáticas somente para sentidos ou usos realmente diferentes.",
      "- Explicações e exemplos em todos os cards em que fizer sentido.",
      "- Word hints para palavras e chunks relevantes.",
      "- Glossário Global ativado somente após confirmação explícita.",
    ];
  }

  if (preset === "batch") {
    return [
      "PERFIL INICIAL: LOTE SIMPLES",
      "- Camadas automáticas somente para sentidos realmente diferentes.",
      "- Explicações, exemplos extras, word hints e Glossário Global desativados.",
    ];
  }

  if (preset === "detailed") {
    return [
      "PERFIL INICIAL: DIDÁTICO",
      "- Camadas automáticas somente para sentidos realmente diferentes.",
      "- Explicações somente quando úteis e exemplos adicionais ativados.",
      "- Word hints e Glossário Global desativados.",
    ];
  }

  return [
    "PERFIL INICIAL: COMPLETO",
    "- Camadas automáticas somente para sentidos realmente diferentes.",
    "- Explicações, exemplos e word hints ativados quando úteis.",
    "- Glossário Global ativado somente após confirmação explícita.",
  ];
}

export function smartInterviewRules(preset: PromptPreset, scope: PromptScope): string[] {
  return [
    "ENTREVISTA INICIAL EM DUAS FASES",
    "- O perfil escolhido no App Piteco é apenas um ponto de partida.",
    "- Na primeira resposta, não gere JSON, mesmo que o pedido já pareça completo.",
    "- Faça todas as perguntas em uma única mensagem curta e sem termos técnicos.",
    "- Reaproveite o que o usuário já informou e peça apenas confirmação ou dados ausentes.",
    "- O usuário pode responder 'usar os padrões' para aceitar as opções pré-selecionadas.",
    "- Depois da resposta, gere o JSON diretamente. Só pergunte novamente se houver contradição que impeça a geração.",
    "",
    ...smartInterviewDefaults(preset, scope),
    "",
    "PERGUNTAS DA PRIMEIRA RESPOSTA",
    "1. Tema, nível e quantidade aproximada de cards.",
    "2. Estrutura: uma lista, várias listas, uma pasta com listas ou várias pastas.",
    "3. Direção dos idiomas e lado principal do estudo.",
    "4. Camadas: não usar; somente quando solicitado; ou automáticas para sentidos e usos realmente diferentes.",
    "5. Explicação detalhada: não; somente quando útil; ou em todos os cards possíveis.",
    "6. Exemplos adicionais e traduções dos exemplos: sim ou não.",
    "7. Word hints: não; apenas palavras difíceis; ou todo vocabulário relevante.",
    "8. Glossário Global: não; apenas termos importantes; ou completo. Explique que ele alimenta a Caixa de Glossário central da conta.",
    "- O Glossário Global sempre exige confirmação explícita, mesmo no perfil completo.",
  ];
}

export const SMART_LAYER_RULES = [
  "CONTRATO SEMÂNTICO DE CAMADAS",
  "- Um grupo layered representa um único termo-base, expressão, phrasal verb, estrutura ou conceito com sentidos, usos ou funções realmente diferentes.",
  "- group_title deve ser o termo-base estudado, como turn up, get ou may.",
  "- Nunca use como group_title uma frase completa, o nome de um idioma ou rótulos como Afirmativo, Negativo e Interrogativo.",
  "- Cada layer deve ser jogável sozinha e representar um sentido ou uso distinto do mesmo group_title.",
  "- Use context_tag em cada layer para resumir o sentido, por exemplo: aparecer, aumentar ou ser encontrado.",
  "- Todas as layers devem preservar a mesma direção de idiomas da lista.",
  "- Formas afirmativa, negativa e interrogativa não são camadas por si só, salvo pedido explícito do usuário.",
  "- Traduções sinônimas da mesma ideia não viram layers diferentes.",
  "- Escolha uma tradução principal e coloque a alternativa em short_observation.",
  "- Não una traduções alternativas em front ou back usando barra, pipe ou ponto e vírgula.",
  "- Não use layers para guardar explicações, exemplos ou dicas; esses conteúdos pertencem aos campos pedagógicos da própria layer.",
  "- Antes de gerar, revise cards normais com o mesmo termo-base e agrupe somente os que tiverem sentidos realmente distintos.",
];

export const SMART_LAYER_REFERENCE = `EXEMPLO CORRETO

Tradução alternativa da mesma ideia — card normal:
{
  "type": "normal",
  "front": "The train may arrive late.",
  "back": "Talvez o trem chegue atrasado.",
  "short_observation": "Também pode ser traduzido como: O trem pode chegar atrasado."
}

Sentidos diferentes do mesmo phrasal verb — grupo em camadas:
{
  "type": "layered",
  "group_title": "turn up",
  "layers": [
    {
      "front": "He turned up late.",
      "back": "Ele apareceu atrasado.",
      "context_tag": "aparecer"
    },
    {
      "front": "Turn up the volume.",
      "back": "Aumente o volume.",
      "context_tag": "aumentar"
    }
  ]
}`;
