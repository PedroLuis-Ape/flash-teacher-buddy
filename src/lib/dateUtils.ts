/**
 * Safe date formatting utilities to prevent white screen crashes
 * due to timezone/locale issues across different regions
 */

/**
 * Safely formats a date string, returning a fallback if parsing fails
 */
export function safeFormatDate(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return "Data n/d";
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Data n/d";
    }
    
    // Use browser's locale for proper internationalization
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'pt-BR';
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...options
    };
    
    return date.toLocaleDateString(locale, defaultOptions);
  } catch (error) {
    console.warn('[safeFormatDate] Error formatting date:', error);
    return "Data n/d";
  }
}

/**
 * Safely formats a date with time
 */
export function safeFormatDateTime(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return "Data n/d";
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return "Data n/d";
    }
    
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'pt-BR';
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    };
    
    return date.toLocaleDateString(locale, defaultOptions);
  } catch (error) {
    console.warn('[safeFormatDateTime] Error formatting date:', error);
    return "Data n/d";
  }
}

/**
 * Safely get relative time string (e.g., "2 days ago")
 */
export function safeRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return "";
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays} dias atrás`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atrás`;
    return safeFormatDate(date, { day: '2-digit', month: 'short' });
  } catch (error) {
    return "";
  }
}
