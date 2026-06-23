import { buildFinalGlobalImportPrompt } from "./finalPrompt";
import type {
  GlobalImportAiPreset,
  GlobalImportPromptDestinationContext,
} from "./presets";
import {
  NORMAL_CARD_INTERPRETATION_RULES,
  NORMAL_CARD_REFERENCE,
  smartInterviewRules,
} from "./smartInterview";

export function buildOwnerFinalImportPrompt(
  preset: GlobalImportAiPreset,
  context: GlobalImportPromptDestinationContext,
): string {
  const canarySections = [
    "REGRA FINAL DA VERSÃO CANÁRIO",
    "- As escolhas confirmadas na entrevista valem mais do que os padrões iniciais do perfil.",
    "- A primeira resposta deve ser a entrevista; o JSON só pode ser produzido depois da resposta do usuário.",
    ...smartInterviewRules(preset, context.scope),
    "",
    ...NORMAL_CARD_INTERPRETATION_RULES,
    "",
    NORMAL_CARD_REFERENCE,
    "",
    "CONFIGURAÇÃO CONFIRMADA PELO USUÁRIO",
    "- As respostas da entrevista definem os recursos usados no documento final.",
    "- Não inclua um recurso recusado pelo usuário.",
    "- A primeira resposta contém somente a entrevista, sem JSON.",
    "- Depois da resposta do usuário, a saída contém somente o JSON final.",
    "- A resposta 'usar os padrões' confirma as opções iniciais do perfil.",
    "- O Glossário Global precisa de confirmação explícita.",
    "- Nunca gere cards layered. Gere interpretações úteis como cards normais separados.",
  ];

  return [buildFinalGlobalImportPrompt(preset, context), "", ...canarySections].join("\n");
}
