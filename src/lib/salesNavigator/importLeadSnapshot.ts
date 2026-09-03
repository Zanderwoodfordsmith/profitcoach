import type { SalesNavImportedLead } from "@/lib/apify/salesNavigatorTypes";

/** Compact row stored on sales_nav_import_runs.lead_snapshot for History UI. */
export type SalesNavImportLeadSnapshot = {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  company: string | null;
  linkedinUrl: string | null;
  location: string | null;
  headline: string | null;
  about: string | null;
  photoUrl: string | null;
  tenureLabel: string | null;
  monthsAtCompany: number | null;
  yearsAtCompanyBucket: string | null;
  premium: boolean;
};

export function toSalesNavImportLeadSnapshot(
  lead: SalesNavImportedLead
): SalesNavImportLeadSnapshot {
  return {
    fullName: lead.fullName,
    firstName: lead.firstName,
    lastName: lead.lastName,
    jobTitle: lead.jobTitle,
    company: lead.company,
    linkedinUrl: lead.linkedinUrl,
    location: lead.location,
    headline: lead.headline,
    about: lead.about,
    photoUrl: lead.photoUrl,
    tenureLabel: lead.tenureLabel,
    monthsAtCompany: lead.monthsAtCompany ?? null,
    yearsAtCompanyBucket: lead.yearsAtCompanyBucket ?? null,
    premium: lead.premium,
  };
}

export function snapshotToSalesNavImportedLead(
  snap: SalesNavImportLeadSnapshot
): SalesNavImportedLead {
  return {
    fullName: snap.fullName,
    firstName: snap.firstName,
    lastName: snap.lastName,
    jobTitle: snap.jobTitle,
    company: snap.company,
    linkedinUrl: snap.linkedinUrl,
    location: snap.location,
    email: null,
    headline: snap.headline,
    about: snap.about ?? snap.headline,
    photoUrl: snap.photoUrl,
    tenureLabel: snap.tenureLabel,
    monthsAtCompany: snap.monthsAtCompany,
    monthsInRole: null,
    yearsAtCompanyBucket:
      (snap.yearsAtCompanyBucket as SalesNavImportedLead["yearsAtCompanyBucket"]) ??
      null,
    premium: Boolean(snap.premium),
    raw: {},
  };
}
