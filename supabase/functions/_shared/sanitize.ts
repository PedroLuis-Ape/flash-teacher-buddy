/**
 * Shared HTML sanitization for Edge Functions.
 * Escapes dangerous characters to prevent XSS when text is stored/displayed.
 */
export function sanitizeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize text for display: trim, enforce max length, and escape HTML.
 * Throws if text exceeds maxLength.
 */
export function sanitizeForDisplay(text: string, maxLength: number = 5000): string {
  const trimmed = text.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`Text exceeds maximum length of ${maxLength}`);
  }
  return sanitizeHtml(trimmed);
}
