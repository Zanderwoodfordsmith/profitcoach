import "server-only";

import { applyDirectoryOrder } from "@/lib/directoryOrder";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { headlineAndAbout } from "./load";
import { placeFor, type Place } from "./places";
import { DEFAULT_PHOTO_FOCUS, firstNameOf, parseDirectoryPage } from "./types";

/** One coach on the directory overview. Public fields only. */
export type DirectoryCard = {
  slug: string;
  name: string;
  firstName: string;
  /** The name after the first word, for the two-weight name. */
  restName: string;
  business: string | null;
  avatarUrl: string | null;
  focus: { x: number; y: number };
  /** The headline, else the start of the About text. */
  line: string | null;
  location: string | null;
  place: Place | null;
  /** Sectors from the coach's page (AI-drafted until the coach edits them). */
  industries: string[];
};

type Row = {
  slug: string;
  profiles: {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    coach_business_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    directory_summary: string | null;
    directory_bio: string | null;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    directory_page: unknown;
    access_removed_at: string | null;
  } | null;
};

/** "Alderley Edge, England, United Kingdom" reads as "Alderley Edge". */
function shortPlace(location: string): string {
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  while (parts.length > 1 && /^(uk|united kingdom|england|great britain|gb)$/i.test(parts[parts.length - 1])) parts.pop();
  return parts.join(", ");
}

function shorten(text: string, max = 220): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/**
 * Every listed coach, in browse order: photo and words first, then by name,
 * then the hand-picked order on top. Small enough to filter in the browser.
 */
export async function loadDirectoryCards(): Promise<DirectoryCard[]> {
  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select(
      `slug, profiles!inner ( full_name, first_name, last_name, coach_business_name, avatar_url, bio,
         directory_summary, directory_bio, location, latitude, longitude, directory_page, access_removed_at )`,
    )
    .eq("directory_listed", true);
  if (error) {
    console.error("loadDirectoryCards:", error.message);
    return [];
  }

  const cards = ((data ?? []) as unknown as Row[]).flatMap((row) => {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!p || p.access_removed_at) return [];
    const name =
      p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || row.slug;
    const firstName = firstNameOf(name);
    const copy = headlineAndAbout(p);
    const location = p.location?.trim() || null;
    const page = parseDirectoryPage(p.directory_page);
    const card: DirectoryCard = {
      slug: row.slug,
      name,
      firstName,
      restName: name.slice(firstName.length).trim(),
      business: p.coach_business_name?.trim() || null,
      avatarUrl: p.avatar_url?.trim() || null,
      focus: page.photo_focus ?? DEFAULT_PHOTO_FOCUS,
      line: copy.headline ?? (copy.about ? shorten(copy.about) : null),
      location: location ? shortPlace(location) : null,
      place: placeFor(location, p.latitude, p.longitude),
      industries: page.industries ?? [],
    };
    return [card];
  });

  cards.sort(
    (a, b) =>
      Number(!a.avatarUrl) - Number(!b.avatarUrl) ||
      Number(!a.line) - Number(!b.line) ||
      a.name.localeCompare(b.name),
  );
  return applyDirectoryOrder(cards);
}
