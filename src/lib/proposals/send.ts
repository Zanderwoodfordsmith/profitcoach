import { proposalPath } from "./types";

function appBase(): string {
  return (process.env.APP_BASE_URL || "https://app.theprofitcoach.com").replace(/\/$/, "");
}

export function proposalUrl(token: string): string {
  return `${appBase()}${proposalPath(token)}`;
}

/** The covering email a coach starts from; they can change every word. */
export function defaultProposalEmail(input: { prospectName: string; prospectBusiness: string | null; coachName: string; url: string }) {
  const first = input.prospectName.trim().split(/\s+/)[0] || "there";
  const coachFirst = input.coachName.trim().split(/\s+/)[0] || input.coachName;
  return {
    subject: `Your proposal${input.prospectBusiness ? ` for ${input.prospectBusiness}` : ""}`,
    message: [
      `Hi ${first},`,
      `Thanks for your time on our call. Here's the proposal we talked about:`,
      input.url,
      `It sets out the plan, the price and what happens next. When you're happy, you can accept it at the bottom of the page.`,
      `Any questions, just reply to this email.`,
      coachFirst,
    ].join("\n\n"),
  };
}
