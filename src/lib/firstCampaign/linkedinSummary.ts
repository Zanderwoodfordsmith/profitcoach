import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";

/** Compact LinkedIn snapshot for prompts (roles, sectors, about). */
export function summarizeLinkedInSnapshot(
  snapshot: LinkedInProfileSnapshot | null | undefined,
  extras?: { fullName?: string | null; businessName?: string | null }
): string {
  if (!snapshot) {
    return extras?.fullName
      ? `Coach: ${extras.fullName}. No LinkedIn snapshot yet.`
      : "No LinkedIn snapshot available.";
  }

  const lines: string[] = [];
  const name =
    snapshot.fullName ||
    [snapshot.firstName, snapshot.lastName].filter(Boolean).join(" ") ||
    extras?.fullName;
  if (name) lines.push(`Name: ${name}`);
  if (extras?.businessName) lines.push(`Business: ${extras.businessName}`);
  if (snapshot.headline) lines.push(`Headline: ${snapshot.headline}`);
  if (snapshot.location) lines.push(`Location: ${snapshot.location}`);
  if (snapshot.about) {
    lines.push(`About: ${snapshot.about.slice(0, 1200)}`);
  }

  const exp = snapshot.experiences ?? [];
  if (exp.length) {
    lines.push("Experience:");
    for (const e of exp.slice(0, 8)) {
      const bits = [e.title, e.company, e.industry, e.duration]
        .filter(Boolean)
        .join(" · ");
      if (bits) lines.push(`- ${bits}`);
      if (e.description) lines.push(`  ${e.description.slice(0, 240)}`);
    }
  }

  const skills = snapshot.skills?.slice(0, 12) ?? [];
  if (skills.length) lines.push(`Skills: ${skills.join(", ")}`);

  return lines.join("\n");
}
