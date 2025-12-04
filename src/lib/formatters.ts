import i18n from '@/i18n/config';

/**
 * Get current locale from i18n
 */
export function getCurrentLocale(): string {
  const lang = i18n.language || 'pt';
  // Map short codes to full locale codes
  const localeMap: Record<string, string> = {
    pt: 'pt-BR',
    en: 'en-US',
  };
  return localeMap[lang] || localeMap['pt'];
}

/**
 * Format currency value using Intl.NumberFormat
 */
export function formatCurrency(
  value: number,
  currencyCode: string = 'BRL',
  locale?: string
): string {
  const targetLocale = locale || getCurrentLocale();
  
  try {
    return new Intl.NumberFormat(targetLocale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `${currencyCode} ${value.toFixed(2)}`;
  }
}

/**
 * Format date using Intl.DateTimeFormat
 */
export function formatDate(
  date: Date | string | number,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const targetLocale = locale || getCurrentLocale();
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };

  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return i18n.t('dates.notAvailable');
    }
    
    return new Intl.DateTimeFormat(targetLocale, options || defaultOptions).format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return i18n.t('dates.notAvailable');
  }
}

/**
 * Format date with time
 */
export function formatDateTime(
  date: Date | string | number,
  locale?: string
): string {
  return formatDate(date, locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale?: string
): string {
  const targetLocale = locale || getCurrentLocale();
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return i18n.t('dates.notAvailable');
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
    
    const rtf = new Intl.RelativeTimeFormat(targetLocale, { numeric: 'auto' });
    
    if (diffInSeconds < 60) {
      return rtf.format(-diffInSeconds, 'second');
    } else if (diffInSeconds < 3600) {
      return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
    } else if (diffInSeconds < 86400) {
      return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
    } else if (diffInSeconds < 2592000) {
      return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
    } else if (diffInSeconds < 31536000) {
      return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
    } else {
      return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year');
    }
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return formatDate(date, locale);
  }
}

/**
 * Format number with locale-specific separators
 */
export function formatNumber(
  value: number,
  locale?: string,
  options?: Intl.NumberFormatOptions
): string {
  const targetLocale = locale || getCurrentLocale();
  
  try {
    return new Intl.NumberFormat(targetLocale, options).format(value);
  } catch (error) {
    console.error('Error formatting number:', error);
    return value.toString();
  }
}
