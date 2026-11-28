/**
 * The coach journey (Customer Activation Ramp, job 317): every moment from
 * payment to month 7, as swimlanes. Admin only for now. Shown at
 * Admin → Coaches → Journey; the reasoning is in coachJourneyNotes.ts.
 *
 * Moments fire on triggers (something happens, or doesn't by a target day),
 * not on a fixed calendar. "L" in a target means days after launch (the
 * coach's first invite or campaign send). Days without L count from joining.
 *
 * Status is what the app does today: live, partly built, or to build.
 * Builds on the 31 Oct launch playbook (Coaches live project brief).
 */

export type JourneyLane = "coach" | "ava" | "bca" | "system";
export type BuildStatus = "live" | "partly" | "build";
export type MomentKind = "event" | "check" | "rhythm";

export type LaneStep = {
  text: string;
  /** Where it reaches the coach: App, WhatsApp, Email, Call. */
  channel?: string;
  /** Draft wording, for steps that send a message. */
  message?: string;
  status: BuildStatus;
};

export type JourneyPhase = {
  id: string;
  name: string;
  when: string;
  /** What finished looks like for this phase. */
  goal: string;
};

export type JourneyMoment = {
  id: string;
  phase: string;
  title: string;
  trigger: string;
  target: string;
  kind: MomentKind;
  /** How we want the coach to feel, in their words. */
  feel: string;
  lanes: Partial<Record<JourneyLane, LaneStep>>;
  /** Why this moment exists, and where the idea comes from. */
  why?: string;
  /** Short label when this is the phase's big milestone (shown on the journey picture). */
  milestone?: string;
};

export const JOURNEY_LANES: { id: JourneyLane; label: string; hint: string }[] = [
  { id: "coach", label: "Coach", hint: "What the coach does" },
  { id: "ava", label: "Ava and messages", hint: "What the coach sees or hears from us" },
  { id: "bca", label: "BCA team", hint: "Behind the scenes: Zander now, an account manager later" },
  { id: "system", label: "System", hint: "What the app does by itself" },
];

export const BUILD_STATUS_LABEL: Record<BuildStatus, string> = {
  live: "Live",
  partly: "Partly built",
  build: "To build",
};

export const MOMENT_KIND_LABEL: Record<MomentKind, string> = {
  event: "When it happens",
  check: "If it hasn't happened",
  rhythm: "Regular",
};

export const JOURNEY_PHASES: JourneyPhase[] = [
  { id: "welcome", name: "Welcome", when: "First hour", goal: "They feel they made a good decision and know their three jobs." },
  { id: "setup", name: "Set up", when: "Days 0 to 3", goal: "About You done, LinkedIn and Sales Navigator connected, kickoff held." },
  { id: "build", name: "Build", when: "Days 3 to 14", goal: "Everything drafted, checked by the coach once, ready to go." },
  { id: "launch", name: "Launch", when: "Day 14 (we promise 30)", goal: "All four campaigns sending, posts and newsletter 1 out." },
  { id: "warmup", name: "Warm-up", when: "Launch to L+30", goal: "First interested replies, answered within hours." },
  { id: "conversations", name: "Conversations", when: "L+30 to L+60", goal: "First booked Constraint Call." },
  { id: "client", name: "First client", when: "L+60 to L+90", goal: "First paying client." },
  { id: "own", name: "Own it", when: "About day 100 to 120", goal: "They see what we built, choose what's next, and the first bill feels fair." },
  { id: "keep", name: "Keep going", when: "Months 5 to 7", goal: "A result every 3 months; anyone drifting is caught a month early." },
];

export const JOURNEY_MOMENTS: JourneyMoment[] = [
  // Welcome
  {
    id: "paid",
    milestone: "They join",
    phase: "welcome",
    title: "They join",
    trigger: "Payment goes through",
    target: "Minutes",
    kind: "event",
    feel: "I made a good decision.",
    lanes: {
      coach: { text: "Reads the welcome and books their kickoff call.", status: "partly" },
      ava: {
        text: "Welcome from Zander that fits one phone screen: what we build for them, when, and their three jobs.",
        channel: "WhatsApp and Email",
        message:
          "Welcome to BCA, {first}. Over the next 14 days we build your practice for you: your LinkedIn profile, your lists of owners, your campaigns, newsletters and posts. Your part today takes about 45 minutes. Book your kickoff call, talk to Ava about you, and connect LinkedIn. The links are on your Home. Zander, BCA",
        status: "partly",
      },
      bca: { text: "New coach shows on Launches. Nothing to do yet.", status: "live" },
      system: {
        text: "Account, Blueprint and message threads set up; LinkedIn and past call notes pulled in. Welcome sent from the app, not by hand.",
        status: "partly",
      },
    },
    why: "Buyer's remorse peaks in the first days (Weber, Josh's month 0 to 1 cliff). A named person and a clear next step calm it. Today the app sends no welcome on payment.",
  },
  {
    id: "home",
    phase: "welcome",
    title: "First look at Home",
    trigger: "First login",
    target: "Day 0",
    kind: "event",
    feel: "They're already on it.",
    lanes: {
      coach: { text: "Sees their build tracker and the three things to do.", status: "partly" },
      ava: { text: "Home greets them by name and points at the first job only.", channel: "App", status: "partly" },
      system: {
        text: "Build tracker starts ahead: paid, account set up and Blueprint started from LinkedIn are already ticked. Six named stages, each with who is on it and the expected date.",
        status: "build",
      },
    },
    why: "Progress that starts above zero gets finished more often (Nunes and Drèze, car wash cards). Trackers like Domino's work because each step has a name and the current one is lit. The setup bar exists today; the tracker doesn't.",
  },

  // Set up
  {
    id: "about-you",
    phase: "setup",
    title: "About You with Ava",
    trigger: "Coach opens About You",
    target: "Day 2",
    kind: "event",
    feel: "That was easy. She gets me.",
    lanes: {
      coach: { text: "Talks to Ava for about 30 minutes, by voice or typing.", status: "live" },
      ava: { text: "Asks the questions, spots gaps, says what she'll do with the answers.", channel: "App", status: "live" },
      system: { text: "Setup bar shows one need at a time until About You is done.", status: "live" },
    },
  },
  {
    id: "kickoff",
    milestone: "Kickoff call",
    phase: "setup",
    title: "Kickoff call",
    trigger: "Booked from the welcome",
    target: "Within 72 hours",
    kind: "event",
    feel: "These people are serious. I know what happens and when.",
    lanes: {
      coach: { text: "Joins the call. Connects LinkedIn, calendar and Sales Navigator during it.", channel: "Call", status: "partly" },
      ava: {
        text: "After the call: a short summary with dates, what we do next, and what we need from them.",
        channel: "WhatsApp and Email",
        status: "build",
      },
      bca: {
        text: "Runs the call: dates and when results come (under-promise: warm-up is slow), confirm market and offer, connect everything together, show Home. The wow: Ava shows how many owners near them match, with real names.",
        status: "partly",
      },
      system: { text: "Live owner count from Sales Navigator as soon as LinkedIn connects.", status: "partly" },
    },
    why: "A mismanaged kickoff is the top onboarding mistake (ZenPilot). Josh: no teaching on calls; orient, set the quest, show the road. Job 174 decides one-to-one or a weekly group kickoff (Jay Wright runs 15 to 30 at once).",
  },
  {
    id: "keys-done",
    phase: "setup",
    title: "Three keys done",
    trigger: "About You, LinkedIn and Sales Navigator all done",
    target: "Day 3",
    kind: "event",
    feel: "My part's done. Now they build.",
    lanes: {
      ava: {
        text: "Thanks them and says the build has started and where to watch it.",
        channel: "App and WhatsApp",
        message: "That's everything we need, {first}. Your build starts now. You'll see each piece appear on your Home as we finish it.",
        status: "build",
      },
      system: { text: "Starts Ava's launch chain by itself.", status: "live" },
    },
  },
  {
    id: "keys-late",
    phase: "setup",
    title: "Keys not done",
    trigger: "Any of the three keys missing",
    target: "Day 3",
    kind: "check",
    feel: "A friendly push, not nagging.",
    lanes: {
      ava: {
        text: "One nudge naming the one missing thing and how long it takes. At most one a day, never in quiet hours.",
        channel: "App and WhatsApp",
        status: "partly",
      },
      bca: { text: "After two nudges with no movement it turns red. A personal message from Zander.", status: "partly" },
      system: { text: "Coach health flags them (Not logging in, LinkedIn not connected).", status: "live" },
    },
    why: "Job 173 (Ava chases nicely) is this moment.",
  },

  // Build
  {
    id: "drafts",
    phase: "build",
    title: "Ava drafts the build",
    trigger: "Three keys done",
    target: "Days 3 to 8",
    kind: "event",
    feel: "I can see the work happening.",
    lanes: {
      coach: { text: "Nothing to do. Watches pieces appear.", status: "partly" },
      ava: {
        text: "Drafts in order: ideal client, voice, market, LinkedIn profile, prospect lists, the four campaigns, six newsletters, 12 weeks of posts, proof stories where they exist.",
        status: "partly",
      },
      bca: { text: "Checks each draft in To check and releases it.", status: "live" },
      system: {
        text: "Shows the work as it happens: \"Ava found 2,340 owners\", \"wrote 36 posts\". Connections import, with Connected owners to pick VIPs from; the coach tags VIP and Referral.",
        status: "build",
      },
    },
    why: "People value the same result more when they see the work (Buell and Norton). Profile, lists and the Connect campaign are drafted today; VIP, Referral, Interested, newsletters and posts are not in the chain yet.",
  },
  {
    id: "build-update",
    phase: "build",
    title: "Weekly build update",
    trigger: "Every Friday until launch",
    target: "Weekly",
    kind: "rhythm",
    feel: "I always know where things are.",
    lanes: {
      ava: {
        text: "Three lines: done this week, next, what we need from you.",
        channel: "WhatsApp and Email",
        message: "Your build this week, {first}. Done: your profile and two lists of owners. Next: your campaigns and first newsletter. From you: nothing yet. We'll shout when it's your turn.",
        status: "build",
      },
    },
    why: "Waiting with no news feels longest (Maister). One steady rhythm on top of the event messages.",
  },
  {
    id: "profile",
    milestone: "Profile live",
    phase: "build",
    title: "Profile ready",
    trigger: "Profile released",
    target: "Day 6",
    kind: "event",
    feel: "That's me, but better.",
    lanes: {
      coach: { text: "Copies it onto LinkedIn (about 10 minutes).", status: "live" },
      ava: { text: "Says it's ready, with copy buttons for each part.", channel: "App and WhatsApp", status: "partly" },
      system: { text: "Checks the live LinkedIn headline matches.", status: "build" },
    },
    why: "The first visible win. It goes live before any invites, because people click the profile.",
  },
  {
    id: "check",
    phase: "build",
    title: "Check session",
    trigger: "Everything released",
    target: "Day 8",
    kind: "event",
    feel: "It sounds like me. I'm ready.",
    lanes: {
      coach: {
        text: "One sitting, about 45 minutes: the prospect lists, the connection note, VIP and Referral notes, newsletter 1, the first 4 weeks of posts. Asks for changes in the page chat.",
        status: "partly",
      },
      ava: { text: "Walks them through each piece in order, one at a time.", channel: "App", status: "build" },
      bca: { text: "Makes changes within one working day.", status: "partly" },
    },
    why: "One check for the coach, a run of switch-ons for us. Every action we give them gets finished (Josh: \"catch the goanna\").",
  },
  {
    id: "check-late",
    phase: "build",
    title: "Not checked",
    trigger: "Check session not done",
    target: "Day 10",
    kind: "check",
    feel: "They're making it easy for me.",
    lanes: {
      ava: { text: "Offers a 15-minute launch call to do it together.", channel: "WhatsApp", status: "partly" },
      bca: { text: "Runs the launch call when booked.", channel: "Call", status: "partly" },
    },
  },

  // Launch
  {
    id: "live",
    milestone: "You're live",
    phase: "launch",
    title: "You're live",
    trigger: "Coach signs off, BCA presses go",
    target: "Day 14",
    kind: "event",
    feel: "I'm live. This is real.",
    lanes: {
      coach: { text: "Posts a hello in the community Intros channel.", status: "live" },
      ava: {
        text: "Celebrates, says what happens next and that the first weeks are quiet on purpose. Turns on reply alerts.",
        channel: "WhatsApp and App",
        message:
          "You're live, {first}. Your campaigns are sending and your first newsletter is out. The first few weeks send fewer invites while LinkedIn gets used to your account, so a quiet start is normal. Replies usually start in week one or two. I'll tell you the moment someone's interested.",
        status: "build",
      },
      bca: { text: "Presses go on all four campaigns.", status: "partly" },
      system: { text: "Connect, VIP, Referral (if they want it) and Interested on; posts scheduled; launch date saved.", status: "partly" },
    },
    why: "A peak moment (peak-end rule). Launch date is the first invite or send (job 314).",
  },

  // Warm-up
  {
    id: "accepts",
    phase: "warmup",
    title: "First accepts",
    trigger: "10 people accept",
    target: "Week 1",
    kind: "event",
    feel: "It's working.",
    lanes: {
      coach: { text: "Optional: likes or comments on a few of their posts.", status: "build" },
      ava: {
        text: "Shows who accepted.",
        channel: "App",
        message: "10 owners accepted your invite this week, {first}. Here they are.",
        status: "build",
      },
    },
  },
  {
    id: "week1-questions",
    phase: "warmup",
    title: "Week 1 questions",
    trigger: "7 days after launch",
    target: "L+7",
    kind: "rhythm",
    feel: "Everyone wonders this. I'm normal.",
    lanes: {
      ava: {
        text: "Answers the five questions every coach has now: Is it working? Why so few invites? What do I say if someone replies? Should I post more? What if someone I know sees it?",
        channel: "App and Email",
        status: "build",
      },
    },
    why: "Josh's top-5 questions: answer them before they're asked and people feel they belong. Help answers cover some of these today.",
  },
  {
    id: "first-reply",
    milestone: "First reply",
    phase: "warmup",
    title: "First interested reply",
    trigger: "Someone says yes, or finishes the BOSS Score",
    target: "By L+30",
    kind: "event",
    feel: "Someone wants to talk to me!",
    lanes: {
      coach: { text: "Replies within a few hours, using Ava's draft if they like.", status: "live" },
      ava: { text: "Alerts their phone within minutes with a draft reply that offers two times. Celebrates after.", channel: "WhatsApp", status: "live" },
      bca: { text: "Shares it in the Wins channel (with their OK).", status: "build" },
      system: { text: "Interested follow-up starts for that person: one question, booking link, reminders, 7-day follow-up.", status: "build" },
    },
    why: "The breakthrough. Josh: they must feel the promise for real in the first month. Alerts and drafts exist; the Interested campaign doesn't yet.",
  },
  {
    id: "reply-waiting",
    phase: "warmup",
    title: "Reply waiting",
    trigger: "Interested person waiting 4 hours",
    target: "Any time",
    kind: "check",
    feel: "Glad they caught that.",
    lanes: {
      ava: { text: "Nudges the coach with the draft ready to send.", channel: "WhatsApp", status: "partly" },
      bca: { text: "Waiting 24 hours turns red for BCA.", status: "build" },
      system: { text: "Coach health: Slow replies.", status: "live" },
    },
  },
  {
    id: "no-interest",
    phase: "warmup",
    title: "No interest yet",
    trigger: "Nobody interested",
    target: "L+14",
    kind: "check",
    feel: "Worried, then reassured: they're on it.",
    lanes: {
      ava: { text: "Drafts a nudge for BCA to approve: quiet starts are normal, offer to sharpen the note.", channel: "App", status: "live" },
      bca: { text: "Checks who accepts and what they say; sharpens the note or tries a warmer list.", status: "partly" },
      system: { text: "Coach health flags: No interest 14 days after launch.", status: "live" },
    },
    why: "Built 28 Nov (job 314).",
  },
  {
    id: "day30",
    phase: "warmup",
    title: "Day 30 check-in",
    trigger: "30 days after joining",
    target: "Day 30",
    kind: "rhythm",
    feel: "Better than before I joined.",
    lanes: {
      coach: { text: "Answers two quick questions.", status: "build" },
      ava: {
        text: "\"How's it going, 1 to 10?\" and \"Compare the last 30 days with the 30 before you joined.\"",
        channel: "WhatsApp",
        status: "build",
      },
      bca: { text: "6 or below gets a call from Zander.", status: "build" },
    },
    why: "Josh's reflection question: most say 100 to 200% better, which reminds them life before was worse. The playbook also asks 1 to 10 on day 7.",
  },

  // Conversations
  {
    id: "booked",
    milestone: "First call",
    phase: "conversations",
    title: "First booked call",
    trigger: "A Constraint Call is booked",
    target: "By L+60",
    kind: "event",
    feel: "This is happening. I'm ready.",
    lanes: {
      coach: { text: "Reads the prep, optional 15 minutes on the call simulator, takes the call.", status: "partly" },
      ava: {
        text: "Celebrates and sends a prep pack: who they are, their company, what they said. Suggests the simulator, never required.",
        channel: "WhatsApp and App",
        status: "build",
      },
      system: { text: "Reminders to the owner before the call.", status: "live" },
    },
  },
  {
    id: "after-call",
    phase: "conversations",
    title: "After the call",
    trigger: "Call time passes",
    target: "Same day",
    kind: "event",
    feel: "I know what to do next.",
    lanes: {
      coach: { text: "One tap: follow-up booked, proposal, not a fit, or no-show.", status: "build" },
      ava: { text: "Asks how it went; offers help with the next step.", channel: "WhatsApp", status: "build" },
      system: { text: "Pipeline updates. A no-show goes back into the Interested follow-up to rebook.", status: "build" },
    },
    why: "Also gives us the call, show and close numbers the Scoreboard can't track yet (job 198).",
  },
  {
    id: "recontact",
    phase: "conversations",
    title: "Monthly re-contact",
    trigger: "Once a month from L+30",
    target: "Monthly",
    kind: "rhythm",
    feel: "Old leads come back to life.",
    lanes: {
      ava: { text: "Drafts a fresh message for people who finished the BOSS Score but didn't book, no-shows and quiet chats.", status: "build" },
      system: { text: "Builds the list each month and runs it like a campaign.", status: "build" },
    },
  },
  {
    id: "no-call",
    phase: "conversations",
    title: "No booked call",
    trigger: "No Constraint Call booked",
    target: "L+60",
    kind: "check",
    feel: "Someone has my back.",
    lanes: {
      bca: {
        text: "A call with a likely cause and a plan: the list, the message, or how they answer replies. Product or driver.",
        channel: "Call",
        status: "build",
      },
      system: { text: "Turns red on Launches.", status: "build" },
    },
    why: "Murphy: as soon as someone will miss first value, find the cause and agree a plan. Josh: it's the product or the driver.",
  },

  // First client
  {
    id: "content-2",
    phase: "client",
    title: "Next batch of content",
    trigger: "10 weeks after launch",
    target: "L+70",
    kind: "event",
    feel: "Still taken care of.",
    lanes: {
      ava: { text: "Drafts 12 more weeks of posts and newsletters 7 to 12, using what got replies.", status: "build" },
      coach: { text: "Checks them in one sitting.", status: "build" },
    },
  },
  {
    id: "first-client",
    milestone: "First client",
    phase: "client",
    title: "First client",
    trigger: "A contact becomes a client",
    target: "By L+90",
    kind: "event",
    feel: "I can do this.",
    lanes: {
      coach: { text: "Signs them and starts Sessions 1 to 4.", status: "live" },
      ava: { text: "Big celebration; points to the Keep Clients welcome pack and agreement.", channel: "WhatsApp and App", status: "build" },
      bca: { text: "Shares it in the Wins channel. Asks for a short story we can use.", status: "build" },
    },
    why: "Keep Clients welcome pack and agreement are agreed but not built.",
  },
  {
    id: "no-client",
    phase: "client",
    title: "No client yet",
    trigger: "No paying client",
    target: "L+90",
    kind: "check",
    feel: "Honest, and still on my side.",
    lanes: {
      bca: { text: "Review call: list, offer, calls. Agree a 30-day plan.", channel: "Call", status: "build" },
    },
  },

  // Own it
  {
    id: "review",
    milestone: "Results review",
    phase: "own",
    title: "Results review",
    trigger: "About day 100",
    target: "Day 100",
    kind: "event",
    feel: "Look how much has happened.",
    lanes: {
      coach: { text: "20 minutes on a call or watching a Loom.", status: "build" },
      bca: {
        text: "Shows what we built and the numbers: invites, accepts, replies, calls, clients, against the promise.",
        channel: "Call or Loom",
        status: "build",
      },
      system: { text: "One page with their numbers since launch.", status: "partly" },
    },
    why: "Lands before the first bill (end of month 4). The ending shapes the memory (peak-end rule). Job 175.",
  },
  {
    id: "flight-plan",
    phase: "own",
    title: "Choose what's next",
    trigger: "At the results review",
    target: "Day 100",
    kind: "event",
    feel: "I know what to do and I chose it.",
    lanes: {
      coach: {
        text: "Rates themselves red, amber or green on about 8 plain statements (\"I get new conversations every week without thinking about it\"). Picks 2 or 3 projects for the next 90 days.",
        status: "build",
      },
      system: { text: "Several statements start green because we built them.", status: "build" },
    },
    why: "Josh's flight plan: people who choose for themselves take ownership. Early wins already on the board.",
  },
  {
    id: "first-bill",
    phase: "own",
    title: "First monthly payment",
    trigger: "End of month 4",
    target: "Day 120",
    kind: "event",
    feel: "Fair. It's worth it.",
    lanes: {
      ava: { text: "A thank-you and what's coming this month. No surprises: they heard about it on day 1.", channel: "Email", status: "build" },
      system: { text: "Stripe takes the first monthly payment.", status: "live" },
    },
  },

  // Keep going
  {
    id: "month6",
    phase: "keep",
    title: "Month 6 check",
    trigger: "Month 5 to 6",
    target: "Month 6",
    kind: "check",
    feel: "They noticed before I did.",
    lanes: {
      bca: {
        text: "Sorts every coach into on track, drifting or stuck. Honest talk with the drifting and stuck: is it the product or the driver?",
        channel: "Call",
        status: "build",
      },
      system: { text: "A result check every 3 months from coach health.", status: "partly" },
    },
    why: "Josh's second cliff (months 6 to 7, no real result). People decide a month earlier, so we talk a month earlier.",
  },
];
