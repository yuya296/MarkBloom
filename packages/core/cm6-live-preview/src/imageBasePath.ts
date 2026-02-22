export function resolveImageBasePath(baseUrl: string, origin?: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const resolvedOrigin =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const base = new URL(normalizedBase, resolvedOrigin);
  return new URL("assets/", base).toString();
}
