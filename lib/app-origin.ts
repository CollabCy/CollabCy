/**
 * In-app navigation must stay on the current origin.
 * Absolute hosts (including production) are stripped down to path + search + hash.
 * Auth callbacks keep window.location.origin so local and production OAuth
 * continue to use whichever origin the user is actually on.
 */

export function toInAppPath(href: string): string {
  if (!href) return "/";
  if (href.startsWith("#") || href.startsWith("?")) return href;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = href.startsWith("//") ? new URL(`https:${href}`) : new URL(href);
    return `${url.pathname}${url.search}${url.hash}` || "/";
  } catch {
    return "/";
  }
}

export function sanitizeNextParam(next?: string | null): string | null {
  if (next == null || next === "") return null;
  if (next === "promote") return "promote";
  return toInAppPath(next);
}

/** Current origin for Supabase redirectTo. Never a configured production URL. */
export function authRedirectUrl(path?: string): string {
  if (typeof window === "undefined") return path ? toInAppPath(path) : "/";
  if (!path || path === "/") return window.location.origin;
  return `${window.location.origin}${toInAppPath(path)}`;
}
