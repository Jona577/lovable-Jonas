/**
 * Basic HTML sanitizer - strips dangerous tags while preserving formatting.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  // Remove script tags and their content
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers
  clean = clean.replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  
  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*["']?\s*javascript:/gi, 'href="');
  
  // Remove iframe, object, embed tags
  clean = clean.replace(/<(iframe|object|embed|form|input|textarea|button)\b[^>]*>/gi, '');
  clean = clean.replace(/<\/(iframe|object|embed|form|input|textarea|button)>/gi, '');
  
  return clean;
}
