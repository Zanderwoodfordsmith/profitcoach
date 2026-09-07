/**
 * Manual reply / DM templates — how you reply to replies.
 * Grouped by situation. Short body = LinkedIn / WhatsApp; emailBody when longer.
 */

export type ReplySnippetGroupId =
  | "interest"
  | "response_types"
  | "scorecard"
  | "follow_up"
  | "vip100"
  | "nurture_engage";

export type ReplySnippetChannel = "linkedin" | "whatsapp" | "email" | "any";

export type ReplyPlaybookSnippet = {
  id: string;
  group: ReplySnippetGroupId;
  /** Situation label shown in the picker */
  when: string;
  /** Preferred channel(s); UI can filter. Default body is DM-length. */
  channel: ReplySnippetChannel;
  /** LinkedIn / WhatsApp / short social length */
  body: string;
  /** Longer email variant when length should differ */
  emailBody?: string;
};

export const REPLY_SNIPPET_GROUPS: Array<{
  id: ReplySnippetGroupId;
  /** Short folder name in the snippets picker (GHL-style). */
  label: string;
  /** Longer description for docs / tooltips. */
  description: string;
}> = [
  {
    id: "interest",
    label: "Interest",
    description: "Same-day call + message after a positive reply.",
  },
  {
    id: "response_types",
    label: "Replies",
    description: "Exact responses for not yet, 👍, fine for now, no thanks.",
  },
  {
    id: "scorecard",
    label: "Scorecard",
    description: "Send the assessment, nudge non-completers, book the review.",
  },
  {
    id: "follow_up",
    label: "Follow-up",
    description: "Days 1–4 and final ping-pong when they go quiet after interest.",
  },
  {
    id: "vip100",
    label: "VIP 100",
    description: "Warm-list soft invites and completion follow-ups.",
  },
  {
    id: "nurture_engage",
    label: "Nurture",
    description: "Templates for yes / questions / problems / quiet after 90 days.",
  },
];

/** Reply / objection / invite snippets for Conversations (not automated steps). */
export const REPLY_PLAYBOOK_SNIPPETS: ReplyPlaybookSnippet[] = [
  // ── Interest (Playbook 1) ───────────────────────────────────────────
  {
    id: "interest-call-offer",
    group: "interest",
    when: "Shows interest — after call attempt",
    channel: "linkedin",
    body: `Hi {{first_name}},
I saw your message about {{their_reply}}. I called a couple of times and left you a message.
This is something I help my clients with regularly. Would you be opposed to a short call?`,
    emailBody: `Hi {{first_name}},

I saw your message about {{their_reply}}. I called a couple of times and left you a message.

This is something I help my clients with regularly. Would you be opposed to a short call this week?

Best,
{{coach_name}}`,
  },
  {
    id: "interest-softer",
    group: "interest",
    when: "Interest — softer open",
    channel: "linkedin",
    body: `Hi {{first_name}},
I saw your message about {{their_reply}}. Is it just something specific at the moment, or is it how it always is?`,
  },
  {
    id: "interest-whatsapp-call",
    group: "interest",
    when: "Shows interest — WhatsApp after call",
    channel: "whatsapp",
    body: `Hi {{first_name}} — saw your note about {{their_reply}}. Tried you a couple of times and left a voicemail. Happy to jump on a short call when suits?`,
  },

  // ── Response types (Playbook 2) ─────────────────────────────────────
  {
    id: "not-yet",
    group: "response_types",
    when: 'Says "not yet" / "maybe later"',
    channel: "any",
    body: `Is it not yet because you've got something in particular that you're currently focused on?`,
  },
  {
    id: "thumbs-up",
    group: "response_types",
    when: "Thumbs up only 👍",
    channel: "linkedin",
    body: `Is the thumbs up that you would like to have a call with me / interested, or is it a thumbs up you're just agreeing with my comments?`,
  },
  {
    id: "fine-for-now",
    group: "response_types",
    when: '"Fine for now" / "we\'re good now"',
    channel: "any",
    body: `It's great that you can say that. Not many business owners can.
What I find is that every level has its devil, and usually there's something that you'd like to be even better in the business.`,
  },
  {
    id: "fine-for-now-nudge",
    group: "response_types",
    when: "After fine-for-now — if they don't name anything",
    channel: "any",
    body: `What's the thing you'd like to be even better in your business right now?`,
  },
  {
    id: "no-thanks",
    group: "response_types",
    when: '"No thanks"',
    channel: "any",
    body: `Is that no thanks to what I've written (like helping you make more profit)? Or no thanks you don't want to make more profit at the moment? Or no thanks you don't want to hear from me ever again?`,
  },

  // ── Scorecard ───────────────────────────────────────────────────────
  {
    id: "send-scorecard",
    group: "scorecard",
    when: "Interested → send assessment (before call)",
    channel: "linkedin",
    body: `Brilliant — here's the 3-minute BOSS Scorecard:
{{assessment_url}}

Take it when you can and tell me what stands out. No call needed to start.`,
    emailBody: `Hi {{first_name}},

Brilliant — here's the 3-minute BOSS Profit & Performance Scorecard:

{{assessment_url}}

It scores the business out of 100 and shows where profit, time or control may be leaking.

Take it when you can and tell me what stands out. No call needed to start.

Best,
{{coach_name}}`,
  },
  {
    id: "send-scorecard-dm",
    group: "scorecard",
    when: "Cold-ish LinkedIn DM scorecard offer",
    channel: "linkedin",
    body: `Hi {{first_name}},
I've created a 3-minute BOSS Profit & Performance Scorecard for {{company}} owners who want more profit, control and growth without everything depending on them.
It gives you a score out of 100 and shows what may be holding the business back.
If you want to have a go: {{assessment_url}}
Once you've completed it, you can also book a 30-minute {{review_name}} and I'll help you make sense of the results.`,
  },
  {
    id: "scorecard-no-book",
    group: "scorecard",
    when: "Took scorecard, didn't book",
    channel: "linkedin",
    body: `Hi {{first_name}},
I saw you completed the BOSS Scorecard — well done for taking the first step.
Your score should give a useful snapshot of where the business is strong and where it may be leaking profit, time or control.
If you'd like to go through it in more depth, I'm offering a 30-minute {{review_name}}. Would you like me to send a couple of times?`,
    emailBody: `Hi {{first_name}},

I saw you completed the BOSS Scorecard — well done for taking the first step.

Your score should give you a useful snapshot of where the business is strong and where it may be leaking profit, time or control.

If you'd like to go through it in more depth, I'm offering a 30-minute {{review_name}} where we'll look at your results and identify the first practical action I'd focus on.

Would you like me to send you a couple of times?

Best,
{{coach_name}}`,
  },
  {
    id: "scorecard-not-completed",
    group: "scorecard",
    when: "Sent scorecard, not completed yet",
    channel: "linkedin",
    body: `Hi {{first_name}},
Just giving this a gentle nudge.
The BOSS Scorecard only takes 3 minutes and gives you a quick score out of 100 across the key areas of your business.
Useful if you want to see where things could work even better and what to focus on first.
Here's the link again:
{{assessment_url}}`,
  },

  // ── Interest follow-up timeline ─────────────────────────────────────
  {
    id: "followup-day1",
    group: "follow_up",
    when: "Day 1 after interest — personalised nudge",
    channel: "linkedin",
    body: `Hi {{first_name}},
Following up on {{their_reply}} — still keen to explore this when you have a moment. Happy to work around your diary.`,
  },
  {
    id: "followup-day2",
    group: "follow_up",
    when: "Day 2 after interest",
    channel: "linkedin",
    body: `Hi {{first_name}},
Quick nudge on this. Still happy to jump on a short call about {{their_reply}} if useful.`,
  },
  {
    id: "followup-day3",
    group: "follow_up",
    when: "Day 3 — message only (no call)",
    channel: "linkedin",
    body: `Hi {{first_name}},
No rush — just leaving this here in case timing opens up around {{their_reply}}.`,
  },
  {
    id: "followup-day4",
    group: "follow_up",
    when: "Day 4 — last same-week call attempt",
    channel: "linkedin",
    body: `Hi {{first_name}},
Tried you again today. If a quick chat on {{their_reply}} would help, shout when's good.`,
  },
  {
    id: "final-ping-pong",
    group: "follow_up",
    when: "Final message (then long-term nurture)",
    channel: "linkedin",
    body: `Hi {{first_name}},
Rather than continue the answerphone ping pong, do let me know when's the best time to get hold of you, and I'll do my best to accommodate.`,
    emailBody: `Hi {{first_name}},

Rather than continue the answerphone ping pong, do let me know when's the best time to get hold of you, and I'll do my best to accommodate.

Best,
{{coach_name}}`,
  },

  // ── VIP 100 warm invites ────────────────────────────────────────────
  {
    id: "vip100-soft-a",
    group: "vip100",
    when: "VIP 100 Message 1 — soft invite A",
    channel: "linkedin",
    body: `Hi {{first_name}},
I've just launched a new 3-minute BOSS Scorecard for business owners who are doing well on paper, but feel stretched too thin behind the scenes.
It gives you a score out of 100 and shows where the business may be over-relying on you.
What do you reckon you'll score?
{{assessment_url}}`,
  },
  {
    id: "vip100-soft-b",
    group: "vip100",
    when: "VIP 100 Message 1 — soft invite B",
    channel: "linkedin",
    body: `Hi {{first_name}},
I've created a 3-minute BOSS Scorecard for business owners who are doing well on paper but feel stretched too thin.
It gives you a score out of 100 and shows where the business may be over-relying on you.
What do you reckon you'll score?
{{assessment_url}}`,
  },
  {
    id: "vip100-owner-dep",
    group: "vip100",
    when: "VIP 100 Message 2 — owner dependence",
    channel: "linkedin",
    body: `Hi {{first_name}},
Quick one — I've created a 3-minute BOSS Scorecard that shows how much the business may be relying on you across team, systems, sales, marketing and performance.
It gives you a score out of 100 and highlights what to focus on first.
Is this of interest?
{{assessment_url}}`,
  },
  {
    id: "vip100-90day",
    group: "vip100",
    when: "VIP 100 Message 3 — 90-day priority",
    channel: "linkedin",
    body: `Hi {{first_name}},
Most business owners are working hard, but not always on the highest-leverage priority.
The BOSS Scorecard takes 3 minutes and shows what could make the biggest difference over the next 90 days.
Here's the link if useful:
{{assessment_url}}
What do you reckon you'll score out of 100?`,
  },
  {
    id: "vip100-completed",
    group: "vip100",
    when: "VIP 100 — after they complete",
    channel: "linkedin",
    body: `Hi {{first_name}},
I saw you completed the BOSS Scorecard — thank you.
Your score gives a useful snapshot, but the real value is looking at what it means and what to focus on first.
You can book a complimentary 30-minute {{review_name}} and we'll identify one practical action to create more control, reduce owner dependence and improve performance.
Want me to send a couple of times?`,
  },

  // ── Nurture engagement responses ────────────────────────────────────
  {
    id: "nurture-yes-tool",
    group: "nurture_engage",
    when: "They say yes to a tool",
    channel: "linkedin",
    body: `Brilliant! Here's the link: {{assessment_url}}. Take 5 mins to fill it in and let me know what you discover. Most people are shocked by what they find.`,
  },
  {
    id: "nurture-question",
    group: "nurture_engage",
    when: "They ask a question",
    channel: "linkedin",
    body: `Great question. This is exactly the kind of thing we dig into in the {{review_name}}. Want to jump on a call and go deeper?`,
  },
  {
    id: "nurture-problem",
    group: "nurture_engage",
    when: "They share a problem",
    channel: "linkedin",
    body: `That's so common. Here's what most of my clients do to fix that — start with the BOSS Scorecard so you're fixing the most expensive constraint, not the loudest one: {{assessment_url}}
Want me to walk you through the results?`,
  },
  {
    id: "nurture-quiet-90",
    group: "nurture_engage",
    when: "Gone quiet after Day 90",
    channel: "linkedin",
    body: `No worries if the timing's not right. I'll check back in next quarter to see how things are going. Keep building!`,
  },
];

export function snippetsByGroup(
  group: ReplySnippetGroupId
): ReplyPlaybookSnippet[] {
  return REPLY_PLAYBOOK_SNIPPETS.filter((s) => s.group === group);
}

export function groupedReplySnippets(): Array<{
  id: ReplySnippetGroupId;
  label: string;
  description: string;
  snippets: ReplyPlaybookSnippet[];
}> {
  return REPLY_SNIPPET_GROUPS.map((g) => ({
    ...g,
    snippets: snippetsByGroup(g.id),
  })).filter((g) => g.snippets.length > 0);
}

/** Pick body for channel — email uses emailBody when present. */
export function snippetBodyForChannel(
  snippet: ReplyPlaybookSnippet,
  channel: ReplySnippetChannel | string | null | undefined
): string {
  if (channel === "email" && snippet.emailBody) return snippet.emailBody;
  return snippet.body;
}
