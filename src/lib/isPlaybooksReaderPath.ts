/**
 * Individual playbook pages only — blog-like reader (no app sidebar / account chrome).
 * Library routes (/client/playbooks, /admin/playbooks, etc.) stay on the normal dashboard.
 */

function normalizePathname(pathname: string | null): string {
  if (!pathname) return "";
  let p = pathname.split("?")[0] ?? pathname;
  if (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }
  return p;
}

export function isPlaybooksReaderPath(pathname: string | null): boolean {
  const path = normalizePathname(pathname);
  if (!path) return false;

  // /client/playbooks/:ref (e.g. Focus → /client/playbooks/1.0)
  if (path.startsWith("/client/playbooks/")) {
    const rest = path.slice("/client/playbooks/".length);
    return rest.length > 0 && !rest.includes("/");
  }

  // /coach/contacts/:id/playbooks/:ref
  if (/^\/coach\/contacts\/[^/]+\/playbooks\/[^/]+$/.test(path)) {
    return true;
  }

  // /admin/playbooks/:ref — editor/preview (single ref segment)
  if (path.startsWith("/admin/playbooks/")) {
    const rest = path.slice("/admin/playbooks/".length);
    return rest.length > 0 && !rest.includes("/");
  }

  return false;
}
