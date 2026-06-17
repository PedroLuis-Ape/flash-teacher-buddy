export type TurmaViewMode = 'private' | 'public';

interface ResolveTurmaViewModeInput {
  publicPreview: boolean;
  authenticated: boolean;
  hasPrivateAccess: boolean;
}

export function resolveTurmaViewMode(input: ResolveTurmaViewModeInput): TurmaViewMode {
  if (input.publicPreview) return 'public';
  if (input.authenticated && input.hasPrivateAccess) return 'private';
  return 'public';
}

interface BuildPublicTurmaSearchParamsInput {
  publicPreview: boolean;
  assignmentId?: string | null;
}

export function buildPublicTurmaSearchParams(
  input: BuildPublicTurmaSearchParamsInput,
): URLSearchParams {
  const params = new URLSearchParams();
  if (input.publicPreview) params.set('publicPreview', 'true');
  if (input.assignmentId) params.set('atribuicao', input.assignmentId);
  return params;
}
