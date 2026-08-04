/** Shared LinkedIn profile snapshot shape (safe for client + server). */

export type LinkedInExperience = {
  title: string | null;
  company: string | null;
  industry: string | null;
  location: string | null;
  start: string | null;
  end: string | null;
  duration: string | null;
  description: string | null;
  employmentType: string | null;
  workplaceType: string | null;
  /** Apify groups multi-role company tenure under one id when present. */
  experienceGroupId: string | null;
  skills: string[];
};

export type LinkedInEducation = {
  school: string | null;
  degree: string | null;
  field: string | null;
  start: string | null;
  end: string | null;
};

export type LinkedInFeaturedItem = {
  title: string | null;
  subtitle: string | null;
  url: string | null;
  imageUrl: string | null;
};

export type LinkedInProfileSnapshot = {
  linkedinUrl: string | null;
  publicIdentifier: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  headline: string | null;
  about: string | null;
  photoUrl: string | null;
  bannerUrl: string | null;
  location: string | null;
  connectionsCount: number | null;
  followerCount: number | null;
  experiences: LinkedInExperience[];
  education: LinkedInEducation[];
  skills: string[];
  featured: LinkedInFeaturedItem[];
};
