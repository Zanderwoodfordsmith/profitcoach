#!/usr/bin/env node
/**
 * Generates supabase/migrations/20261023170000_academy_classroom_lesson_consolidations.sql
 * Run: node scripts/generate-academy-consolidation-migration.mjs
 */

import fs from "node:fs";
import path from "node:path";

/** @typedef {{ id: string, title: string, source: string, duration?: string, optional?: boolean }} Chapter */

/** @typedef {{ courseId: string, lessonId: string, title: string, duration: string, body: string, chapters: Chapter[] }} Consolidation */

/** @param {Chapter} c */
function chapterObject(c) {
  const parts = [
    `'id', '${c.id}'`,
    `'title', '${c.title.replace(/'/g, "''")}'`,
    `'source_lesson_id', '${c.source}'`,
  ];
  if (c.duration) parts.push(`'duration', '${c.duration}'`);
  if (c.optional) parts.push(`'optional', true`);
  return `jsonb_build_object(${parts.join(", ")})`;
}

/** @param {Consolidation} row */
function insertBlock(row) {
  const chapters = row.chapters.map(chapterObject).join(",\n    ");
  const body = row.body.replace(/'/g, "''");
  return `-- ${row.title}
insert into public.academy_lesson_content (
  course_id,
  lesson_id,
  title,
  duration,
  body_markdown,
  video_chapters,
  updated_at
)
values (
  '${row.courseId}',
  '${row.lessonId}',
  '${row.title.replace(/'/g, "''")}',
  '${row.duration}',
  E'${body}',
  jsonb_build_array(
    ${chapters}
  ),
  now()
)
on conflict (course_id, lesson_id) do update set
  title = excluded.title,
  duration = excluded.duration,
  body_markdown = excluded.body_markdown,
  video_chapters = excluded.video_chapters,
  updated_at = excluded.updated_at;
`;
}

/** @type {Consolidation[]} */
const consolidations = [
  {
    courseId: "get-calls",
    lessonId: "get-calls-lead-generation-lead-gen-foundations",
    title: "Lead Gen Foundations",
    duration: "",
    body: "### What is this?\\n\\nHow lead generation works in the Profit Coach system — traffic, workflow, and why testing matters.\\n\\n### How to use this lesson\\n\\nWork through each step in the **Guide** tab in order.",
    chapters: [
      { id: "traffic", title: "Traffic: The Best Way to Get Leads", source: "get-calls-lead-generation-intro-traffic-the-best-wat-to-get-leads" },
      { id: "workflow", title: "Lead Generation Workflow", source: "get-calls-lead-generation-intro-lead-generation-workflow" },
      { id: "testing", title: "Testing Is Key To Lead Generation", source: "get-calls-lead-generation-intro-testing-is-key-to-lead-generation" },
    ],
  },
  {
    courseId: "get-calls",
    lessonId: "get-calls-lead-generation-run-your-vip-nurture",
    title: "Run Your VIP Nurture",
    duration: "",
    body: "### What is this?\\n\\nBuild and run personalised VIP nurture for your top prospects before you scale outreach.\\n\\n### How to use this lesson\\n\\nWork through each step in the **Guide** tab in order.",
    chapters: [
      { id: "overview", title: "VIP Nurture Overview", source: "get-calls-lead-generation-personalised-vip-nurture-top-100-vip-nurture-overview" },
      { id: "top-100", title: "How to Identify Your Top 100 Prospects", source: "get-calls-lead-generation-personalised-vip-nurture-top-100-how-to-identify-your-top-100-prospects" },
      { id: "messages", title: "How To Craft Personalized Insightful Messages", source: "get-calls-lead-generation-personalised-vip-nurture-top-100-how-to-craft-personalized-insightful-messages" },
      { id: "channels", title: "How To Use Multiple Channels To Engage", source: "get-calls-lead-generation-personalised-vip-nurture-top-100-how-to-use-multiple-channels-to-engage" },
    ],
  },
  {
    courseId: "get-calls",
    lessonId: "get-calls-replying-to-leads-set-up-connector-co-pilot",
    title: "Set Up Connector Co-Pilot",
    duration: "",
    body: "### What is this?\\n\\nConfigure Connector AI Co-Pilot (or Auto-Pilot) to help you reply to prospects.\\n\\n### How to use this lesson\\n\\nWork through each step in the **Guide** tab in order.",
    chapters: [
      { id: "setup", title: "How to Set Up Connector Ai Co-Pilot", source: "get-calls-replying-to-leads-how-to-set-up-connector-ai-co-pilot" },
      { id: "mode", title: "Choosing between Ai Co-Pilot & Auto-Pilot", source: "get-calls-replying-to-leads-choosing-between-ai-co-pilot-auto-pilot" },
      { id: "activate", title: "How to Activate The Ai and Test", source: "get-calls-replying-to-leads-how-to-activate-the-ai-and-test" },
    ],
  },
  {
    courseId: "get-calls",
    lessonId: "get-calls-lead-generation-get-started-with-connector",
    title: "Get Started With Connector",
    duration: "",
    body: "### What is this?\\n\\nRegister for Connector and prepare your connection and follow-up messages.\\n\\n### How to use this lesson\\n\\nWork through each step in the **Guide** tab in order.",
    chapters: [
      { id: "register", title: "What is Connector & How To Register for Connector Ai", source: "get-calls-lead-generation-ai-automation-what-is-connector-how-to-register-for-connector-ai" },
      { id: "overview", title: "Connector Campaign: Overview", source: "get-calls-lead-generation-ai-automation-connector-campaign-overview" },
      { id: "connection-message", title: "Write A LinkedIn Connection Message", source: "get-calls-lead-generation-ai-automation-write-a-linkedin-connection-message" },
      { id: "follow-up-templates", title: "Connector Campaign: Editing Follow-up Message Templates", source: "get-calls-lead-generation-ai-automation-connector-campaign-editing-follow-up-message-templates" },
    ],
  },
  {
    courseId: "get-calls",
    lessonId: "get-calls-lead-generation-launch-your-connector-campaign",
    title: "Launch Your Connector Campaign",
    duration: "6m",
    body: "### What is this?\\n\\nCreate and launch your Connector campaigns — including open InMail when needed.\\n\\n### How to use this lesson\\n\\nWork through each step in the **Guide** tab in order.",
    chapters: [
      { id: "create-campaign", title: "How to Create Campaigns in Connect Ai", source: "get-calls-lead-generation-ai-automation-how-to-create-campaigns-in-connect-ai" },
      { id: "connected-campaign", title: "How to Create a Campaign for Prospects you are Already Connected With", source: "get-calls-lead-generation-ai-automation-how-to-create-a-campaign-for-prospects-you-are-already-connected-with" },
      { id: "open-inmail", title: "Targeted Open InMail: Craft Open InMail Message", source: "get-calls-lead-generation-ai-automation-targeted-open-inmail-craft-open-inmail-message", duration: "6m" },
    ],
  },
  {
    courseId: "win-clients",
    lessonId: "win-clients-design-your-coaching-offer",
    title: "Design Your Coaching Offer",
    duration: "50m",
    body: "### What is this?\\n\\nClarify what clients are really buying, structure your offer, and set pricing.\\n\\n### How to use this lesson\\n\\nWatch straight through or jump between chapters on the timeline.",
    chapters: [
      { id: "the-gap", title: "The Gap: What Clients Are Really Buying", source: "coach-action-plan-building-a-world-class-coaching-practice-57m-what-are-people-actually-buying-the-gap", duration: "19m" },
      { id: "structure", title: "How To Structure Your Coaching Offer", source: "coach-action-plan-building-a-world-class-coaching-practice-57m-structuring-your-coaching-offer-what-are-you-actually-selling", duration: "11m" },
      { id: "pricing", title: "Pricing & Payment Options", source: "coach-action-plan-building-a-world-class-coaching-practice-57m-pricing-setting-the-right-packages-investment-for-your-coaching", duration: "20m" },
    ],
  },
  {
    courseId: "win-clients",
    lessonId: "win-clients-deliver-your-sales-pitch",
    title: "Deliver Your Sales Pitch",
    duration: "63m",
    body: "### What is this?\\n\\nRun the pitch section of your sales call — from principles through delivery.\\n\\n### How to use this lesson\\n\\nStart with the overview in the **Guide** tab, then watch through or scrub between chapters.",
    chapters: [
      { id: "overview", title: "Sales Pitch Overview", source: "win-clients-sales-pitch-sales-pitch-overview" },
      { id: "principles", title: "Sales Call: Pitching Principles", source: "win-clients-sales-pitch-sales-call-pitching-principles", duration: "6m" },
      { id: "transition", title: "Sales Call: Transition Into Pitch", source: "win-clients-sales-pitch-sales-call-transition-into-pitch", duration: "3m" },
      { id: "the-pitch", title: "Sales Call: The Pitch", source: "win-clients-sales-pitch-sales-call-the-pitch", duration: "34m" },
      { id: "questions-in-pitch", title: "Sales Call: Asking Questions In The Pitch", source: "win-clients-sales-pitch-sales-call-asking-questions-in-the-pitch", duration: "3m" },
      { id: "demo", title: "Sales Pitch Demo: Perfecting Your Pitch Performance", source: "win-clients-sales-pitch-sales-pitch-demo-perfecting-your-pitch-performance", duration: "8m" },
      { id: "share-slides", title: "How To Share Slides On A Sales Call", source: "win-clients-sales-pitch-how-to-share-slides-on-a-sales-call-so-they-don-t-see-your-script", duration: "9m" },
    ],
  },
  {
    courseId: "win-clients",
    lessonId: "win-clients-post-pitch-price-and-close",
    title: "Post-Pitch, Price & Close",
    duration: "119m",
    body: "### What is this?\\n\\nHandle questions after the pitch, present price, and move toward the close.\\n\\n### How to use this lesson\\n\\nWatch straight through or jump between chapters on the timeline.",
    chapters: [
      { id: "check-questions", title: "Sales Call: Post Pitch - Checking For Questions", source: "win-clients-sales-pitch-sales-call-post-pitch-checking-for-questions", duration: "7m" },
      { id: "answer-framework", title: "Sales Call: Post Pitch - Framework For Answering Questions", source: "win-clients-sales-pitch-sales-call-post-pitch-framework-for-answering-questions", duration: "6m" },
      { id: "post-pitch-process", title: "Post Pitch Process", source: "win-clients-sales-pitch-post-pitch-process", duration: "69m" },
      { id: "price-pitch", title: "Price Pitch", source: "win-clients-sales-pitch-price-pitch", duration: "35m" },
      { id: "when-price", title: "When Should You Discuss Price", source: "win-clients-sales-pitch-sales-process-questions-when-should-you-discuss-price", duration: "2m" },
    ],
  },
  {
    courseId: "coach-clients",
    lessonId: "coach-clients-start-and-end-a-coaching-session",
    title: "Start & End a Coaching Session",
    duration: "",
    body: "### What is this?\\n\\nHow to open and close a coaching session with clarity and momentum.\\n\\n### How to use this lesson\\n\\nWork through both steps in the **Guide** tab.",
    chapters: [
      { id: "start", title: "How To Start A Coaching Session", source: "coach-clients-coachiing-session-structure-how-to-start-a-coaching-session" },
      { id: "end", title: "How To End A Coaching Session", source: "coach-clients-coachiing-session-structure-how-eo-end-a-coaching-session" },
    ],
  },
  {
    courseId: "coach-clients",
    lessonId: "coach-clients-certification-welcome-to-profit-coach-certification",
    title: "Welcome",
    duration: "",
    body: "### What is this?\\n\\nEverything you need before Week 1 — orientation, faculty, workbook, and ROI tools.\\n\\n### How to use this lesson\\n\\nWork through each step in the **Guide** tab before starting Coaching Foundations.",
    chapters: [
      { id: "welcome", title: "Welcome To Your Coaching Transformation", source: "coach-clients-certification-welcome-to-the-profit-coach-certification-welcome-to-your-coaching-transformation" },
      { id: "maximise", title: "How to Maximise Your Certification Experience", source: "coach-clients-certification-welcome-to-the-profit-coach-certification-how-to-maximise-your-certification-experience" },
      { id: "faculty", title: "Meet Your Faculty & Our Coaching Philosophy", source: "coach-clients-certification-welcome-to-the-profit-coach-certification-meet-your-faculty-our-coaching-philosophy" },
      { id: "roi-calculator", title: "Profit Coach ROI Calculator", source: "coach-clients-certification-welcome-to-the-profit-coach-certification-profit-coacbh-roi-calculator" },
      { id: "workbook", title: "Profit Coach Certification Workbook", source: "coach-clients-certification-welcome-to-the-profit-coach-certification-profit-coach-certification-workbook" },
    ],
  },
  {
    courseId: "coach-clients",
    lessonId: "coach-clients-certification-week-1-coach-foundations",
    title: "COACH Foundations",
    duration: "108m",
    body: "### What is this?\\n\\nWeek 1 of certification — coaching fundamentals and the COACH Method.\\n\\n### How to use this lesson\\n\\nWatch in order; complete the Week 1 quiz in the **Guide** tab when finished.",
    chapters: [
      { id: "what-is-coaching", title: "What is Coaching", source: "coach-clients-certification-coaching-foundations-what-is-coaching", duration: "8m" },
      { id: "coaching-style", title: "What is your coaching style?", source: "coach-action-plan-building-a-world-class-coaching-practice-57m-what-is-your-coaching-style-3-traits-that-define-how-you-coach" },
      { id: "feedback", title: "The Power of Effective Feedback", source: "coach-clients-certification-coaching-foundations-the-power-of-effective-feedback", duration: "11m" },
      { id: "use-it-or-lose-it", title: "The Use It or Lose It Principle", source: "coach-clients-certification-coaching-foundations-the-use-it-or-lose-it-principle", duration: "8m" },
      { id: "active-listening", title: "Core Skill: Active Listening + Demo", source: "coach-clients-certification-coaching-foundations-core-skill-active-listening-demo", duration: "12m" },
      { id: "coach-overview", title: "The COACH Method Overview", source: "coach-clients-certification-coaching-foundations-the-coach-method-overview", duration: "4m" },
      { id: "using-coach", title: "Using the COACH Method", source: "coach-clients-certification-coaching-foundations-using-the-coach-method", duration: "23m" },
      { id: "coaching-cube", title: "The Coaching Cube", source: "coach-clients-certification-coaching-foundations-the-coaching-cube", duration: "3m" },
      { id: "simulator", title: "Client Simulator: Coach Practice", source: "coach-clients-certification-coaching-foundations-client-simulator-coach-practice", duration: "7m" },
      { id: "live-demo", title: "Live Coaching Session Demo", source: "coach-clients-certification-coaching-foundations-live-coaching-session-demo", duration: "14m" },
      { id: "ideal-structure", title: "Ideal Session Structure", source: "coach-clients-certification-coaching-foundations-ideal-session-structure", duration: "8m" },
      { id: "more-sessions", title: "How COACH Creates More Sessions", source: "coach-clients-certification-coaching-foundations-how-coach-creates-more-sessions", duration: "2m" },
      { id: "review", title: "Coach Foundations Review", source: "coach-clients-certification-coaching-foundations-coach-foundations-review", duration: "8m" },
      { id: "week-1-quiz", title: "Week 1 Quiz - Introduction and COACH", source: "coach-clients-certification-coaching-foundations-week-1-quiz-introduction-and-coach" },
    ],
  },
  {
    courseId: "coach-clients",
    lessonId: "coach-clients-certification-week-2-powerful-questions",
    title: "Powerful Questions",
    duration: "72m",
    body: "### What is this?\\n\\nWeek 2 — the POWER framework and powerful questioning.\\n\\n### How to use this lesson\\n\\nWatch in order; complete assessments and quizzes in the **Guide** tab.",
    chapters: [
      { id: "icf", title: "ICF 8 Core Competencies", source: "coach-clients-certification-the-exact-questions-to-ask-clients-icf-8-core-competencies", duration: "17m" },
      { id: "power-overview", title: "The POWER Framework Overview", source: "coach-clients-certification-the-exact-questions-to-ask-clients-the-power-framework-overview", duration: "4m" },
      { id: "exercises", title: "How To Ask Powerful Questions + Exercises", source: "coach-clients-certification-the-exact-questions-to-ask-clients-how-to-ask-powerful-questions-exercises", duration: "15m" },
      { id: "powerful-vs-transformational", title: "Powerful Vs Transformational Questions", source: "coach-clients-certification-the-exact-questions-to-ask-clients-powerful-vs-transformational-questions", duration: "14m" },
      { id: "comm-assessment", title: "Communication Skills Assessment", source: "coach-clients-certification-the-exact-questions-to-ask-clients-communication-skills-assessment" },
      { id: "power-detail", title: "The POWER Framework Detail", source: "coach-clients-certification-the-exact-questions-to-ask-clients-the-power-framework-detail", duration: "11m" },
      { id: "week-2-review", title: "Week 2: Coach Superpowers Review", source: "coach-clients-certification-the-exact-questions-to-ask-clients-week-2-coach-superpowers-review", duration: "9m" },
      { id: "simulator", title: "Client Simulator: Profitability Issues", source: "coach-clients-certification-the-exact-questions-to-ask-clients-client-simullator-profitabilty-issues-management-consultant", duration: "2m" },
      { id: "great-coach-quiz", title: "Becoming A Great Coach Quiz", source: "coach-clients-certification-the-exact-questions-to-ask-clients-becoming-a-great-coach-quiz" },
      { id: "superpowers-quiz", title: "SuperPOWERs Quiz", source: "coach-clients-certification-the-exact-questions-to-ask-clients-superpowers-quiz" },
      { id: "questioning-quiz", title: "Questioning and Listening Quiz", source: "coach-clients-certification-the-exact-questions-to-ask-clients-questioning-and-listening-quiz" },
    ],
  },
  {
    courseId: "coach-clients",
    lessonId: "coach-clients-certification-week-3-lasting-transformation",
    title: "Lasting Transformation",
    duration: "130m",
    body: "### What is this?\\n\\nWeek 3 — sustainable transformation, mindset, and advanced coaching skills.\\n\\n### How to use this lesson\\n\\nWatch in order; complete the mindset quiz in the **Guide** tab.",
    chapters: [
      { id: "overview", title: "Sprint Week 3 Overview", source: "coach-clients-certification-create-lasting-transformation-sprint-week-3-overview", duration: "7m" },
      { id: "sustainable", title: "Creating Sustainable Transformation", source: "coach-clients-certification-create-lasting-transformation-creating-sustainable-transformation", duration: "13m" },
      { id: "add-value", title: "How To Continually Add Value", source: "coach-clients-certification-create-lasting-transformation-how-to-continually-add-value", duration: "18m" },
      { id: "mindset", title: "Coaching Mindset", source: "coach-clients-certification-create-lasting-transformation-coaching-mindset", duration: "13m" },
      { id: "state-of-mind", title: "Controlling Your State Of Mind", source: "coach-clients-certification-create-lasting-transformation-controlling-your-state-of-mind", duration: "22m" },
      { id: "psychology", title: "How Psychology Affects Mindset", source: "coach-clients-certification-create-lasting-transformation-how-psychology-affects-mindset", duration: "7m" },
      { id: "vocabulary", title: "Use Vocabulary to Change Perception", source: "coach-clients-certification-create-lasting-transformation-use-vocabulary-to-change-perception", duration: "6m" },
      { id: "mindset-quiz", title: "Coaching Mindset Quiz", source: "coach-clients-certification-create-lasting-transformation-coaching-mindset-quiz" },
      { id: "coaching-sheet", title: "How To Use The Coaching Sheet In Sessions", source: "coach-clients-certification-create-lasting-transformation-how-to-use-the-coaching-sheet-in-sessions", duration: "9m" },
      { id: "feedback-review", title: "Coaching a Person Feedback Review", source: "coach-clients-certification-create-lasting-transformation-coachin-a-person-feedback-review", duration: "9m" },
      { id: "ai-vs-person", title: "Pros & Cons Coaching AI vs Person", source: "coach-clients-certification-create-lasting-transformation-pros-cons-coachin-ai-vs-person", duration: "15m" },
      { id: "advanced-selling", title: "Advanced Coaching Skills & Selling", source: "coach-clients-certification-create-lasting-transformation-advanced-coaching-skills-selling", duration: "5m" },
      { id: "homework", title: "Sprint Week 3 Review + Homework", source: "coach-clients-certification-create-lasting-transformation-sprint-week-3-review-homework", duration: "6m" },
    ],
  },
  {
    courseId: "coach-clients",
    lessonId: "coach-clients-certification-week-4-world-class-coach",
    title: "World-Class Coach",
    duration: "114m",
    body: "### What is this?\\n\\nWeek 4 — leadership coaching, ethics, tools, certification assessment, and next steps.\\n\\n### How to use this lesson\\n\\nWatch in order; complete quizzes and the certification assessment in the **Guide** tab.",
    chapters: [
      { id: "coaching-as-leader", title: "Coaching As A Leader", source: "coach-clients-certification-becoming-a-world-class-business-coach-coaching-as-a-leader", duration: "23m" },
      { id: "leader-quiz", title: "Coaching As A Leader Quiz", source: "coach-clients-certification-becoming-a-world-class-business-coach-coaching-as-a-leader-quiz" },
      { id: "ethics", title: "Ethical Dilemmas and difficult situations", source: "coach-clients-certification-becoming-a-world-class-business-coach-ethical-dilemmas-and-difficult-situations", duration: "14m" },
      { id: "ethics-quiz", title: "Ethical Dilemas Quiz", source: "coach-clients-certification-becoming-a-world-class-business-coach-ethical-dilemas-quiz" },
      { id: "using-tools", title: "Client Sessions & Using Tools", source: "coach-clients-certification-becoming-a-world-class-business-coach-client-sessions-using-tools", duration: "20m" },
      { id: "tools-example", title: "Example Using tools & COACH Method", source: "coach-clients-certification-becoming-a-world-class-business-coach-example-using-tools-coach-method", duration: "7m" },
      { id: "master-selling", title: "Master COACH to Master Selling", source: "coach-clients-certification-becoming-a-world-class-business-coach-master-coach-to-master-selling", duration: "12m" },
      { id: "assessment", title: "Business Coach Certification Assessment", source: "coach-clients-certification-becoming-a-world-class-business-coach-business-coach-certification-assessment", duration: "8m" },
      { id: "feedback-survey", title: "Certification Feedback Survey", source: "coach-clients-certification-becoming-a-world-class-business-coach-certification-feedback-survey", duration: "11m" },
      { id: "round-up", title: "Certification Round-up & Next Steps", source: "coach-clients-certification-becoming-a-world-class-business-coach-certificaiton-round-up-next-steps", duration: "6m" },
      { id: "blueprint", title: "Business Blueprint", source: "coach-clients-certification-becoming-a-world-class-business-coach-business-blueprint", duration: "13m" },
    ],
  },
];

const sql = `-- Classroom lesson consolidations (batch 2). Generated by scripts/generate-academy-consolidation-migration.mjs

${consolidations.map(insertBlock).join("\n")}
`;

const outPath = path.join(
  process.cwd(),
  "supabase/migrations/20261023170000_academy_classroom_lesson_consolidations.sql",
);
fs.writeFileSync(outPath, sql);
console.log(`Wrote ${outPath} (${consolidations.length} consolidations)`);

// Export registry JSON for lessonVideoChapters.ts
const registry = consolidations.map((c) => ({
  courseId: c.courseId,
  consolidatedLessonId: c.lessonId,
  legacyChapterByLessonId: Object.fromEntries(
    c.chapters.map((ch) => [ch.source, ch.id]),
  ),
}));
const registryPath = path.join(
  process.cwd(),
  "scripts/academy-consolidation-registry.json",
);
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
const srcRegistryPath = path.join(
  process.cwd(),
  "src/lib/academy/consolidatedLessonRegistry.json",
);
fs.writeFileSync(srcRegistryPath, JSON.stringify(registry, null, 2));
console.log(`Wrote ${registryPath}`);
console.log(`Wrote ${srcRegistryPath}`);
