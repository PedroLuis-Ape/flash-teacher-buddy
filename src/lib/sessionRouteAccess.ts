const PUBLIC_PREFIXES = [
  '/auth',
  '/portal',
  '/about',
  '/ingles-para-iniciantes',
  '/atividades-de-ingles',
  '/flashcards-de-ingles',
  '/para-professores',
] as const;

const PUBLIC_EXACT = new Set<string>(['/', '/landing']);

export function isPublicClassSharePath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || parts[0] !== 'turmas') return false;

  const classId = parts[1];
  return classId !== 'professor' && classId !== 'aluno';
}

export function isProtectedPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return false;
  if (isPublicClassSharePath(pathname)) return false;
  return !PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
