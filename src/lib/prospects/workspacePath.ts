/** App path for a prospect's workspace (client-safe). */
export function prospectWorkspacePath(
  contactId: string,
  options?: { admin?: boolean }
): string {
  const base = options?.admin
    ? `/admin/prospects/${encodeURIComponent(contactId)}`
    : `/coach/prospects/${encodeURIComponent(contactId)}`;
  return base;
}
