/**
 * O ponteiro de retomada deixou de ser escrito por mudança de URL.
 *
 * Uma URL de estudo não prova que existe sessão válida, deck pronto ou card
 * jogável — e escrever ali criava ponteiros que apontavam para nada. A escrita
 * passou a acontecer em Study.tsx (publishResumePointer), somente quando a
 * sessão foi criada ou restaurada e o snapshot local já foi gravado.
 *
 * O componente permanece como no-op para não alterar a árvore de layout.
 */
export function StudyResumeAgent() {
  return null;
}
