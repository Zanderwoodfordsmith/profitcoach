import { personNameWithoutNote } from "@/lib/prospectDisplayFormat";
import { splitFullName } from "@/lib/splitFullName";

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function isEmailish(value: string): boolean {
  return value.includes("@");
}

/**
 * First/last fields for the profile name editor.
 * An email used as the display name stays out of the first-name box.
 */
export function personIdentityNameDraft(input: {
  fullName?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): { firstName: string; lastName: string } {
  const storedFirst = personNameWithoutNote(clean(input.firstName));
  const storedLast = personNameWithoutNote(clean(input.lastName));
  if ((storedFirst || storedLast) && !isEmailish(storedFirst) && !isEmailish(storedLast)) {
    return { firstName: storedFirst, lastName: storedLast };
  }

  const full = personNameWithoutNote(clean(input.fullName));
  const email = clean(input.email).toLowerCase();
  if (!full || isEmailish(full) || (email && full.toLowerCase() === email)) {
    return { firstName: "", lastName: "" };
  }

  const split = splitFullName(full);
  return {
    firstName: split.first_name ?? "",
    lastName: split.last_name ?? "",
  };
}
