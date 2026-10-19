import type { CampaignStepInput } from "@/lib/unipile/campaigns";
import { defaultStepConfig } from "@/lib/unipile/campaignStepTypes";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";

const DAY0_TIMES = `Good to hear, {{first_name}}. The quickest way is a 20-minute look at where the business is leaking profit and what to fix first.

Would [day and time] or [day and time] work? If neither, send me two that do.`;

const DAY0_CALLED = `Hi {{first_name}}, I saw your message about [what they said] and tried to call. I called a couple of times and left you a message.

Happy to pick it up on a short call. Would [day and time] or [day and time] suit?`;

const DAY1_MESSAGE = `Hi {{first_name}},

Had another look at {{company}}: [one specific thing from their profile or website].

That's the sort of thing we unpack on a short call. When's a good time to grab 15 minutes?`;

const DAY2_MESSAGE = `Hi {{first_name}},

Tried you again just now. Still keen to pick up on what you said about [what they said].

If a quick call this week is useful, tell me a time that works and I'll fit in.`;

const DAY3_MESSAGE = `Hi {{first_name}},

No rush on a call, just didn't want what you said about [what they said] to sit unanswered.

If it's useful to talk, I'm around.`;

const FINAL_MESSAGE = `Hi {{first_name}},

Rather than continue the answerphone ping pong, do let me know when's the best time to get hold of you, and I'll do my best to accommodate.`;

function manualMessage(
  body: string,
  variants?: CampaignStepInput["variants"]
): Omit<CampaignStepInput, "position"> {
  const first = variants?.[0]?.body ?? body;
  return {
    step_type: "message",
    body: first,
    variants: variants ?? [],
    send_mode: "remind",
    fallback_hours: null,
    fallback_body: null,
    config: defaultStepConfig("message"),
  };
}

function callNow(notes: string): Omit<CampaignStepInput, "position"> {
  return {
    step_type: "call",
    body: notes,
    wait_hours: null,
    send_mode: "auto",
    config: { ...defaultStepConfig("call"), wait: false },
  };
}

function waitHours(hours: number): Omit<CampaignStepInput, "position"> {
  return { step_type: "wait", wait_hours: hours };
}

export const POSITIVE_REPLY_LIBRARY_SEED: CampaignLibrarySeed = {
  sourceKey: "positive-reply",
  itemType: "template",
  kind: "positive_reply",
  name: "Positive replies",
  previousNames: ["Positive reply"],
  description:
    "When they show interest: answer within the hour with two times to talk, call the same day, then a short manual call-and-message follow-up. After the last ping, move them into nurture.",
  status: "published" as const,
  steps: [
    callNow(
      "Day 0, within the hour: call now. Get their number from the LinkedIn profile, then try the company website. If they don't answer, leave a voicemail, then send the LinkedIn message straight after. Speed matters more than the words."
    ),
    manualMessage(DAY0_TIMES, [
      { key: "A", label: "Two times", body: DAY0_TIMES },
      { key: "B", label: "Called", body: DAY0_CALLED },
    ]),
    waitHours(4),
    callNow("Day 0: call again later the same day. Leave another voicemail if no answer."),
    waitHours(20),
    callNow("Day 1: call again. The number is on their profile or website if you have not got through yet."),
    manualMessage(DAY1_MESSAGE),
    waitHours(24),
    callNow("Day 2: call again."),
    manualMessage(DAY2_MESSAGE),
    waitHours(24),
    manualMessage(DAY3_MESSAGE),
    waitHours(24),
    callNow("Day 4: one more call. Then leave them for 5 to 7 days."),
    waitHours(144),
    callNow(
      "Final call. After this, move them into long-term nurture. Stop personal follow-up until they reply again."
    ),
    manualMessage(FINAL_MESSAGE),
    {
      step_type: "notify" as const,
      body: null,
      config: {
        ...defaultStepConfig("notify"),
        in_app: true,
        email: false,
        whatsapp: false,
      },
    },
  ],
};

export function positiveReplyLibrarySteps(): CampaignStepInput[] {
  return POSITIVE_REPLY_LIBRARY_SEED.steps.map((step, position) => ({
    ...step,
    position,
  }));
}
