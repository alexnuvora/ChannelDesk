export function smartLinkDestination(raw: string): string | null {
  try {
    if (/[\u0000-\u0020\u007f]/.test(raw)) return null;
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname) return null;
    return url.href;
  } catch {return null;}
}
export function referrerOrigin(raw: string | null): string | null {
  try {return raw ? new URL(raw).origin : null;} catch {return null;}
}
