import { PROGRAMME_ORIENTATION_JOIN_URL } from "@/config/programmeOrientationCalendar";
import { START_HERE_WELCOME_PATH } from "@/lib/academy/classroomIds";
import { getPublicAppBaseUrl } from "@/lib/appBaseUrl";
import type { BookingReminderStep } from "@/lib/booking/reminderSequence";

export type OrientationReminderStepId = "confirmation" | "24h" | "1h";

export type OrientationReminderInput = {
  stepId: string;
  firstName: string;
  when: string;
  joinUrl: string | null;
  startsAtIso: string;
  endsAtIso: string;
  calendarEventCreated: boolean;
};

const PICK_YOUR_PATH_PATH =
  "/coach/academy/classroom/start-here/start-here-welcome-pick-your-path";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function programmeLinks() {
  const origin = getPublicAppBaseUrl();
  return {
    welcome: `${origin}/welcome`,
    startHere: `${origin}${START_HERE_WELCOME_PATH}`,
    pickPath: `${origin}${PICK_YOUR_PATH_PATH}`,
    login: `${origin}/login`,
    questionsShot: `${origin}/email/orientation/welcome-questions.png`,
    startHereShot: `${origin}/email/orientation/start-here.png`,
    pickPathShot: `${origin}/email/orientation/pick-your-path.png`,
  };
}

function joinTarget(input: OrientationReminderInput): string {
  const given = input.joinUrl?.trim() ?? "";
  return given || PROGRAMME_ORIENTATION_JOIN_URL;
}

function googleCalendarUrl(input: OrientationReminderInput): string {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const join = joinTarget(input);
  const links = programmeLinks();
  const details =
    input.stepId === "confirmation"
      ? [
          `Join: ${join}`,
          `Welcome page: ${links.welcome}`,
          `Start Here: ${links.startHere}`,
          `Pick Your Path: ${links.pickPath}`,
        ].join("\n")
      : `Join: ${join}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Orientation call with Pam",
    dates: `${fmt(input.startsAtIso)}/${fmt(input.endsAtIso)}`,
    details,
    location: join,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function calendarLine(input: OrientationReminderInput): string {
  if (input.calendarEventCreated) {
    return "This is on Pam's calendar, and an invite is on its way to yours. If you don't see it yet, add it with the link below.";
  }
  return "Add it to your calendar with the link below so it doesn't get lost. We've also invited Pam.";
}

const PREP = [
  "Watch the welcome video on your welcome page, if you haven't yet.",
  "Answer the short questions under the video: who you are, what matters, how much time you can give, and your LinkedIn URL if you have it.",
  "In the portal, open Classroom in the left menu, then Start Here, then Welcome & Program Overview.",
] as const;

export function orientationReminderSubject(stepId: string): string {
  switch (stepId) {
    case "confirmation":
      return "You're booked — orientation call with Pam";
    case "24h":
      return "Tomorrow: your orientation call with Pam";
    case "1h":
      return "In an hour: orientation call with Pam";
    default:
      return "Your orientation call with Pam";
  }
}

export function orientationReminderText(input: OrientationReminderInput): string {
  const links = programmeLinks();
  const name = input.firstName.trim() || "there";
  const join = joinTarget(input);
  const when = `When: ${input.when}`;
  const where = `Join: ${join}`;
  const add = `Add to your calendar: ${googleCalendarUrl(input)}`;

  if (input.stepId === "1h") {
    return [
      `Hi ${name},`,
      "",
      "Your orientation call with Pam starts in about an hour.",
      "",
      when,
      where,
      "",
      "See you there,",
      "Pam",
    ].join("\n");
  }

  if (input.stepId === "24h") {
    return [
      `Hi ${name},`,
      "",
      "Your orientation call with Pam is tomorrow.",
      "",
      when,
      where,
      "",
      calendarLine(input),
      add,
      "",
      "How are you getting on in the programme? Reply to this email with a sentence or two — what's clicked, and what's still in the way. That's enough for Pam to prepare.",
      "",
      "If the time no longer works, say so in that reply and we'll move it.",
      "",
      "Pam",
    ].join("\n");
  }

  return [
    `Hi ${name},`,
    "",
    "You're booked. Pam will use this call to point you at the right first path — not to re-teach the whole programme.",
    "",
    when,
    where,
    "",
    calendarLine(input),
    add,
    "",
    "Before you join, three things help:",
    `1. ${PREP[0]} ${links.welcome}`,
    `2. ${PREP[1]} ${links.welcome}`,
    `3. ${PREP[2]} ${links.startHere}`,
    `Pick Your Path: ${links.pickPath}`,
    "",
    "Sign in with the email you paid with if you're sent to the login page:",
    links.login,
    "",
    "Reply to this email if the time no longer works.",
    "",
    "Pam",
  ].join("\n");
}

function shot(src: string, alt: string, href: string, caption: string): string {
  return `<p style="margin:14px 0 4px;"><a href="${escapeHtml(href)}"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:1px solid #e2e8f0;border-radius:12px;" /></a></p>
    <p style="margin:0 0 14px;font-size:13px;line-height:1.4;color:#475569;">${escapeHtml(caption)}</p>`;
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#0c5290;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;line-height:1.2;padding:12px 18px;border-radius:999px;">${escapeHtml(label)}</a>`;
}

function linkLine(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:#0c5290;font-weight:600;">${escapeHtml(label)}</a>`;
}

export function orientationReminderHtml(input: OrientationReminderInput): string {
  const links = programmeLinks();
  const name = escapeHtml(input.firstName.trim() || "there");
  const when = escapeHtml(input.when);
  const join = joinTarget(input);
  const joinHtml = linkLine(join, join);
  const addUrl = googleCalendarUrl(input);

  if (input.stepId === "1h") {
    return `<div style="font-family:Georgia, 'Times New Roman', serif;color:#0f172a;font-size:16px;line-height:1.55;max-width:560px;">
    <p style="margin:0 0 16px;">Hi ${name},</p>
    <p style="margin:0 0 16px;">Your orientation call with Pam starts in about an hour.</p>
    <p style="margin:0 0 6px;"><strong>When:</strong> ${when}</p>
    <p style="margin:0 0 16px;"><strong>Join:</strong> ${joinHtml}</p>
    <p style="margin:20px 0 0;">See you there,<br/>Pam</p>
  </div>`;
  }

  if (input.stepId === "24h") {
    return `<div style="font-family:Georgia, 'Times New Roman', serif;color:#0f172a;font-size:16px;line-height:1.55;max-width:560px;">
    <p style="margin:0 0 16px;">Hi ${name},</p>
    <p style="margin:0 0 16px;">Your orientation call with Pam is tomorrow.</p>
    <p style="margin:0 0 6px;"><strong>When:</strong> ${when}</p>
    <p style="margin:0 0 16px;"><strong>Join:</strong> ${joinHtml}</p>
    <p style="margin:0 0 16px;">${escapeHtml(calendarLine(input))}</p>
    <p style="margin:0 0 20px;">${button(addUrl, "Add to my calendar")}</p>
    <p style="margin:0 0 16px;">How are you getting on in the programme? Reply to this email with a sentence or two — what's clicked, and what's still in the way. That's enough for Pam to prepare.</p>
    <p style="margin:0 0 16px;">If the time no longer works, say so in that reply and we'll move it.</p>
    <p style="margin:20px 0 0;">Pam</p>
  </div>`;
  }

  const prep = `<p style="margin:0 0 12px;">Before the call, three things help. You don't need to finish the programme.</p>
         <p style="margin:0 0 8px;"><strong>1. Welcome video.</strong> ${escapeHtml(PREP[0])} ${linkLine(links.welcome, "Open your welcome page")}</p>
         <p style="margin:0 0 8px;"><strong>2. The short questions.</strong> ${escapeHtml(PREP[1])}</p>
         ${shot(links.questionsShot, "The short questions on the welcome page", links.welcome, "These sit under the welcome video. Answer them, then you're done with this step.")}
         <p style="margin:0 0 8px;"><strong>3. Start Here.</strong> ${escapeHtml(PREP[2])} ${linkLine(links.startHere, "Open Welcome & Program Overview")}</p>
         ${shot(links.startHereShot, "Start Here in the classroom", links.startHere, "Classroom is in the left menu. Start Here is the first course. Open Welcome & Program Overview.")}
         <p style="margin:0 0 8px;">Then ${linkLine(links.pickPath, "Pick Your Path")}.</p>
         ${shot(links.pickPathShot, "Pick Your Path in Start Here", links.pickPath, "This lesson chooses the track that matches where you're stuck.")}`;

  return `<div style="font-family:Georgia, 'Times New Roman', serif;color:#0f172a;font-size:16px;line-height:1.55;max-width:560px;">
    <p style="margin:0 0 16px;">Hi ${name},</p>
    <p style="margin:0 0 16px;">You're booked. Pam will use this call to point you at the right first path — not to re-teach the whole programme.</p>
    <p style="margin:0 0 6px;"><strong>When:</strong> ${when}</p>
    <p style="margin:0 0 16px;"><strong>Join:</strong> ${joinHtml}</p>
    <p style="margin:0 0 16px;">${escapeHtml(calendarLine(input))}</p>
    <p style="margin:0 0 20px;">${button(addUrl, "Add to my calendar")}</p>
    ${prep}
    <p style="margin:20px 0 0;font-size:14px;color:#475569;">If you're sent to sign in, use the email you paid with. ${linkLine(links.login, "Sign in")}</p>
    <p style="margin:20px 0 0;">Pam</p>
  </div>`;
}

/** Schedule stored on the orientation calendar. Sent copy is rendered in code. */
export function orientationReminderSequence(): BookingReminderStep[] {
  const confirmationBody = [
    "Hi {{first_name}},",
    "",
    "You're booked for your orientation call with Pam.",
    "",
    "When: {{when}}",
    "Where: {{where}}",
    "",
    "Before the call: welcome video, the short questions on that page, then Classroom → Start Here → Welcome & Program Overview, then Pick Your Path.",
    "",
    "Pam",
  ].join("\n");
  const dayBeforeBody = [
    "Hi {{first_name}},",
    "",
    "Your orientation call with Pam is tomorrow.",
    "",
    "When: {{when}}",
    "Where: {{where}}",
    "",
    "How are you getting on in the programme? Reply with a sentence or two.",
    "",
    "Pam",
  ].join("\n");
  const hourBeforeBody = [
    "Hi {{first_name}},",
    "",
    "Your orientation call with Pam starts in about an hour.",
    "",
    "When: {{when}}",
    "Where: {{where}}",
    "",
    "Pam",
  ].join("\n");
  return [
    {
      id: "confirmation",
      kind: "confirmation",
      enabled: true,
      minutes_before: 0,
      email: true,
      sms: false,
      subject: orientationReminderSubject("confirmation"),
      body: confirmationBody,
    },
    {
      id: "24h",
      kind: "reminder",
      enabled: true,
      minutes_before: 24 * 60,
      email: true,
      sms: false,
      subject: orientationReminderSubject("24h"),
      body: dayBeforeBody,
    },
    {
      id: "1h",
      kind: "reminder",
      enabled: true,
      minutes_before: 60,
      email: true,
      sms: false,
      subject: orientationReminderSubject("1h"),
      body: hourBeforeBody,
    },
  ];
}
