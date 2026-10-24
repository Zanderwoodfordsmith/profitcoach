import type { Difficulty, PushbackKind } from "./types";

export const DIFFICULTIES: { id: Difficulty; label: string; line: string; rules: string }[] = [
  {
    id: "easy",
    label: "Easy",
    line: "Open and willing. Good for learning the steps.",
    rules: `You are open and willing. Your personality still shows, but only lightly and now and then, and it fades as soon as the coach asks a good question.
- Answer clearly. Give a fact as soon as a question gets near it.
- Accept a challenge. If the coach asks a good question, think about it out loud.
- Push back once or twice in the whole session, gently.
- When asked to commit, give a specific action and a date.`,
  },
  {
    id: "medium",
    label: "Medium",
    line: "Some 'yes, but'. Needs help to get specific.",
    rules: `You need a bit of work. Your personality shows regularly, but a good question or real listening moves you. You're realistic, not difficult.
- Give a fact only when a question is specific. A general question gets a general answer.
- Be vague about what you want until the coach helps you make it specific.
- Use some "yes, but" answers, and change the subject once or twice when it gets uncomfortable.
- Hesitate to commit to dates. Commit if the coach checks your commitment well.
- Open up when the coach listens closely and asks good follow-up questions.`,
  },
  {
    id: "hard",
    label: "Hard",
    line: "Guarded and resistant. Opens up only to real skill.",
    rules: `You are hard work. Your personality shows strongly and often, whoever you are.
- Use the strong version of your pushback, often.
- Give a fact only when a question is precise, and play it down at first.
- Keep your goal vague. Commit weakly ("I'll think about it") unless the coach truly earns more.
- If the coach gives advice or tells you what to do, push back harder.
- Open up only after two or three really good questions, or real empathy. Then open a little at a time.
- If the coach keeps coaching well, show grudging respect and a clearer head by the end.`,
  },
];

export function difficultyById(id: string): (typeof DIFFICULTIES)[number] | null {
  return DIFFICULTIES.find((d) => d.id === id) ?? null;
}

/**
 * How to handle each kind of pushback. Shown in the tips panel on every
 * level, and fed to the live tip so it explains, not just prompts.
 */
export const PUSHBACK_HELP: Record<PushbackKind, { title: string; help: string; try: string[] }> = {
  "blaming-outside": {
    title: "When they blame outside forces",
    help: "Don't argue with the market. Agree the pressure is real, then turn to what is in their control. Facts beat opinions, so ask for their numbers.",
    try: ["If the market stays exactly like this, what could you change?", "What's one thing inside the business you haven't tried yet?", "How do you set your prices today?"],
  },
  overwhelm: {
    title: "When they're overwhelmed",
    help: "Slow down. Reflect back that there's a lot going on, then help them choose one thing. Short, simple questions work best.",
    try: ["If you could only fix one of these this year, which one?", "Which part keeps you up at night?", "What do you already know you need to do?"],
  },
  legacy: {
    title: "When they protect the past",
    help: "Respect what's been built. Ask what the founder would do today, and separate what must stay from what's just habit.",
    try: ["What would your grandad do if he started today?", "What has to stay, and what's just how it's always been done?", "What's the risk of standing still?"],
  },
  controller: {
    title: "When they won't let go",
    help: "Admire what works, then ask how it could work without them. Help them see themselves as the bottleneck.",
    try: ["What do you do differently that the others don't?", "If you were away for a month, what would happen?", "What would it take for someone else to do it your way?"],
  },
  "fix-everything": {
    title: "When they want to fix everything at once",
    help: "Acknowledge the analysis, then ask them to rank. Look for the one fix that makes the others easier.",
    try: ["If you fixed one first, which would make the others easier?", "Which of these costs you the most?", "What would you stop doing?"],
  },
  "too-busy": {
    title: "When they're too busy to change",
    help: "Busy people need the cost of staying busy made real. Ask about the hours and what they're missing, then keep the first step tiny.",
    try: ["What does working 70 hours cost you?", "What only you can do, and what could someone else do?", "What's the smallest thing you could hand over this week?"],
  },
  "shiny-object": {
    title: "When they chase the next idea",
    help: "Enjoy the energy, then bring them back to the goal. Ask what the new idea replaces, and what finishing the current thing is worth.",
    try: ["How does that help the goal you set?", "What would it be worth to fix what you have first?", "Which one thing will you finish this month?"],
  },
};
