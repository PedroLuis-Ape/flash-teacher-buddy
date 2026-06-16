import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { GlobalLayout } from '@/components/layout/GlobalLayout';
import { PublicShell } from '@/components/layout/PublicShell';
import { useAuthUser } from '@/hooks/useAuthUser';

interface PublicAwareGlobalLayoutProps {
  children: ReactNode;
}

function isSharedClassPath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'turmas' || parts.length < 2) return false;
  return parts[1] !== 'professor' && parts[1] !== 'aluno';
}

/**
 * Keeps the existing global layout rules intact, but sends anonymous direct
 * classroom links through the lightweight public shell.
 */
export function PublicAwareGlobalLayout({ children }: PublicAwareGlobalLayoutProps) {
  const location = useLocation();
  const { user, isLoading } = useAuthUser();

  if (!isLoading && !user && isSharedClassPath(location.pathname)) {
    return <PublicShell>{children}</PublicShell>;
  }

  return <GlobalLayout>{children}</GlobalLayout>;
}
