const PUBLIC_PREFIXES = ['/auth', '/portal', '/pt-br', '/en'] as const;

const PUBLIC_EXACT = new Set<string>([
  '/',
  '/landing',
  '/about',
  '/ingles-para-iniciantes',
  '/atividades-de-ingles',
  '/flashcards-de-ingles',
  '/para-professores',
]);

function normalizePathname(pathname: string): string {
  const pathOnly = pathname.split(/[?#]/, 1)[0] || '/';
  return pathOnly.length > 1 ? pathOnly.replace(/\/+$/, '') : pathOnly;
}

function matchesPublicPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicClassSharePath(pathname: string): boolean {
  const parts = normalizePathname(pathname).split('/').filter(Boolean);
  if (parts.length !== 2 || parts[0] !== 'turmas') return false;

  const classId = parts[1];
  return classId !== 'professor' && classId !== 'aluno';
}

export function isPublicPath(pathname: string): boolean {
  const normalizedPathname = normalizePathname(pathname);
  if (PUBLIC_EXACT.has(normalizedPathname)) return true;
  if (isPublicClassSharePath(normalizedPathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => matchesPublicPrefix(normalizedPathname, prefix));
}

export function shouldUsePublicShell(pathname: string, isGuest: boolean): boolean {
  if (isPublicClassSharePath(pathname)) return isGuest;
  return isPublicPath(pathname);
}

export function isProtectedPath(pathname: string): boolean {
  return !isPublicPath(pathname);
}
