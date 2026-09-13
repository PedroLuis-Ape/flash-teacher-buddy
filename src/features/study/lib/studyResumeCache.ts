/**
 * Chaves e invalidação do cache da retomada.
 *
 * Toda superfície de estudo (Study e Prática Mista) usa este módulo ao sair ou
 * concluir uma sessão: sem isso a Home pode renderizar o card antigo do cache
 * do React Query mesmo com a sessão já persistida.
 */
export const STUDY_RESUME_QUERY_KEY = "study-resume";
export const HOME_DATA_QUERY_KEY = "home-data";

export interface StudyResumeCacheClient {
  invalidateQueries(filters: { queryKey: readonly unknown[] }): Promise<unknown> | unknown;
}

export async function invalidateStudyResumeCaches(client: StudyResumeCacheClient): Promise<void> {
  // A chave raiz invalida todos os escopos (usuário x institution) já
  // carregados; o Home Data acompanha porque o card divide a mesma tela.
  await client.invalidateQueries({ queryKey: [STUDY_RESUME_QUERY_KEY] });
  await client.invalidateQueries({ queryKey: [HOME_DATA_QUERY_KEY] });
}
