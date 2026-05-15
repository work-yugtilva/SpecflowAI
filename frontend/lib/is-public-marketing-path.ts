/** Paths that must not run auth middleware (marketing / landing). */
export function isPublicMarketingPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/pricing")) return true;
  if (pathname.startsWith("/opportunities")) return true;
  return false;
}
