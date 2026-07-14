export type CoachFilterOption = {
  id: string;
  label: string;
};

type ProspectCoachFields = {
  coach_id?: string | null;
  coach_name?: string | null;
  coach_business_name?: string | null;
};

type CoachListRow = {
  id: string;
  full_name?: string | null;
  coach_business_name?: string | null;
};

/**
 * Merge coach options from prospect rows with the coaches API list.
 * Prefer labels from prospect rows when both exist.
 */
export function mergeCoachFilterOptions(
  prospects: ProspectCoachFields[],
  coaches: CoachListRow[]
): CoachFilterOption[] {
  const fromProspects = Array.from(
    new Map(
      prospects.map((p) => [
        p.coach_id,
        {
          id: p.coach_id!,
          label:
            p.coach_name ??
            p.coach_business_name ??
            `Coach ${(p.coach_id ?? "").slice(0, 6)}`,
        },
      ])
    ).values()
  ).filter((c) => c.id);

  const fromList = coaches.map((c) => ({
    id: c.id,
    label: c.full_name ?? c.coach_business_name ?? `Coach ${c.id.slice(0, 8)}`,
  }));

  if (fromProspects.length === 0) return fromList;

  return Array.from(
    new Map([...fromProspects, ...fromList].map((c) => [c.id, c])).values()
  );
}
