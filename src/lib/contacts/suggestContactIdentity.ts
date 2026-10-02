import { businessNameFromEmail } from "@/lib/contacts/businessNameFromEmail";
import { personIdentityNameDraft } from "@/lib/contacts/personIdentityDraft";
import { looksLikePersonName } from "@/lib/messaging/conversationDisplay";

export type ContactIdentitySuggestion = {
  firstName: string;
  lastName: string;
  /** Clean person name when we can do better than the raw label or email. */
  displayName: string | null;
  /** Stored business, or a domain guess when nothing is stored. */
  shownBusiness: string | null;
  persistName: boolean;
  persistBusiness: boolean;
};

export function suggestContactIdentity(input: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  businessName?: string | null;
}): ContactIdentitySuggestion {
  const draft = personIdentityNameDraft(input);
  const joined = [draft.firstName, draft.lastName].filter(Boolean).join(" ").trim();
  const displayName =
    joined && looksLikePersonName(joined) ? joined : null;

  const storedFull = (input.fullName ?? "").trim();
  const storedBusiness = (input.businessName ?? "").trim();
  const derivedBusiness = businessNameFromEmail(input.email);

  const fullIsWeak =
    !storedFull ||
    storedFull.includes("@") ||
    storedFull.includes("(") ||
    !looksLikePersonName(storedFull);

  const persistName = Boolean(
    displayName &&
      fullIsWeak &&
      storedFull.toLowerCase() !== displayName.toLowerCase()
  );

  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    displayName,
    shownBusiness: storedBusiness || derivedBusiness,
    persistName,
    persistBusiness: !storedBusiness && Boolean(derivedBusiness),
  };
}
