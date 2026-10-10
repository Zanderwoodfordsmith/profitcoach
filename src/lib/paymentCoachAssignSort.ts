export type PaymentCoachAssignSort = "az" | "joined";

export type PaymentCoachAssignCoach = {
  id: string;
  full_name: string | null;
  slug: string;
  joined_at: string | null;
};

export function paymentCoachJoinedAtTime(value: string | null): number | null {
  if (!value) return null;
  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

export function paymentCoachAssignName(
  coach: Pick<PaymentCoachAssignCoach, "full_name" | "slug">,
  formatName: (value: string | null) => string
): string {
  return formatName(coach.full_name) || coach.slug;
}

export function sortPaymentCoachesForAssign<T extends PaymentCoachAssignCoach>(
  coaches: readonly T[],
  sort: PaymentCoachAssignSort,
  formatName: (value: string | null) => string
): T[] {
  const byName = (a: T, b: T) =>
    paymentCoachAssignName(a, formatName).localeCompare(
      paymentCoachAssignName(b, formatName),
      undefined,
      { sensitivity: "base" }
    );

  return [...coaches].sort((a, b) => {
    if (sort === "az") return byName(a, b);

    const aTime = paymentCoachJoinedAtTime(a.joined_at);
    const bTime = paymentCoachJoinedAtTime(b.joined_at);
    if (aTime == null && bTime == null) return byName(a, b);
    if (aTime == null) return 1;
    if (bTime == null) return -1;
    if (aTime !== bTime) return bTime - aTime;
    return byName(a, b);
  });
}
