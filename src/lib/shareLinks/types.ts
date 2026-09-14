export const CUSTOM_LINK_TITLE_MAX = 80;
export const CUSTOM_LINK_DESCRIPTION_MAX = 280;
export const CUSTOM_LINKS_MAX = 50;

export type CoachCustomLink = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  sort_order: number;
};

export type ShareHubCalendar = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  meeting_duration_minutes: number;
  is_enabled: boolean;
  is_public: boolean;
};

export type ShareHubPayload = {
  coach_slug: string | null;
  linkedin_url: string | null;
  social_links: Record<string, string>;
  custom_links: CoachCustomLink[];
  calendars: ShareHubCalendar[];
};
