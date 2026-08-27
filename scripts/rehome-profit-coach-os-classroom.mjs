/**
 * One-off: move Profit Coach OS classroom lessons into Get Calls / Win Clients /
 * Coach Clients; replace OS hub card with a migration notice lesson.
 */
import fs from "node:fs";

const path = "content/academy/classroom-hub.json";
const data = JSON.parse(fs.readFileSync(path, "utf8"));

const getClients = data.courses.find((c) => c.id === "get-clients");
const osCourse = data.courses.find((c) => c.id === "profit-coach-os");
if (!getClients || !osCourse) throw new Error("missing courses");

function findSection(course, sectionId) {
  for (const section of course.sections) {
    if (section.id === sectionId) return section;
  }
  return null;
}

function cloneLesson(lesson) {
  return JSON.parse(JSON.stringify(lesson));
}

function extractLessons(os, ...lessonIds) {
  const out = [];
  const walk = (sections) => {
    for (const s of sections ?? []) {
      for (const l of s.lessons ?? []) {
        if (lessonIds.includes(l.id)) out.push(cloneLesson(l));
      }
      walk(s.sections);
    }
  };
  walk(os.sections);
  const missing = lessonIds.filter((id) => !out.some((l) => l.id === id));
  if (missing.length) throw new Error("missing lessons: " + missing.join(", "));
  return out;
}

function extractSectionTree(os, sectionId, newSectionId, newTitle) {
  const walk = (sections) => {
    for (const s of sections ?? []) {
      if (s.id === sectionId) {
        const cloned = JSON.parse(JSON.stringify(s));
        cloned.id = newSectionId;
        if (newTitle) cloned.title = newTitle;
        return cloned;
      }
      const nested = walk(s.sections);
      if (nested) return nested;
    }
    return null;
  };
  const section = walk(os.sections);
  if (!section) throw new Error("missing section " + sectionId);
  return section;
}

const leadEngine = findSection(
  getClients,
  "get-calls-step-4-top-100-conversations",
);
if (!leadEngine) throw new Error("missing lead engine section");

const bossScore = extractLessons(
  osCourse,
  "get-calls-boss-assessment-marketing-how-to-use-the-boss-score-assessment",
)[0];
if (!leadEngine.sections) leadEngine.sections = [];
let leadMagnets = leadEngine.sections.find(
  (s) => s.id === "get-calls-lead-engine-lead-magnets",
);
if (!leadMagnets) {
  leadMagnets = {
    id: "get-calls-lead-engine-lead-magnets",
    title: "Lead Magnets",
    lessons: [],
  };
  const foundationsIdx = leadEngine.sections.findIndex(
    (s) => s.id === "get-calls-lead-engine-foundations",
  );
  if (foundationsIdx >= 0) {
    leadEngine.sections.splice(foundationsIdx + 1, 0, leadMagnets);
  } else {
    leadEngine.sections.unshift(leadMagnets);
  }
}
if (!leadMagnets.lessons.some((l) => l.id === bossScore.id)) {
  leadMagnets.lessons.push(bossScore);
}

const connectorLessons = [
  ...extractSectionTree(
    osCourse,
    "profit-coach-os-connector-ai-set-up",
    "get-calls-connector-ai-set-up",
    "Set Up Connector AI",
  ).lessons,
  ...extractSectionTree(
    osCourse,
    "profit-coach-os-connector-ai-build-launch",
    "get-calls-connector-ai-build-launch",
    "Build & Launch Campaigns",
  ).lessons,
  ...extractSectionTree(
    osCourse,
    "profit-coach-os-connector-ai-reply-manage",
    "get-calls-connector-ai-reply-manage",
    "Reply & Manage Leads",
  ).lessons,
];
const connectorSection = {
  id: "get-calls-connector-ai",
  title: "Connector AI",
  lessons: connectorLessons,
};
if (!leadEngine.sections) leadEngine.sections = [];
const connectorIdx = leadEngine.sections.findIndex(
  (s) => s.id === "get-calls-connector-ai",
);
if (connectorIdx >= 0) leadEngine.sections[connectorIdx] = connectorSection;
else leadEngine.sections.push(connectorSection);

// Remove retired sibling Campaigns parent if present
getClients.sections = getClients.sections.filter(
  (s) => s.id !== "get-calls-step-3-campaigns-and-automation",
);
getClients.sections = getClients.sections.filter(
  (s) => s.id !== "get-calls-overview",
);

const bossLessons = extractLessons(
  osCourse,
  "profit-coach-os-boss-suite-boss-boss-pro-overview",
  "profit-coach-os-boss-suite-use-boss-pro-in-value-sessions",
  "profit-coach-os-boss-suite-templates-resources",
);
const crmLessons = extractLessons(
  osCourse,
  "profit-coach-os-crm-setup-usage-crm-overview",
  "profit-coach-os-crm-setup-usage-set-up-pipeline-stages",
  "profit-coach-os-crm-setup-usage-crm-automations",
);
const trackClientsLesson = extractLessons(
  osCourse,
  "profit-coach-os-crm-setup-usage-track-prospects-clients-sessions",
)[0];

const bossAndTools = {
  id: "win-clients-boss-and-tools",
  title: "BOSS Pro, CRM & Pipeline Tools",
  lessons: [],
  sections: [
    {
      id: "win-clients-boss-suite",
      title: "BOSS Suite",
      lessons: bossLessons,
    },
    {
      id: "win-clients-crm-setup-usage",
      title: "CRM Setup & Pipeline",
      lessons: crmLessons,
    },
  ],
};

const bossToolsIdx = getClients.sections.findIndex(
  (s) => s.id === "win-clients-boss-and-tools",
);
if (bossToolsIdx >= 0) getClients.sections[bossToolsIdx] = bossAndTools;
else {
  const closingIdx = getClients.sections.findIndex(
    (s) => s.id === "win-clients-client-closing-objections",
  );
  getClients.sections.splice(closingIdx, 0, bossAndTools);
}

const coachClients = data.courses.find((c) => c.id === "coach-clients");
const onboarding = findSection(coachClients, "coach-clients-onboarding");
if (!onboarding.lessons.some((l) => l.id === trackClientsLesson.id)) {
  onboarding.lessons.push(trackClientsLesson);
}

const brandLesson = extractLessons(
  osCourse,
  "profit-coach-os-brand-directory-membership-use-the-profit-coach-brand",
)[0];
const startHere = data.courses.find((c) => c.id === "start-here");
const toolsLesson = startHere?.sections?.[0]?.lessons?.find(
  (l) => l.id === "start-here-welcome-tools-bonuses",
);
if (toolsLesson && brandLesson?.notice) {
  const brandNote =
    "\n\n### Profit Coach brand assets\n\n" +
    brandLesson.notice +
    "\n\n[Open brand folder](https://drive.google.com/drive/folders/1KLdyLFgxnS_o3wDwBhYGFlZdQOBivipY?usp=sharing)\n\n" +
    "Directory listing: **Settings → Directory**. OS membership: **Membership** page.";
  if (!toolsLesson.bodyMarkdown?.includes("Profit Coach brand assets")) {
    toolsLesson.bodyMarkdown = (toolsLesson.bodyMarkdown ?? "") + brandNote;
  }
}

const migrationLesson = {
  id: "profit-coach-os-classroom-reorganisation",
  title: "Where tools & training live now",
  duration: "",
  hasVideo: false,
  academyUrl: "",
  bodyMarkdown:
    "## We reorganised the Classroom\n\nProfit Coach OS is no longer a separate training path. Tool training now sits where you actually use it:\n\n### Get Calls\nIdeal client, list building, LinkedIn profile, campaigns and Connector AI.\n\n### Win Clients\nYour offer, value sessions, BOSS Pro, CRM and pipeline.\n\n### Coach Clients\nOnboarding, delivery, certification and client tracking.\n\n### Brand & directory\nNot a Classroom path — use **Membership** for the brand licence and **Settings → Directory** for your listing.\n\n### Do the work in Tools\nOpen **Get Clients** and **Coach Clients** in the sidebar for Prospects, Pipeline, Boss Pro, Content and client delivery.\n\nThings will keep moving as we ship more in-product tools — this layout is the new default.",
};

data.courses = data.courses.map((c) => {
  if (c.id !== "profit-coach-os") return c;
  return {
    id: "profit-coach-os",
    title: "Profit Coach OS",
    description:
      "This path was reorganised — start here if you are looking for moved lessons.",
    hideFromCatalog: true,
    sections: [
      {
        id: "profit-coach-os-moved",
        title: "Updated layout",
        lessons: [migrationLesson],
      },
    ],
  };
});

fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log("Rehome complete.");
