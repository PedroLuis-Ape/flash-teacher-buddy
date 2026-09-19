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
  // Entrada permanente da extensão: precisa ser pública para que qualquer
  // visitante (inclusive quem nunca criou conta) consiga reencontrá-la.
  '/extensao',
  '/pt-br',
  '/en',
] as const;

/**
 * Rotas que servem a landing pública. Fonte única: `PUBLIC_EXACT` deriva daqui
 * e `isPublicLandingPath` responde à pergunta "esta rota é a landing?".
 */
const PUBLIC_LANDING_PATHS = ['/', '/landing'] as const;

const PUBLIC_EXACT = new Set<string>(PUBLIC_LANDING_PATHS);

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

/**
 * Landing pública (canônica `/` e alias `/landing`), tolerante a barra final.
 *
 * É a superfície onde o convite da extensão pode aparecer SEM login: o gate de
 * autenticação não vale para página pública de aquisição.
 */
export function isPublicLandingPath(pathname: string): boolean {
  const normalized = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return (PUBLIC_LANDING_PATHS as readonly string[]).includes(normalized);
}
