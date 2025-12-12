/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 Pedro Luis de Oliveira Silva. Todos os direitos reservados.
 */

/**
 * Check if a user is considered "online" based on their last activity timestamp.
 * A user is considered online if they were active within the last 3 minutes.
 * 
 * @param lastActiveAt - ISO timestamp of last activity
 * @returns true if user is considered online
 */
export function isOnline(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return false;
  
  const last = new Date(lastActiveAt).getTime();
  const now = Date.now();
  const diffMs = now - last;
  const diffMinutes = diffMs / 1000 / 60;
  
  return diffMinutes <= 3; // Online if active in last 3 minutes
}

/**
 * Format a last active timestamp into a human-readable string.
 * 
 * @param lastActiveAt - ISO timestamp of last activity
 * @returns Formatted string like "agora mesmo", "há 3 minutos", "há 2 horas", etc.
 */
export function formatLastSeen(lastActiveAt: string | null | undefined): string {
  if (!lastActiveAt) return "Nunca";
  
  const last = new Date(lastActiveAt).getTime();
  const now = Date.now();
  const diffMs = now - last;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) {
    return "agora mesmo";
  }
  
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? "há 1 minuto" : `há ${diffMinutes} minutos`;
  }
  
  if (diffHours < 24) {
    return diffHours === 1 ? "há 1 hora" : `há ${diffHours} horas`;
  }
  
  if (diffDays === 1) {
    return "há 1 dia";
  }
  
  if (diffDays < 7) {
    return `há ${diffDays} dias`;
  }
  
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "há 1 semana" : `há ${weeks} semanas`;
  }
  
  const months = Math.floor(diffDays / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}
