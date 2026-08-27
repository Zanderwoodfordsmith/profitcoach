#!/usr/bin/env node
/**
 * Patches content/academy/classroom-hub.json for consolidated lessons.
 * Run after generate-academy-consolidation-migration.mjs
 */
import fs from "node:fs";
import path from "node:path";

const hubPath = path.join(process.cwd(), "content/academy/classroom-hub.json");
const hub = JSON.parse(fs.readFileSync(hubPath, "utf8"));
const getClients = hub.courses.find((c) => c.id === "get-clients");
const coachClients = hub.courses.find((c) => c.id === "coach-clients");
if (!getClients) throw new Error("get-clients course not found");
if (!coachClients) throw new Error("coach-clients course not found");

const academyUrlGetCalls =
  "https://academy.businesscoachacademy.com/p/getting-clients/curriculum";
const academyUrlWinClients = academyUrlGetCalls;
const academyUrlCoachOnboard =
  "https://academy.businesscoachacademy.com/p/coaching-sessions-2p7iq/curriculum/overview";
const academyUrlCert =
  "https://academy.businesscoachacademy.com/p/profit-coach-certification/curriculum/overview";

/** @param {string} id @param {string} title @param {string} duration @param {boolean} hasVideo @param {string} url @param {object} [extra] */
function lesson(id, title, duration, hasVideo, url, extra = {}) {
  return { id, title, duration, hasVideo, academyUrl: url, ...extra };
}

function findSection(course, sectionId) {
  const s = course.sections.find((x) => x.id === sectionId);
  if (!s) throw new Error(`Section ${sectionId} not found`);
  return s;
}

function findNestedSection(course, topId, nestedId) {
  const top = findSection(course, topId);
  const nested = top.sections?.find((x) => x.id === nestedId);
  if (!nested) throw new Error(`Nested ${nestedId} not found`);
  return nested;
}

// --- Get Calls / Lead Engine ---
findNestedSection(getClients, "get-calls-step-4-top-100-conversations", "get-calls-lead-engine-foundations").lessons = [
  lesson(
    "get-calls-lead-generation-lead-gen-foundations",
    "Lead Gen Foundations",
    "",
    false,
    academyUrlGetCalls,
  ),
];

findNestedSection(getClients, "get-calls-step-4-top-100-conversations", "get-calls-lead-engine-vip-conversations").lessons = [
  lesson(
    "get-calls-lead-generation-run-your-vip-nurture",
    "Run Your VIP Nurture",
    "",
    false,
    academyUrlGetCalls,
  ),
  lesson(
    "get-calls-replying-to-leads-mistakse-to-avoid-when-replying-to-prospects",
    "Mistakes To Avoid When Replying To Prospects",
    "12m",
    true,
    academyUrlGetCalls,
  ),
];

findNestedSection(getClients, "get-calls-step-4-top-100-conversations", "get-calls-connector-ai").lessons = [
  lesson(
    "get-calls-lead-generation-get-started-with-connector",
    "Get Started With Connector",
    "",
    false,
    academyUrlGetCalls,
  ),
  lesson(
    "get-calls-lead-generation-launch-your-connector-campaign",
    "Launch Your Connector Campaign",
    "6m",
    true,
    academyUrlGetCalls,
  ),
  lesson(
    "get-calls-replying-to-leads-set-up-connector-co-pilot",
    "Set Up Connector Co-Pilot",
    "",
    false,
    academyUrlGetCalls,
  ),
];

// --- Win Clients ---
findSection(getClients, "win-clients-offer-sales-foundations").lessons = [
  lesson(
    "win-clients-design-your-coaching-offer",
    "Design Your Coaching Offer",
    "50m",
    true,
    "https://academy.businesscoachacademy.com/p/procoach-playbook/dashboard",
  ),
];

findNestedSection(getClients, "win-clients-value-sessions", "win-clients-step-6-sales-calls").lessons = [
  lesson(
    "win-clients-deliver-your-sales-pitch",
    "Deliver Your Sales Pitch",
    "63m",
    true,
    academyUrlWinClients,
  ),
  lesson(
    "win-clients-post-pitch-price-and-close",
    "Post-Pitch, Price & Close",
    "119m",
    true,
    academyUrlWinClients,
  ),
];

// --- Coach Clients onboarding ---
findSection(coachClients, "coach-clients-onboarding").lessons = [
  lesson(
    "coach-clients-client-onboarding-how-to-setup-a-new-client",
    "How To Setup A New Client",
    "2m",
    true,
    academyUrlCoachOnboard,
  ),
  lesson(
    "coach-clients-client-onboarding-session-1-profit-systems-dashboard",
    "Session 1: Profit Systems & Dashboard",
    "32m",
    true,
    academyUrlCoachOnboard,
  ),
  lesson(
    "coach-clients-client-onboarding-session-2-leverage-critical-issues",
    "Session 2: Leverage & Critical Issues",
    "18m",
    true,
    academyUrlCoachOnboard,
  ),
  lesson(
    "coach-clients-client-onboarding-session-3-align-3-year-plan",
    "Session 3: Align 3-Year Plan",
    "23m",
    true,
    academyUrlCoachOnboard,
    {
      satellites: [
        lesson(
          "coach-clients-other-coachin-session-content-session-3-align-the-3-year-plan",
          "Session 3: Align The 3 Year Plan",
          "72m",
          true,
          academyUrlCoachOnboard,
          { description: "Optional — extended walkthrough of the 3-year plan session." },
        ),
      ],
    },
  ),
  lesson(
    "coach-clients-client-onboarding-session-4-ninety-day-plan",
    "Session 4: Ninety Day Plan",
    "24m",
    true,
    academyUrlCoachOnboard,
  ),
  lesson(
    "coach-clients-coachiing-session-structure-how-to-use-the-coaching-sheet-in-sessions",
    "How To Use The Coaching Sheet In Sessions",
    "9m",
    true,
    academyUrlCoachOnboard,
  ),
  lesson(
    "coach-clients-coaching-session-faqs",
    "Coaching Session FAQs",
    "",
    false,
    academyUrlCoachOnboard,
    {
      satellites: [
        lesson(
          "coach-clients-coaching-session-faqs-coaching-faq-should-i-stick-to-the-coaching-sessions-exactly-in-the-orde",
          "Coaching FAQ: Should I stick to the coaching sessions exactly in the order?",
          "1m",
          true,
          academyUrlCoachOnboard,
        ),
        lesson(
          "coach-clients-coaching-session-faqs-coaching-faq-how-to-handle-clients-in-crisis",
          "Coaching FAQ: How to handle clients in crisis?",
          "1m",
          true,
          academyUrlCoachOnboard,
        ),
        lesson(
          "coach-clients-coaching-session-faqs-coaching-faq-how-to-handle-a-client-with-a-new-priority-that-is-off-plan",
          "Coaching FAQ: How to handle a client with a new priority that is off plan?",
          "1m",
          true,
          academyUrlCoachOnboard,
        ),
        lesson(
          "coach-clients-coaching-session-faqs-coaching-faq-how-do-you-run-a-typical-coaching-session-james-baker",
          "Coaching FAQ: How do you run a typical coaching session? (James Baker)",
          "1m",
          true,
          academyUrlCoachOnboard,
        ),
        lesson(
          "coach-clients-coaching-session-faqs-coaching-faq-how-to-handle-clients-who-don-t-want-to-grow-the-business",
          "Coaching FAQ: How to handle clients who don't want to grow the business?",
          "2m",
          true,
          academyUrlCoachOnboard,
        ),
        lesson(
          "coach-clients-coaching-session-faqs-coaching-faq-how-to-handle-clients-giving-false-or-uncertain-answers",
          "Coaching FAQ: How to handle clients giving \"false\" or \"uncertain\" answers?",
          "1m",
          true,
          academyUrlCoachOnboard,
        ),
        lesson(
          "coach-clients-coaching-session-faqs-coaching-faq-how-do-you-end-a-coaching-session-ashley-maile",
          "Coaching FAQ: How do you end a coaching session? (Ashley Maile)",
          "1m",
          true,
          academyUrlCoachOnboard,
        ),
        lesson(
          "coach-clients-coaching-session-faqs-coaching-faq-how-do-you-handle-clients-who-don-t-do-cashflow-or-other-to",
          "Coaching FAQ: How do you handle clients who don't do cashflow or other tools?",
          "1m",
          true,
          academyUrlCoachOnboard,
        ),
        lesson(
          "coach-clients-coaching-session-faqs-coaching-faq-how-to-handle-a-client-with-low-energy-and-commitment",
          "Coaching FAQ: How to handle a client with low energy and commitment",
          "1m",
          true,
          academyUrlCoachOnboard,
        ),
      ],
    },
  ),
  lesson(
    "coach-clients-start-and-end-a-coaching-session",
    "Start & End a Coaching Session",
    "",
    false,
    academyUrlCoachOnboard,
  ),
  lesson(
    "profit-coach-os-crm-setup-usage-track-prospects-clients-sessions",
    "How to Track Prospects, Clients & Sessions",
    "",
    false,
    "https://academy.businesscoachacademy.com/",
    { draft: true },
  ),
];

// --- Certification (flatten single-lesson subcategories into the section) ---
findSection(coachClients, "coach-certification").lessons = [
  lesson(
    "coach-clients-certification-welcome-to-profit-coach-certification",
    "Welcome",
    "",
    false,
    academyUrlCert,
  ),
  lesson(
    "coach-clients-certification-week-1-coach-foundations",
    "COACH Foundations",
    "108m",
    true,
    academyUrlCert,
  ),
  lesson(
    "coach-clients-certification-week-2-powerful-questions",
    "Powerful Questions",
    "72m",
    true,
    academyUrlCert,
  ),
  lesson(
    "coach-clients-certification-week-3-lasting-transformation",
    "Lasting Transformation",
    "130m",
    true,
    academyUrlCert,
  ),
  lesson(
    "coach-clients-certification-week-4-world-class-coach",
    "World-Class Coach",
    "114m",
    true,
    academyUrlCert,
  ),
];
delete findSection(coachClients, "coach-certification").sections;

fs.writeFileSync(hubPath, JSON.stringify(hub, null, 2) + "\n");
console.log("Updated classroom-hub.json");
