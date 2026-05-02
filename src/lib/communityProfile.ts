export type ProfileNames = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export function displayNameFromProfile(p: ProfileNames): string {
  const full = p.full_name?.trim();
  if (full) return full;
  const parts = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  if (parts) return parts;
  return "Member";
}
