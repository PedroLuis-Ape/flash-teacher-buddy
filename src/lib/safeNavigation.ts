import { NavigateFunction } from "react-router-dom";

/**
 * Navegação segura que verifica se há histórico válido
 * Se não houver, redireciona para uma rota segura
 */
export function safeGoBack(navigate: NavigateFunction, fallbackRoute = "/folders") {
  // Verifica se há histórico válido
  if (window.history.length > 2) {
    navigate(-1);
  } else {
    // Se não há histórico (ex: abriu direto pelo domínio), vai para fallback
    navigate(fallbackRoute, { replace: true });
  }
}

/**
 * Constrói o caminho correto baseado no contexto (portal ou privado)
 */
export function buildPath(
  pathname: string,
  type: "list" | "collection" | "folder",
  id: string
): string {
  const isPortal = pathname.startsWith("/portal");
  
  if (isPortal) {
    return `/portal/${type}/${id}`;
  }
  
  return `/${type}/${id}`;
}

/**
 * Verifica se a rota é pública
 */
export function isPublicRoute(pathname: string): boolean {
  return pathname.startsWith("/portal") || pathname.startsWith("/auth");
}

/**
 * Obtém a rota de fallback baseada no contexto atual
 */
export function getFallbackRoute(pathname: string): string {
  return isPublicRoute(pathname) ? "/auth" : "/folders";
}
