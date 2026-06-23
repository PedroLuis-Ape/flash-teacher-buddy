type PromptPreset = "batch" | "detailed" | "complete";
type PromptScope = "personal" | "classroom";

export function smartInterviewDefaults(preset: PromptPreset, scope: PromptScope): string[] {
  const shared = [
    "- Cards em camadas: desativados no Super Importador.",
    "- Quando um termo tiver interpretações úteis diferentes, crie um card normal separado para cada interpretação.",
  ];

  if (scope === "classroom") {
    return [
      "PERFIL INICIAL: TURMA COMPLETA",
      ...shared,
      "- Explicações e exemplos em todos os cards em que fizer sentido.",
      "- Word hints para palavras e chunks relevantes.",
      "- Glossário Global ativado somente após confirmação explícita.",
    ];
  }

  if (preset === "batch") {
    return [
      "PERFIL INICIAL: LOTE SIMPLES",
      ...shared,
      "- Explicações, exemplos extras, word hints e Glossário Global desativados.",
    ];
  }

  if (preset === "detailed") {
    return [
      "PERFIL INICIAL: DIDÁTICO",
      ...shared,
      "- Explicações somente quando úteis e exemplos adicionais ativados.",
      "- Word hints e Glossário Global desativados.",
    ];
  }

  return [
    "PERFIL INICIAL: COMPLETO",
    ...shared,
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
    "4. Explicação detalhada: não; somente quando útil; ou em todos os cards possíveis.",
    "5. Exemplos adicionais e traduções dos exemplos: sim ou não.",
    "6. Word hints: não; apenas palavras difíceis; ou todo vocabulário relevante.",
    "7. Glossário Global: não; apenas termos importantes; ou completo. Explique que ele alimenta a Caixa de Glossário central da conta.",
    "- Não pergunte se o usuário quer camadas: o Super Importador sempre gera cards normais separados.",
    "- O Glossário Global sempre exige confirmação explícita, mesmo no perfil completo.",
  ];
}

export const NORMAL_CARD_INTERPRETATION_RULES = [
  "CONTRATO DE INTERPRETAÇÕES — CARDS NORMAIS APENAS",
  "- Nunca gere objetos com type=layered, group_title ou layers.",
  "- Cada interpretação útil, significado ou uso realmente diferente deve virar um card normal independente.",
  "- Não coloque duas interpretações no mesmo front ou back usando barra, pipe, ponto e vírgula ou uma lista de traduções.",
  "- Preserve o mesmo termo no lado correspondente e diferencie os cards pelo significado, context_tag, exemplo ou short_observation.",
  "- Exemplo obrigatório: o verbo to be deve gerar pelo menos um card para ser e outro card para estar quando ambos forem úteis ao conteúdo.",
  "- Phrasal verbs com sentidos diferentes também devem virar cards normais separados, um para cada sentido.",
  "- Traduções meramente sinônimas da mesma ideia podem ficar como tradução principal mais short_observation, sem criar duplicação desnecessária.",
  "- O usuário poderá selecionar esses cards depois e usar a função manual Mesclar em camadas na tela da lista.",
];

export const NORMAL_CARD_REFERENCE = `EXEMPLOS CORRETOS

Verbo com duas interpretações úteis — dois cards normais:
{
  "type": "normal",
  "front": "to be",
  "back": "ser",
  "context_tag": "identidade ou característica"
}
{
  "type": "normal",
  "front": "to be",
  "back": "estar",
  "context_tag": "estado ou localização"
}

Phrasal verb com sentidos diferentes — cards normais separados:
{
  "type": "normal",
  "front": "turn up",
  "back": "aparecer",
  "context_tag": "chegar ou aparecer"
}
{
  "type": "normal",
  "front": "turn up",
  "back": "aumentar",
  "context_tag": "aumentar volume ou intensidade"
}

Tradução alternativa da mesma ideia — um card normal:
{
  "type": "normal",
  "front": "The train may arrive late.",
  "back": "Talvez o trem chegue atrasado.",
  "short_observation": "Também pode ser traduzido como: O trem pode chegar atrasado."
}`;
