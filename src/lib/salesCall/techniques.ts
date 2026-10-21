import { type Block, h, note, say, they } from "./blocks";

/**
 * Skills the script names but doesn't explain in place, like "confidence
 * loop". Wherever the words appear in the script they open a short explainer,
 * so the coach can check what it means without leaving the call.
 */

export type TechniqueId = "confidence-loop";

export type Technique = {
  id: TechniqueId;
  name: string;
  summary: string;
  /** Matches the words in the script that open this explainer. */
  match: RegExp;
  blocks: Block[];
  /** Zander's explainer video, once it's recorded. */
  video?: { src: string; poster?: string };
};

export const TECHNIQUES: Technique[] = [
  {
    id: "confidence-loop",
    name: "Confidence looping",
    summary: "After every answer, tie it straight back to what they told you they want.",
    match: /confidence[- ]loop(?:ing|s)?/i,
    video: { src: "/tutorials/confidence-looping.mp4", poster: "/tutorials/confidence-looping-poster.jpg" },
    blocks: [
      note("When you answer a question or show them something, finish by linking it to their result, their problem or their why. It turns a feature into a reason to say yes."),
      note("One loop does very little. Done after every answer, from the pitch all the way to the investment, it builds their certainty minute by minute."),
      h("How to do it"),
      note("Three moves, every time."),
      note("1. Answer the question. Keep it short and clear."),
      note("2. Loop it back: \"Which means…\", then their result in their words."),
      note("3. Check it landed: \"Can you see how that gets you to {result}?\""),
      h("Answering a question"),
      they("\"Do you have a process to help me sort out the team?\""),
      note("Explain it in two or three lines, then loop:"),
      say("And that's what buys back your time, which is what gets you to {result}. Does that make sense?"),
      h("After you show them something"),
      note("You've just walked them through a dashboard or a client plan."),
      say("Can you see how that gives you clarity on the numbers every day? And that's what gets you to {result}."),
      h("When you share the investment"),
      say("For that, you're getting [what working with you includes]. All of it is there to get you to {result}."),
      h("Watch out"),
      note("Don't start coaching on the call. Show them you have the plan and the tools. The coaching starts once they've signed."),
      note("Keep answers short. Two or three minutes on one point and you've lost them."),
      note("Listen to how they answer the check. \"Yeah, probably\" isn't a yes. Ask what makes them say probably."),
    ],
  },
];

export function techniqueById(id: string): Technique | null {
  return TECHNIQUES.find((t) => t.id === id) ?? null;
}
