// One list of every graphic, used by the build script (Drive masters) and the coach Toolkit.
// Sections match the Drive folders. Personal graphics carry the coach's own QR and link.
import { svgDoc } from "./brand.js";
import { compass, EXAMPLE_SCORES } from "./compass.js";
import { colourScaleFile, scorecardSheet, banner } from "./scorecard.js";
import { bossWheel, bossWheelBanded, EXAMPLE_AREA_SCORES } from "./wheel.js";
import { playbookMap, playbookGridPoster } from "./playbooks.js";
import { oldNewLandscape, oldNewPortrait } from "./oldnew.js";
import { nineStepBanner, nineStepPost, eventRoadmapBanner } from "./roadmap.js";
import {
  socialSquare, socialGuess, socialLevels, story,
  linkedinBanner, linkedinBannerScore, linkedinBannerDark, linkedinBannerLevels,
  zoomBackground, emailSignature,
} from "./coach.js";

const square = (g, title) => svgDoc({ w: g.w, h: g.h, viewBox: g.viewBox, title, body: g.body });

/**
 * size: shown to people. png: PNG width in px. print: true when the graphic has a physical size (mm).
 * personalTwin: a coach version exists in PERSONAL, so the Toolkit shows that one instead.
 * render(ctx): ctx = { coach, eventName } for personal graphics; generic ones ignore it.
 */
export const GENERIC = [
  { id: "compass-classic", section: "1. Scorecard", title: "BOSS Compass - classic", size: "Square", png: 2400, render: () => square(compass({ style: "classic", idp: "cc" }), "BOSS Compass (classic, blank)") },
  { id: "compass-classic-filled", section: "1. Scorecard", title: "BOSS Compass - classic filled", size: "Square", png: 2400, render: () => square(compass({ style: "classic", scores: EXAMPLE_SCORES, idp: "cf" }), "BOSS Compass (classic, example scores)") },
  { id: "compass-rings", section: "1. Scorecard", title: "BOSS Compass - score rings", size: "Square", png: 2400, render: () => square(compass({ style: "rings", idp: "cr" }), "BOSS Compass (score rings, blank)") },
  { id: "compass-rings-filled", section: "1. Scorecard", title: "BOSS Compass - score rings filled", size: "Square", png: 2400, render: () => square(compass({ style: "rings", scores: EXAMPLE_SCORES, idp: "ce" }), "BOSS Compass (score rings, example scores)") },
  { id: "scorecard-a4", personalTwin: true, section: "1. Scorecard", title: "BOSS Scorecard - A4", size: "A4", png: 2480, print: true, render: () => scorecardSheet() },
  { id: "colour-scale", section: "1. Scorecard", title: "Colour scale", size: "1800 × 300", png: 1800, render: () => colourScaleFile() },
  { id: "wheel-blank", section: "2. BOSS Wheel", title: "BOSS Wheel - blank", size: "Square", png: 2400, render: () => square(bossWheel({ idp: "wb" }), "BOSS Wheel (blank, score 1 to 10)") },
  { id: "wheel-filled", section: "2. BOSS Wheel", title: "BOSS Wheel - filled", size: "Square", png: 2400, render: () => square(bossWheel({ scores: EXAMPLE_AREA_SCORES, idp: "wf" }), "BOSS Wheel (example scores)") },
  { id: "wheel-banded-blank", section: "2. BOSS Wheel", title: "BOSS Wheel banded - blank", size: "Square", png: 2400, render: () => square(bossWheelBanded({ idp: "wbb" }), "BOSS Wheel, banded (blank)") },
  { id: "wheel-banded-filled", section: "2. BOSS Wheel", title: "BOSS Wheel banded - filled", size: "Square", png: 2400, render: () => square(bossWheelBanded({ scores: EXAMPLE_AREA_SCORES, idp: "wbf" }), "BOSS Wheel, banded (example scores)") },
  { id: "playbook-map", section: "3. Playbooks", title: "Playbook map", size: "Square", png: 2400, render: () => square(playbookMap(), "50 playbooks map") },
  { id: "playbook-map-banded", section: "3. Playbooks", title: "Playbook map - banded", size: "Square", png: 2400, render: () => square(playbookMap({ idp: "pmb", style: "banded" }), "50 playbooks map, banded") },
  { id: "playbook-grid", section: "3. Playbooks", title: "Playbook grid - A3 poster", size: "A3 landscape", png: 4961, print: true, render: () => playbookGridPoster() },
  { id: "old-new-landscape", section: "4. Social media posts", title: "Old vs new - landscape", size: "1920 × 1080", png: 1920, render: () => oldNewLandscape() },
  { id: "old-new-portrait", personalTwin: true, section: "4. Social media posts", title: "Old vs new - portrait", size: "1080 × 1350", png: 2160, render: () => oldNewPortrait() },
  { id: "nine-steps-post", personalTwin: true, section: "4. Social media posts", title: "Profit System 9 steps - post", size: "1080 × 1350", png: 2160, render: () => nineStepPost() },
  { id: "banner-boss-score", personalTwin: true, section: "5. Banners", title: "Pull-up banner - What's your BOSS Score", size: "850 × 2000 mm", png: 2400, print: true, render: () => banner() },
  { id: "banner-nine-steps", personalTwin: true, section: "5. Banners", title: "Pull-up banner - Profit System 9 steps", size: "850 × 2000 mm", png: 2400, print: true, render: () => nineStepBanner() },
  { id: "banner-event", personalTwin: true, section: "5. Banners", title: "Pull-up banner - Event roadmap", size: "850 × 2000 mm", png: 2400, print: true, render: () => eventRoadmapBanner() },
];

/** Groups for the coach's own set, in the order the Toolkit shows them. */
export const PERSONAL_GROUPS = ["Social media posts", "LinkedIn, email and calls", "Print"];

export const PERSONAL = [
  { id: "p-guess", group: "Social media posts", title: "Post - What would your business score", size: "1080 × 1080", png: 2160, render: ({ coach }) => socialGuess(coach, { idp: "tsg" }) },
  { id: "p-levels", group: "Social media posts", title: "Post - Which level", size: "1080 × 1350", png: 2160, render: ({ coach }) => socialLevels(coach, { idp: "tsl" }) },
  { id: "p-old-new", group: "Social media posts", title: "Post - Old vs new", size: "1080 × 1350", png: 2160, render: ({ coach }) => oldNewPortrait({ idp: "ton", coach }) },
  { id: "p-boss-score", group: "Social media posts", title: "Post - What's your BOSS Score", size: "1080 × 1080", png: 2160, render: ({ coach }) => socialSquare(coach, { idp: "tsq" }) },
  { id: "p-nine-steps", group: "Social media posts", title: "Post - Profit System 9 steps", size: "1080 × 1350", png: 2160, render: ({ coach }) => nineStepPost({ idp: "tnp", coach }) },
  { id: "p-story", group: "Social media posts", title: "Story", size: "1080 × 1920", png: 1080, render: ({ coach }) => story(coach, { idp: "tst" }) },
  { id: "p-li-score", group: "LinkedIn, email and calls", title: "LinkedIn banner - score", size: "1584 × 396", png: 1584, render: ({ coach }) => linkedinBannerScore(coach, { idp: "tli2" }) },
  { id: "p-li-dark", group: "LinkedIn, email and calls", title: "LinkedIn banner - dark", size: "1584 × 396", png: 1584, render: ({ coach }) => linkedinBannerDark(coach, { idp: "tli3" }) },
  { id: "p-li-levels", group: "LinkedIn, email and calls", title: "LinkedIn banner - levels", size: "1584 × 396", png: 1584, render: ({ coach }) => linkedinBannerLevels(coach, { idp: "tli4" }) },
  { id: "p-li-compass", group: "LinkedIn, email and calls", title: "LinkedIn banner - compass", size: "1584 × 396", png: 1584, render: ({ coach }) => linkedinBanner(coach, { idp: "tli" }) },
  { id: "p-zoom", group: "LinkedIn, email and calls", title: "Zoom background", size: "1920 × 1080", png: 1920, render: ({ coach }) => zoomBackground(coach, { idp: "tzb" }) },
  { id: "p-email", group: "LinkedIn, email and calls", title: "Email signature", size: "600 × 150", png: 1200, render: ({ coach }) => emailSignature(coach, { idp: "tes" }) },
  { id: "p-scorecard-a4", group: "Print", title: "BOSS Scorecard - A4", size: "A4", png: 2480, print: true, render: ({ coach }) => scorecardSheet({ idp: "tsc", coach }) },
  { id: "p-banner-boss-score", group: "Print", title: "Pull-up banner - What's your BOSS Score", size: "850 × 2000 mm", png: 2400, print: true, render: ({ coach }) => banner({ idp: "tbn", coach }) },
  { id: "p-banner-nine-steps", group: "Print", title: "Pull-up banner - Profit System 9 steps", size: "850 × 2000 mm", png: 2400, print: true, render: ({ coach }) => nineStepBanner({ idp: "tns", coach }) },
  { id: "p-banner-event", group: "Print", title: "Pull-up banner - Event roadmap", size: "850 × 2000 mm", png: 2400, print: true, render: ({ coach, eventName }) => eventRoadmapBanner({ idp: "ter", coach, eventName: eventName || "Profit Workshop" }) },
];

/** Placeholder coach so every personal graphic still renders before a public link is set. */
export const PLACEHOLDER_COACH = {
  name: "Your name",
  business: "Your business",
  displayUrl: "theprofitcoach.com/score/your-link",
  qr: null,
  avatarDataUri: null,
};
