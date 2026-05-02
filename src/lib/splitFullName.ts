/**
 * Derives first/last from a single display name (inverse of joining first + last in PATCH).
 * First token → first_name; remainder → last_name.
 */
export function splitFullName(fullName: string): {
  first_name: string | null;
  last_name: string | null;
} {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { first_name: null, last_name: null };
  }
  const i = trimmed.indexOf(" ");
  if (i === -1) {
    return { first_name: trimmed, last_name: null };
  }
  const first = trimmed.slice(0, i).trim();
  const last = trimmed.slice(i + 1).trim();
  return {
    first_name: first || null,
    last_name: last || null,
  };
}
