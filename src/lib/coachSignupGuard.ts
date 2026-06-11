type SignupFields = {
  fullName: string;
  businessName?: string;
  email: string;
  slug: string;
};

function dotCountInEmailLocalPart(email: string): number {
  const local = email.split("@")[0] ?? "";
  return (local.match(/\./g) ?? []).length;
}

/** Random bot strings: long, no spaces, alphanumeric only. */
export function looksLikeRandomBotString(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 12) return false;
  if (/\s/.test(trimmed)) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return false;

  const hasUpper = /[A-Z]/.test(trimmed);
  const hasLower = /[a-z]/.test(trimmed);
  if (hasUpper && hasLower && trimmed.length >= 15) return true;
  return trimmed.length >= 20;
}

export function looksLikeBotSignup(fields: SignupFields): boolean {
  const email = fields.email.trim().toLowerCase();
  if (dotCountInEmailLocalPart(email) >= 4) return true;

  if (looksLikeRandomBotString(fields.fullName)) return true;
  if (fields.businessName && looksLikeRandomBotString(fields.businessName)) {
    return true;
  }
  if (looksLikeRandomBotString(fields.slug)) return true;

  return false;
}
