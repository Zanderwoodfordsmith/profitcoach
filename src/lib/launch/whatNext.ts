/**
 * What Ava tells a coach once BCA releases a page to them (16 Nov): what's
 * ready, what to do, and what happens after. BCA reads it and presses Send;
 * it goes into the page's chat and by email. Null for pages the coach
 * doesn't check (About You's voice guide is for the writers only).
 */
const MESSAGES: Record<string, (first: string) => string> = {
  market: (first) =>
    `Hi ${first}, your Ideal Client is ready to check on your Blueprint. It's the one owner every message is written to, and who goes on your prospect list. Have a read, change anything that's off, then press Sign off this page. Once it's signed off, we write your messages and build your list.`,
  offer: (first) =>
    `Hi ${first}, your offer is ready to check: what you help with, how you deliver it, and your price. We've drafted the words, so change the numbers to suit you, then press Sign off this page.`,
  linkedin: (first) =>
    `Hi ${first}, your new LinkedIn profile is ready on your Blueprint. Read it, change anything that doesn't sound like you, then copy each part across to LinkedIn. Press Sign off this page once it's live.`,
  campaigns: (first) =>
    `Hi ${first}, your first messages are ready to check: the connection request and the follow-ups that go out in your name. Read them as if you were the owner getting them, change anything that's off, then press Sign off this page and we'll get your campaign running.`,
  content: (first) =>
    `Hi ${first}, your first posts and newsletter are ready on your Blueprint. Have a read, change anything that doesn't sound like you, then press Sign off this page.`,
  sales: (first) =>
    `Hi ${first}, your personalised pitch is ready: what to say on a call with an owner. Read it out loud once, change anything that doesn't sound like you, then press Sign off this page.`,
};

export function whatNextMessage(slug: string, first: string): string | null {
  return MESSAGES[slug]?.(first) ?? null;
}
