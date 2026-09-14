import type { CampaignStepInput } from "@/lib/unipile/campaigns";

export type PlaybookVariant = {
  key: string;
  label: string;
  body: string;
};

export type PlaybookStep = CampaignStepInput & {
  variants?: PlaybookVariant[];
};

export type OutreachPlaybook = {
  id: string;
  name: string;
  channel: "linkedin" | "email";
  description: string;
  northStar: string;
  steps: PlaybookStep[];
  /** Seed a draft of this playbook into every coach account. */
  seedDefault?: boolean;
  dailyInviteLimit?: number;
};

export function packEmailBody(
  subject: string,
  preview: string,
  body: string
): string {
  return `Subject: ${subject}\nPreview: ${preview}\n\n${body}`.trim();
}

export function unpackEmailBody(packed: string): {
  subject: string;
  preview: string;
  body: string;
} {
  const text = packed.replace(/\r\n/g, "\n").trim();
  const subjectMatch = text.match(/^Subject:\s*(.*)$/m);
  const previewMatch = text.match(/^Preview:\s*(.*)$/m);
  const split = text.split(/\n\n/);
  const body =
    subjectMatch && split.length > 1
      ? split.slice(1).join("\n\n").trim()
      : text;
  return {
    subject: subjectMatch?.[1]?.trim() || "Hello",
    preview: previewMatch?.[1]?.trim() || "",
    body: body || text,
  };
}

export function waitStep(waitHours: number): Omit<PlaybookStep, "position"> {
  return { step_type: "wait", wait_hours: waitHours };
}

export function inviteStep(
  body = "",
  variants?: PlaybookVariant[]
): Omit<PlaybookStep, "position"> {
  return { step_type: "invite", body, variants };
}

export function messageStep(
  body: string,
  variants?: PlaybookVariant[]
): Omit<PlaybookStep, "position"> {
  return { step_type: "message", body, variants };
}

export function emailStep(
  subject: string,
  preview: string,
  body: string,
  variants?: PlaybookVariant[]
): Omit<PlaybookStep, "position"> {
  return {
    step_type: "email",
    body: packEmailBody(subject, preview, body),
    variants,
  };
}

export function withPositions(
  steps: Array<Omit<PlaybookStep, "position">>
): PlaybookStep[] {
  return steps.map((step, i) => ({ ...step, position: i }));
}

/** Alternate message / wait. First item may be a wait (e.g. after an invite). */
export function spaced(
  items: Array<Omit<PlaybookStep, "position">>
): PlaybookStep[] {
  return withPositions(items);
}
