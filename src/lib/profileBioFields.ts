export type ProfileBioFields = {
  bio?: string | null;
  community_bio?: string | null;
  directory_summary?: string | null;
  directory_bio?: string | null;
};

function trimmedOrNull(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/** Bio shown in the internal community (roster, hover cards, map). */
export function resolveCommunityBio(fields: ProfileBioFields): string | null {
  return trimmedOrNull(fields.community_bio) ?? trimmedOrNull(fields.bio);
}

/** Short copy for public directory and attendees listing cards. */
export function resolveDirectorySummary(fields: ProfileBioFields): string | null {
  return trimmedOrNull(fields.directory_summary) ?? trimmedOrNull(fields.bio);
}

/** Long copy for the public directory profile page. */
export function resolveDirectoryBio(fields: ProfileBioFields): string | null {
  return (
    trimmedOrNull(fields.directory_bio) ??
    trimmedOrNull(fields.directory_summary) ??
    trimmedOrNull(fields.bio)
  );
}
