/**
 * Canonical outreach playbooks.
 * Connector and Nurture are the default stack. Scorecard sequences live on lead magnets.
 *
 * Manual "reply to replies" snippets live in replySnippets.ts (grouped).
 */

export type { OutreachPlaybook, PlaybookStep, PlaybookVariant } from "@/lib/unipile/playbookSteps";

export {
  REPLY_PLAYBOOK_SNIPPETS,
  REPLY_SNIPPET_GROUPS,
  groupedReplySnippets,
  snippetBodyForChannel,
  snippetsByGroup,
  type ReplyPlaybookSnippet,
  type ReplySnippetChannel,
  type ReplySnippetGroupId,
} from "@/lib/unipile/replySnippets";

import { VIP_GET_INTEREST_PLAYBOOK } from "@/lib/unipile/playbooks/connectorVip";
import {
  PAM_MARKETING,
  PAM_OWNER_DEPENDENCE,
  PAM_PROFIT_LEAKAGE,
} from "@/lib/unipile/playbooks/pamEmails";
import { REPLY_INTERESTED_PLAYBOOK } from "@/lib/unipile/playbooks/replyInterested";
import {
  SCORECARD_COMPLETE_PLAYBOOK,
  SCORECARD_INCOMPLETE_PLAYBOOK,
} from "@/lib/unipile/playbooks/scorecardSequences";
import {
  SCORECARD_PRO_COMPLETE_PLAYBOOK,
  SCORECARD_PRO_INCOMPLETE_PLAYBOOK,
} from "@/lib/unipile/playbooks/scorecardProSequences";
import { VIP_NURTURE_PLAYBOOK } from "@/lib/unipile/playbooks/vipNurture";
import {
  messageStep,
  spaced,
  waitStep,
  type OutreachPlaybook,
} from "@/lib/unipile/playbookSteps";

export { VIP_GET_INTEREST_PLAYBOOK } from "@/lib/unipile/playbooks/connectorVip";
export {
  PAM_MARKETING,
  PAM_OWNER_DEPENDENCE,
  PAM_PROFIT_LEAKAGE,
} from "@/lib/unipile/playbooks/pamEmails";
export { REPLY_INTERESTED_PLAYBOOK } from "@/lib/unipile/playbooks/replyInterested";
export {
  SCORECARD_COMPLETE_PLAYBOOK,
  SCORECARD_INCOMPLETE_PLAYBOOK,
} from "@/lib/unipile/playbooks/scorecardSequences";
export {
  SCORECARD_PRO_COMPLETE_PLAYBOOK,
  SCORECARD_PRO_INCOMPLETE_PLAYBOOK,
} from "@/lib/unipile/playbooks/scorecardProSequences";
export { VIP_NURTURE_PLAYBOOK } from "@/lib/unipile/playbooks/vipNurture";

/** Shorter LinkedIn connector → discovery → scorecard interest (no calendar). */
export const CONNECTOR_INTEREST_PLAYBOOK: OutreachPlaybook = {
  id: "connector-interest",
  name: "Connector → interest → scorecard",
  channel: "linkedin",
  description:
    "Connect, soft discovery, then scorecard offer. A/B on the discovery ask.",
  northStar: "interested_reply",
  steps: spaced([
    { step_type: "invite", body: "" },
    waitStep(1),
    messageStep("Happy to share how if you're curious."),
    waitStep(24),
    messageStep(
      "Curious {{first_name}} – what would you most like to be even better:\n1. Your time – more flexibility and fun\n2. Your profit – pay yourself more\n3. Your team – things running without you\n1, 2, or 3?",
      [
        {
          key: "A",
          label: "1/2/3 discovery",
          body: "Curious {{first_name}} – what would you most like to be even better:\n1. Your time – more flexibility and fun\n2. Your profit – pay yourself more\n3. Your team – things running without you\n1, 2, or 3?",
        },
        {
          key: "B",
          label: "Open interest ask",
          body: "Hi {{first_name}}, is getting more profit and control in the business without everything depending on you of interest right now, or is timing off?",
        },
      ]
    ),
    waitStep(24),
    messageStep(
      "{{first_name}} – would you be interested in a free BOSS Scorecard? It scores the business out of 100 and shows what to focus on next. I can send the link ({{assessment_url}}) or we can look at it together. Interested?"
    ),
  ]),
};

const VIP100_SOFT_A = `Hi {{first_name}},
I've just launched a new 3-minute BOSS Scorecard for business owners who are doing well on paper, but feel stretched too thin behind the scenes.
It gives you a score out of 100 and shows where the business may be over-relying on you.
What do you reckon you'll score?
{{assessment_url}}`;

const VIP100_SOFT_B = `Hi {{first_name}},
I've created a 3-minute BOSS Scorecard for business owners who are doing well on paper but feel stretched too thin.
It gives you a score out of 100 and shows where the business may be over-relying on you.
What do you reckon you'll score?
{{assessment_url}}`;

/** Warm VIP 100 list — soft scorecard invite + nudge (personalise first line). */
export const VIP_100_SCORECARD_PLAYBOOK: OutreachPlaybook = {
  id: "vip-100-scorecard",
  name: "VIP 100 scorecard invite",
  channel: "linkedin",
  description:
    "Warm connections / past enquiries. Soft invite, then nudge. Personalise line one.",
  northStar: "assessment_start",
  steps: spaced([
    messageStep(VIP100_SOFT_A, [
      { key: "A", label: "Soft invite, stretched thin", body: VIP100_SOFT_A },
      { key: "B", label: "Soft invite, short", body: VIP100_SOFT_B },
    ]),
    waitStep(72),
    messageStep(`Hi {{first_name}},
Just giving this a gentle nudge.
The BOSS Scorecard only takes 3 minutes and gives you a quick score out of 100 across the key areas of your business.
Useful if you want to see where things could work even better and what to focus on first.
Here's the link again:
{{assessment_url}}`),
  ]),
};

/** Back-compat id for the old 90-day playbook. Same steps as VIP nurture. */
export const NURTURE_90_DAY_PLAYBOOK: OutreachPlaybook = {
  ...VIP_NURTURE_PLAYBOOK,
  id: "nurture-90-day",
  name: "90-day LinkedIn nurture",
  seedDefault: false,
};

export const OUTREACH_PLAYBOOKS: OutreachPlaybook[] = [
  VIP_GET_INTEREST_PLAYBOOK,
  VIP_NURTURE_PLAYBOOK,
  REPLY_INTERESTED_PLAYBOOK,
  SCORECARD_INCOMPLETE_PLAYBOOK,
  SCORECARD_COMPLETE_PLAYBOOK,
  SCORECARD_PRO_INCOMPLETE_PLAYBOOK,
  SCORECARD_PRO_COMPLETE_PLAYBOOK,
  PAM_OWNER_DEPENDENCE,
  PAM_PROFIT_LEAKAGE,
  PAM_MARKETING,
  CONNECTOR_INTEREST_PLAYBOOK,
  VIP_100_SCORECARD_PLAYBOOK,
  NURTURE_90_DAY_PLAYBOOK,
];

export const DEFAULT_ACCOUNT_PLAYBOOKS: OutreachPlaybook[] =
  OUTREACH_PLAYBOOKS.filter((p) => p.seedDefault);

export function getPlaybook(id: string): OutreachPlaybook | null {
  return OUTREACH_PLAYBOOKS.find((p) => p.id === id) ?? null;
}
