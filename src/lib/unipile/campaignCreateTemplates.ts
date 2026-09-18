import {
  emailStep,
  inviteStep,
  messageStep,
  waitStep,
  type PlaybookStep,
} from "@/lib/unipile/playbookSteps";

export type CampaignCreateTemplateId =
  | "blank"
  | "linkedin-connector"
  | "linkedin-followup"
  | "email-sequence";

export type CampaignCreateTemplate = {
  id: CampaignCreateTemplateId;
  name: string;
  description: string;
  channel: "linkedin" | "email";
  steps: Array<Omit<PlaybookStep, "position">>;
};

export const CAMPAIGN_CREATE_TEMPLATES: CampaignCreateTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Empty sequence — add steps in the builder.",
    channel: "linkedin",
    steps: [],
  },
  {
    id: "linkedin-connector",
    name: "LinkedIn connector",
    description: "Invite, wait, then a first message. Fill in the copy.",
    channel: "linkedin",
    steps: [
      inviteStep("Hi {{first_name}} — [your connection note]"),
      waitStep(24),
      messageStep("Hi {{first_name}}, [your first message after they connect]"),
    ],
  },
  {
    id: "linkedin-followup",
    name: "LinkedIn follow-up",
    description: "For people you're already connected with. Placeholder messages.",
    channel: "linkedin",
    steps: [
      messageStep("Hi {{first_name}}, [opening message]"),
      waitStep(72),
      messageStep("Hi {{first_name}}, [follow-up]"),
    ],
  },
  {
    id: "email-sequence",
    name: "Email sequence",
    description: "Two emails with a wait between. Fill in subject and body.",
    channel: "email",
    steps: [
      emailStep(
        "[Subject line]",
        "",
        "Hi {{first_name}},\n\n[your first email]\n\n[your name]"
      ),
      waitStep(72),
      emailStep(
        "[Follow-up subject]",
        "",
        "Hi {{first_name}},\n\n[your follow-up]\n\n[your name]"
      ),
    ],
  },
];

export function getCampaignCreateTemplate(
  id: string | null | undefined
): CampaignCreateTemplate | null {
  if (!id || id === "blank") return null;
  return CAMPAIGN_CREATE_TEMPLATES.find((t) => t.id === id) ?? null;
}
