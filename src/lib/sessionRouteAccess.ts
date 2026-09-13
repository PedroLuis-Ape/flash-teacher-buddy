const PUBLIC_PREFIXES = [
  '/pt-br/materiais',
  '/en/materiais',
  '/es/materiais',
  '/fr/materiais',
  '/it/materiais',
  '/pt-br/material',
  '/en/material',
  '/es/material',
  '/fr/material',
  '/it/material',
  '/auth',
  '/portal',
  '/about',
  '/ingles-para-iniciantes',
  '/atividades-de-ingles',
  '/flashcards-de-ingles',
  '/para-professores',
  '/pt-br',
  '/en',
] as const;

const PUBLIC_EXACT = new Set<string>(['/', '/landing']);

export function isPublicClassSharePath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || parts[0] !== 'turmas') return false;

  const classId = parts[1];
  return classId !== 'professor' && classId !== 'aluno';
}

export function isProtectedPath(pathname: string): boolean {
  // O segmento de locale é sempre minúsculo na URL canônica; normalizar evita
  // que um link com `pt-BR` (code do banco) ou digitado à mão caia no gate de
  // rota protegida e devolva página vazia para visitante anônimo.
  const normalized = pathname.toLowerCase();
  if (PUBLIC_EXACT.has(normalized)) return false;
  if (isPublicClassSharePath(normalized)) return false;
  return !PUBLIC_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
