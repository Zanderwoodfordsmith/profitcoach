import { sanitizeShareUrl } from "@/lib/shareLinks/sanitizeUrl";

export const SOCIAL_NETWORKS = [
  "linkedin",
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
  "x",
  "website",
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export type SocialLinks = Partial<Record<Exclude<SocialNetwork, "linkedin">, string>>;

export const SOCIAL_NETWORK_META: Record<
  SocialNetwork,
  { label: string; placeholder: string; handleBase?: string }
> = {
  linkedin: {
    label: "LinkedIn",
    placeholder: "https://www.linkedin.com/in/you",
    handleBase: "https://www.linkedin.com/in/",
  },
  instagram: {
    label: "Instagram",
    placeholder: "https://www.instagram.com/you",
    handleBase: "https://www.instagram.com/",
  },
  facebook: {
    label: "Facebook",
    placeholder: "https://www.facebook.com/you",
    handleBase: "https://www.facebook.com/",
  },
  youtube: {
    label: "YouTube",
    placeholder: "https://www.youtube.com/@you",
    handleBase: "https://www.youtube.com/@",
  },
  tiktok: {
    label: "TikTok",
    placeholder: "https://www.tiktok.com/@you",
    handleBase: "https://www.tiktok.com/@",
  },
  x: {
    label: "X",
    placeholder: "https://x.com/you",
    handleBase: "https://x.com/",
  },
  website: {
    label: "Website",
    placeholder: "https://your-site.com",
  },
};

export function isSocialNetwork(value: string): value is SocialNetwork {
  return (SOCIAL_NETWORKS as readonly string[]).includes(value);
}

export function parseSocialLinks(raw: unknown): SocialLinks {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const next: SocialLinks = {};
  for (const key of SOCIAL_NETWORKS) {
    if (key === "linkedin") continue;
    const value = source[key];
    if (typeof value !== "string") continue;
    const parsed = sanitizeShareUrl(value);
    if (parsed.ok) next[key] = parsed.url;
  }
  return next;
}

export function normalizeSocialInput(
  network: SocialNetwork,
  raw: string
): ReturnType<typeof sanitizeShareUrl> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Add a URL." };

  const meta = SOCIAL_NETWORK_META[network];
  const looksLikeUrl = /[./]/.test(trimmed) || /^https?:\/\//i.test(trimmed);
  if (!looksLikeUrl && meta.handleBase) {
    const handle = trimmed.replace(/^@/, "");
    return sanitizeShareUrl(`${meta.handleBase}${handle}`);
  }
  return sanitizeShareUrl(trimmed);
}
