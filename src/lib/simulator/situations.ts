import type { SimSituation, SimStage } from "./types";

/**
 * What a coach can practise. Every situation has five parts: the live bar
 * tracks them and the report scores each one out of 5. The POWER skills
 * (below) are scored on every session, so every report is out of 50.
 *
 * The COACH stages and POWER skills come from the Drive doc "AI Brain: COACH
 * Framework Assessment & Feedback Documentation". The four onboarding sessions
 * follow src/lib/practiceKnowledge/clientSessions.ts, so practice matches the
 * lessons. Sales calls live in the Call simulator (Get Clients → Scripts),
 * which builds on this one.
 */

function stage(id: string, label: string, aim: string, signs: string[], misses: string[], questions: string[]): SimStage {
  return { id, label, aim, signs, misses, questions };
}

const COACH_STAGES: SimSituation["stages"] = [
  stage(
    "change",
    "Change",
    "Find out what they want to change, and why it matters.",
    ["Asks directly what they want to change, using the word change", "Explores what happens if nothing changes", "Stops them jumping to solutions too early"],
    ["Accepts the first, surface answer", "Never asks what it costs them", "Lets them skip ahead to barriers or fixes"],
    ["What would you like to change?", "What's keeping you up at night?", "What happens if nothing changes in the next year?"]
  ),
  stage(
    "objective",
    "Objective",
    "Turn the change into a specific, measurable goal, with a time where it fits.",
    ["Gets a number and a date", "Asks what success looks like", "The goal comes from them, not the coach"],
    ["Settles for a vague goal like 'better profit'", "Suggests the goal for them", "Moves on before it's clear"],
    ["What would success look like?", "How would you measure that?", "By when?"]
  ),
  stage(
    "anchors",
    "Anchors",
    "Find everything holding them back: what stopped them before, what's in the way now, and what could get in the way later.",
    ["Asks about past, present and future barriers", "Digs into both practical and personal blocks", "Explores barriers mentioned in passing"],
    ["Skips straight to solutions", "Accepts the first barrier and moves on", "Misses the personal side"],
    ["What's stopped you so far?", "What's in the way right now?", "What might get in the way in future?"]
  ),
  stage(
    "choices",
    "Choices",
    "Brainstorm options with them. Quantity first, no judging yet.",
    ["Frames it as a brainstorm", "Says practicality doesn't matter yet", "Draws options out rather than offering them"],
    ["Suggests the answers", "Gets one option and stops", "Shows a favourite"],
    ["Let's brainstorm. What could you do?", "What else?", "If anything were possible, what would you try?"]
  ),
  stage(
    "how",
    "How",
    "Agree specific actions that tackle the barriers, with a date, and check commitment.",
    ["Actions link back to the barriers and the goal", "Gets a date and an owner", "Checks commitment, e.g. 'out of 10, how likely?'"],
    ["Accepts vague actions", "No date or follow-up", "Switches into selling instead of coaching"],
    ["What will you do first, and by when?", "Out of 10, how committed are you?", "What would make it a 10?"]
  ),
];

/** The POWER skills, scored on every session. */
export const POWER: SimStage[] = [
  stage(
    "questioning",
    "Powerful questions",
    "Open questions that challenge assumptions and help them find their own answers.",
    ["Questions build on what they just said", "Challenges assumptions", "Uses silence after a big question"],
    ["Closed or leading questions", "Several questions at once", "Rushes to the next question"],
    ["What assumptions are you making?", "What's really behind that?", "What would you do if you knew it would work?"]
  ),
  stage(
    "listening",
    "Listening",
    "Hear the detail, notice what isn't said, and go deeper on what matters.",
    ["Follows up on their exact words", "Notices hesitation or contradictions", "Stays with an important point"],
    ["Summarises without going deeper", "Misses emotional cues", "Jumps topic"],
    ["You said '...'. Tell me more about that.", "You paused there. What's behind that?"]
  ),
  stage(
    "workflow",
    "Session flow",
    "Run the session: a clear start, a sensible order, smooth moves between parts, and calm control.",
    ["Sets up the session and gets permission to challenge", "Moves between parts naturally", "Brings them back when they drift"],
    ["Jumps ahead before a part is done", "Lets the client run the session", "Too much small talk"],
    ["Here's how I'd like to use our time. Okay?", "Before we look at options, let's be clear on what's stopping you."]
  ),
  stage(
    "execution",
    "Next steps",
    "Leave with specific, dated actions, a commitment check, and a follow-up.",
    ["Specific, time-bound actions", "Checks and strengthens commitment", "Agrees how they'll be held to it"],
    ["Vague or undated actions", "Accepts a weak 'I'll try'", "No follow-up agreed"],
    ["By when will you do that?", "How will I know it's done?", "When shall we check in?"]
  ),
  stage(
    "rapport",
    "Rapport",
    "Warmth and trust, so they open up more as the session goes on.",
    ["Natural, warm tone", "Acknowledges feelings", "They share more as it goes on"],
    ["Formal or mechanical", "Rushed or pushy", "Judges what they say"],
    ["That sounds hard. How are you feeling about it?", "Thanks for being honest about that."]
  ),
];

export const SITUATIONS: SimSituation[] = [
  {
    id: "coaching",
    group: "coaching",
    title: "Coaching session",
    line: "Run a full session with the COACH method.",
    minutes: 20,
    coachAim: "Take the client from what they want to change to specific, committed actions, using the COACH method.",
    stages: COACH_STAGES,
    assessable: true,
  },
  {
    id: "session-1",
    group: "onboarding",
    title: "Session 1: Profit system and dashboard",
    line: "Their first session. Give value fast and find the urgent issue.",
    minutes: 25,
    coachAim: "Make the first session count: learn about them, score where they are against the ideal, place the profit system, dig into the key issue, and leave with a short plan of action.",
    stages: [
      stage("intro", "Introduction", "Welcome them, keep your own intro short, and find out what they want from today.", ["Short intro, then about them", "Asks what outcome they want from this session", "Introduces the coaching sheet"], ["Talks about themselves too long", "Skips their goal for the session"], ["Tell me a bit about yourself and how the business started.", "What do you want from today?"]),
      stage("ideal", "Ideal versus current", "Score profit and fun now, 1 to 5, then get a clear picture of the ideal.", ["Uses the 1 to 5 scores", "Gets a profit number and margin for the ideal", "Asks what fun looks like: hours and focus"], ["Accepts 'as much as possible'", "Never asks about fun"], ["Out of 5, how profitable is it now?", "How fun is it?", "What profit does the ideal business make in three years?"]),
      stage("system", "Profit system", "Show how the profit system bridges now and the ideal, and check it lands.", ["Brief and clear", "Checks understanding after each piece", "Asks what to tackle first"], ["Lectures", "Never checks it landed"], ["Which level do you think you're at, and why?", "What should we deal with first?"]),
      stage("issue", "The key issue", "Dig into the issue the dashboard shows, and its impact.", ["Asks what caused it", "Asks the impact on them, the business and the team", "Asks what's stopped them fixing it"], ["Fixes it for them", "Stays on the surface"], ["What do you think caused this?", "What impact is it having?", "What's stopping you resolving it?"]),
      stage("plan", "Plan of action", "A quick, high-level plan so they leave moving, with something done before next time.", ["Top three goals for three months", "Who helps and when", "One action before next session"], ["No action before next time", "Too much detail too soon"], ["What are the top three goals for the next three months?", "What can you do before we next meet?"]),
    ],
  },
  {
    id: "session-2",
    group: "onboarding",
    title: "Session 2: Leverage and the critical issue",
    line: "Make real progress on the urgent issue from session one.",
    minutes: 25,
    coachAim: "Check the tracking, go deep on the key issue, help them find the fix with the right tool, plan it, and set personal goals homework.",
    stages: [
      stage("open", "Open", "Check the tracking and actions from last time.", ["Asks how tracking went", "Checks the cash flow is up to date"], ["Skips the check-in"], ["How's the tracking going?", "Is the 13-week cash flow up to date?"]),
      stage("issue", "The key issue", "Stay on the main issue and recap what you know about it.", ["Recaps the impact", "Asks what's already been tried", "Asks what stops the business doubling"], ["Drifts to new topics"], ["What's improved, and what still needs fixing?", "What have you already tried?"]),
      stage("solve", "Solve it", "Pick the right tool and help them find the solution themselves.", ["Chooses a fitting tool, like COACH or more, better, new", "Asks how, not only why", "The solution comes from them"], ["Gives the answer", "Stays stuck in the problem"], ["What specific steps would get you past this?", "Who could help?"]),
      stage("plan", "Plan of action", "Set a goal for the issue, the actions, who does what, and dates.", ["Clear goal", "Owners and dates", "In the calendar"], ["Undated actions"], ["Who does what, by when?"]),
      stage("personal", "Personal goals and close", "Set personal goals homework and close well.", ["Asks them to think about personal goals", "Explains how next session uses them"], ["Forgets the homework"], ["Before next time, think about what you want personally in three to five years."]),
    ],
  },
  {
    id: "session-3",
    group: "onboarding",
    title: "Session 3: The three-year plan",
    line: "Start from the life they want and build the business to fit.",
    minutes: 25,
    coachAim: "Start from personal goals, connect them to what the business must produce, build the three-year picture, choose a few KPIs, and set homework.",
    stages: [
      stage("personal", "Personal goals", "Where do they want to be personally in three to five years?", ["Specific about life: income, time, family", "Draws on their homework"], ["Rushes past it"], ["Where do you want to be personally in three to five years?"]),
      stage("connect", "Connect the business", "What must the business produce to make that life possible?", ["Income, hours and flexibility in numbers"], ["No link to business numbers"], ["What does the business need to give you to make that happen?"]),
      stage("orbit", "Three-year picture", "Build the three-year picture across the segments, then break one into two-year and one-year steps.", ["Covers the segments", "Breaks one into steps", "Asks what structures must change"], ["Stays vague", "Does it for them"], ["In three years, what does profit and cash look like?", "What has to be true in year one?"]),
      stage("kpis", "KPIs", "Pick the three or four measures to track from now.", ["Keeps it to three or four", "Agrees to review them each session"], ["Tracks everything"], ["Which three numbers will tell us it's working?"]),
      stage("homework", "Homework", "Agree what they'll finish before next time.", ["Clear homework", "Explains next session turns it into 90 days"], ["No homework"], ["What will you finish before we next meet?"]),
    ],
  },
  {
    id: "session-4",
    group: "onboarding",
    title: "Session 4: The ninety-day plan",
    line: "Turn the long plan into three projects for this quarter.",
    minutes: 25,
    coachAim: "Turn the three-year plan into three projects for the next 90 days, each with a success measure, milestones, owners and dates, and agree accountability.",
    stages: [
      stage("idea", "The 90-day idea", "Explain why 90 days, and fit it to the calendar quarter.", ["Short, clear explanation"], ["Lectures"], ["Why do you think 90 days works better than a year?"]),
      stage("projects", "Three projects", "Name three projects as real work, not wishes.", ["Three, maybe four", "Named as work"], ["Too many", "Wishes like 'grow sales'"], ["Which three projects would move the three-year plan most this quarter?"]),
      stage("measures", "Success measures", "What does done look like in 90 days for each?", ["Measurable for each project"], ["Vague endings"], ["How will we know this project is done?"]),
      stage("actions", "Milestones and actions", "Break each project into milestones and actions, and cut what isn't essential.", ["Milestones, then actions", "Cuts non-essentials"], ["Endless lists"], ["What are the big steps? What's the first action?"]),
      stage("owners", "Owners and accountability", "Assign owners and dates, and agree how progress is reviewed.", ["Owner and date for each", "Reviewed every session", "Power Plan homework"], ["No owners", "No review"], ["Who owns this, and by when?", "How will we track it each session?"]),
    ],
  },
  {
    id: "distracted",
    group: "moments",
    title: "The distracted client",
    line: "They keep checking their phone and drifting off topic.",
    minutes: 10,
    coachAim: "Notice the distraction, name it kindly, find what's pulling them, and agree to focus or reschedule.",
    stages: [
      stage("notice", "Notice it", "Spot the signs early instead of pushing on.", ["Notices within a few minutes"], ["Ploughs on with the plan"], []),
      stage("name", "Name it kindly", "Say what you see, without blame.", ["Calm and curious", "Uses what they've seen"], ["Sounds annoyed", "Ignores it"], ["You seem a bit elsewhere today. What's going on?"]),
      stage("explore", "Find what's pulling them", "Find out what's on their mind.", ["Listens properly"], ["Brushes it aside"], ["What's on your mind right now?"]),
      stage("agree", "Agree the focus", "Decide together: deal with it, park it, or reschedule.", ["Gives them the choice", "Agrees a clear focus"], ["Decides for them"], ["Shall we deal with that first, or park it and focus for 30 minutes?"]),
      stage("back", "Back to work", "Get back to the session with their attention.", ["Clean restart", "Checks they're with you"], ["Never gets back on track"], ["Where were we, and what do you want from the rest of today?"]),
    ],
  },
  {
    id: "no-work",
    group: "moments",
    title: "They didn't do the work",
    line: "They agreed actions last time and haven't done them.",
    minutes: 10,
    coachAim: "Check in without blame, find what got in the way, help them own it, and reset the action with real accountability.",
    stages: [
      stage("check", "Check in", "Ask about the actions without judging.", ["Neutral, curious tone"], ["Tells them off", "Lets it slide"], ["How did you get on with what we agreed?"]),
      stage("block", "What got in the way", "Find the real reason, not the excuse.", ["Goes past the first excuse"], ["Accepts 'I was busy'"], ["What got in the way?", "What else?"]),
      stage("own", "Own it", "Help them see their part.", ["They say it themselves"], ["Lectures them"], ["What would you do differently?"]),
      stage("reset", "Reset the action", "Make the action smaller or clearer if needed.", ["Right-sized action", "Date"], ["Same action, same failure"], ["What's a version you'd actually do this week?"]),
      stage("hold", "Lock in accountability", "Agree how you'll hold them to it.", ["Agreed check-in", "Commitment score"], ["No follow-up"], ["How would you like me to hold you to this?"]),
    ],
  },
  {
    id: "pivot",
    group: "moments",
    title: "They want to change direction",
    line: "Mid-plan, they're excited about a new idea.",
    minutes: 10,
    coachAim: "Hear the idea, link it back to their goals, test it, help them decide, and protect the plan.",
    stages: [
      stage("hear", "Hear the idea", "Let them explain it fully.", ["Curious, not dismissive"], ["Shuts it down"], ["Tell me about it."]),
      stage("link", "Link it to the goal", "Check it against the goals they set.", ["Brings back their own goals"], ["Forgets the plan"], ["How does this help the goal you set for this year?"]),
      stage("test", "Test it", "Look at cost, time and what it replaces.", ["Asks what it would replace"], ["Takes it at face value"], ["What would you stop doing to make room?"]),
      stage("decide", "Decide", "They choose: now, later, or never.", ["Their decision"], ["Coach decides"], ["Now, later, or not at all?"]),
      stage("protect", "Protect the plan", "Make sure the current plan survives.", ["Agrees what happens to current actions"], ["Plan quietly dropped"], ["What happens to what we agreed last time?"]),
    ],
  },
  {
    id: "pause",
    group: "moments",
    title: "They want to pause or stop",
    line: "They say money's tight and want to stop coaching.",
    minutes: 10,
    coachAim: "Hear them out, find the real reason, show the progress so far, offer options, and agree the next step.",
    stages: [
      stage("hear", "Hear them out", "Let them say it all without jumping in.", ["Calm, no defending"], ["Gets defensive", "Panics"], ["Thanks for telling me. What's led to this?"]),
      stage("reason", "Find the real reason", "Money, time, results or something else?", ["Goes past the first reason"], ["Takes it at face value"], ["If money weren't an issue, would you carry on?"]),
      stage("progress", "Show the progress", "Remind them what's changed, in their numbers.", ["Uses their own results"], ["Vague claims"], ["Where were we when we started, and where are we now?"]),
      stage("options", "Offer options", "Pause, change the rhythm, or stop well.", ["Real options, no pressure"], ["Hard sell"], ["Would a lighter rhythm work for a few months?"]),
      stage("next", "Agree the next step", "A clear decision and what happens now.", ["Clear outcome", "Relationship intact"], ["Left hanging"], ["What would you like to do?"]),
    ],
  },
  {
    id: "blames-team",
    group: "moments",
    title: "They blame the team",
    line: "Nothing gets done because 'the team is useless'.",
    minutes: 10,
    coachAim: "Hear it, get specific, turn to what they control, choose an action, and commit.",
    stages: [
      stage("hear", "Hear it", "Let them vent, briefly.", ["Acknowledges the frustration"], ["Argues"], ["That sounds frustrating."]),
      stage("specific", "Get specific", "Which person, which task, what happened?", ["Moves from 'everyone' to one example"], ["Stays general"], ["Give me one example from this week."]),
      stage("own", "Their part", "What did they expect, and how was it set up?", ["Gently turns to their role"], ["Blames them", "Agrees the team is useless"], ["How clear was what you asked for?"]),
      stage("action", "Choose an action", "One change in how they lead.", ["Their idea"], ["Coach's idea"], ["What could you do differently with them?"]),
      stage("commit", "Commit", "Date and follow-up.", ["Date and check-in"], ["No follow-up"], ["When will you have that conversation?"]),
    ],
  },
  {
    id: "fee",
    group: "moments",
    title: "They question the fee",
    line: "At renewal, they ask if coaching is worth the money.",
    minutes: 10,
    coachAim: "Hear the concern, find what's behind it, show the value in their own numbers, and agree what happens next.",
    stages: [
      stage("hear", "Hear it", "Let them say it without defending.", ["Calm and open"], ["Defensive"], ["That's a fair question. What's prompted it?"]),
      stage("behind", "What's behind it", "Cash, results, or doubt?", ["Finds the real worry"], ["Assumes it's price"], ["What would make it clearly worth it?"]),
      stage("value", "Show the value", "Use their own numbers and wins.", ["Specific results", "In pounds"], ["Generic claims"], ["What's changed in profit since we started?"]),
      stage("choose", "Let them choose", "Their decision, with no pressure.", ["Options laid out"], ["Pushy"], ["What would you like to do?"]),
      stage("agree", "Agree the next step", "Clear outcome.", ["Clear and warm"], ["Vague"], ["So we're agreed: ..."]),
    ],
  },
  {
    id: "follow-up",
    group: "follow-up",
    title: "Follow-up session",
    line: "Pick up from last time. Did they do what they agreed?",
    minutes: 20,
    coachAim: "Check in and find wins, review what was agreed, learn from what got in the way, reset, and agree the next actions.",
    needsPrevious: true,
    stages: [
      stage("checkin", "Check-in and wins", "Start positive and see where they are.", ["Asks about wins first"], ["Jumps straight to actions"], ["What's gone well since we last spoke?"]),
      stage("review", "Review the actions", "Go through what was agreed, one by one.", ["Specific about each action"], ["Skips the review"], ["Last time you said you'd ... How did that go?"]),
      stage("learn", "What got in the way", "Learn from what didn't happen.", ["Curious, not blaming", "Finds the real block"], ["Accepts excuses"], ["What got in the way?"]),
      stage("reset", "Reset", "Recommit, change the action, or choose a new focus, on purpose.", ["A clear choice"], ["Drifts to a new topic by accident"], ["Is this still the priority?"]),
      stage("next", "Next actions", "Dated actions and a commitment check.", ["Dated, owned, checked"], ["Vague"], ["What will you do by next time?"]),
    ],
  },
];

export const SITUATION_GROUPS: { id: SimSituation["group"]; title: string }[] = [
  { id: "coaching", title: "Coaching" },
  { id: "onboarding", title: "First four sessions" },
  { id: "moments", title: "Tricky moments" },
  { id: "follow-up", title: "Follow-up" },
];

export function situationById(id: string): SimSituation | null {
  return SITUATIONS.find((s) => s.id === id) ?? null;
}
