/**
 * Safe date formatting utilities to prevent white screen crashes
 * due to timezone/locale issues across different regions.
 * These utilities are i18n-aware and use the current language setting.
 */

import i18n from '@/i18n/config';

/**
 * Get the appropriate locale based on current i18n language
 */
function getLocale(): string {
  const lang = i18n.language || 'pt';
  const localeMap: Record<string, string> = {
    pt: 'pt-BR',
    en: 'en-US',
  };
  return localeMap[lang] || localeMap['pt'];
}

/**
 * Get i18n-aware fallback text for unavailable dates
 */
function getDateFallback(): string {
  try {
    return i18n.t('dates.notAvailable') || 'Data n/d';
  } catch {
    return 'Data n/d';
  }
}

/**
 * Safely formats a date string, returning a fallback if parsing fails
 */
export function safeFormatDate(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return getDateFallback();
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return getDateFallback();
    }
    
    const locale = getLocale();
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...options
    };
    
    return date.toLocaleDateString(locale, defaultOptions);
  } catch (error) {
    console.warn('[safeFormatDate] Error formatting date:', error);
    return getDateFallback();
  }
}

/**
 * Safely formats a date with time
 */
export function safeFormatDateTime(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return getDateFallback();
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return getDateFallback();
    }
    
    const locale = getLocale();
    
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
    return getDateFallback();
  }
}

/**
 * Safely get relative time string using Intl.RelativeTimeFormat
 */
export function safeRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return "";
    }
    
    const locale = getLocale();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    
    if (diffSeconds < 60) {
      return rtf.format(-diffSeconds, 'second');
    } else if (diffSeconds < 3600) {
      return rtf.format(-Math.floor(diffSeconds / 60), 'minute');
    } else if (diffSeconds < 86400) {
      return rtf.format(-Math.floor(diffSeconds / 3600), 'hour');
    } else if (diffSeconds < 2592000) {
      return rtf.format(-Math.floor(diffSeconds / 86400), 'day');
    } else if (diffSeconds < 31536000) {
      return rtf.format(-Math.floor(diffSeconds / 2592000), 'month');
    } else {
      return rtf.format(-Math.floor(diffSeconds / 31536000), 'year');
    }
  } catch (error) {
    console.warn('[safeRelativeTime] Error:', error);
    return safeFormatDate(dateInput, { day: '2-digit', month: 'short' });
  }
}
