export type LeadTeaser = {
  id: string;
  fullName: string | null;
  jobTitle: string | null;
  company: string | null;
  /** Public company site — safe to show without reveal. */
  companyWebsite: string | null;
  location: string | null;
  state: string | null;
  industry: string | null;
  category: string | null;
  teamSize: string | null;
  revenueRange: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
  hasLinkedIn: boolean;
  /** Partial preview so coaches know what’s available without full reveal. */
  emailHint: string | null;
  phoneHint: string | null;
};

export type LeadReveal = LeadTeaser & {
  email: string | null;
  email2: string | null;
  phone: string | null;
  phone2: string | null;
  linkedinUrl: string | null;
  firstName: string | null;
  lastName: string | null;
};
