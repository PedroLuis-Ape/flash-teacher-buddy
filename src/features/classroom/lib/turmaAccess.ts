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
