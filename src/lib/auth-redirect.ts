/**
 * Sanitises a post-login `next`/`from` value so it can only point inside this app.
 * Rejects absolute URLs, protocol-relative URLs (`//evil.com`) and backslash tricks.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(value)) return null;
  return value;
}
