/* global globalThis */
/** Shared config for popup, side panel, and background. */
globalThis.PC_LINKEDIN_EXT = {
  /** Shown in UI — Live first. */
  APP_CHOICES: [
    {
      id: "live",
      label: "Live site",
      origin: "https://www.businesscoachacademy.com",
    },
    {
      id: "local",
      label: "Local dev",
      origin: "http://localhost:3002",
    },
  ],
  /** All origins we may find a signed-in tab on (auth lookup). */
  APP_ORIGINS: [
    "https://www.businesscoachacademy.com",
    "https://businesscoachacademy.com",
    "https://app.businesscoachacademy.com",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
  ],
  DEFAULT_ORIGIN: "https://www.businesscoachacademy.com",
  SESSION_PATH: "/api/sales-nav-session",
  ACCESS_PATH: "/api/coach/extension/access",
  SAVE_PATH: "/api/coach/extension/save-profile",
  DRAFT_PATH: "/api/coach/extension/draft-note",
  FIT_PATH: "/api/coach/extension/icp-fit",
  ENGAGE_PATH: "/api/coach/extension/draft-engage",
  MEMBERSHIP_PATH: "/coach/membership",
};
