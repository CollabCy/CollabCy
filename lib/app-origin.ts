/**
 * In-app navigation must stay on the current origin.
 * Absolute hosts (including production) are stripped down to path + search + hash.
 * Never rewrite to a configured production URL; stay on window.location.origin.
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
