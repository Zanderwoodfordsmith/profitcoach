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

export function profileInitialsFromName(name: string | null | undefined): string {
  const cleaned = name?.trim() ?? "";
  if (!cleaned) return "ME";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? "";
    const b = parts[1]?.[0] ?? "";
    return `${a}${b}`.toUpperCase();
  }
  if (cleaned.length >= 2) return cleaned.slice(0, 2).toUpperCase();
  return `${cleaned[0] ?? ""}${cleaned[0] ?? ""}`.toUpperCase();
}

export function profileInitialsFromProfile(p: ProfileNames | null | undefined): string {
  const name = p ? displayNameFromProfile(p) : "Member";
  return profileInitialsFromName(name);
}
