/**
 * Reach out: cold call, cold email, LinkedIn, DMs and warm network, every one
 * booking a BOSS Score Review. From the BOSS Score Review doc (20 Oct 2026),
 * built on Hormozi's Gym Launch outbound talk and BCA's LinkedIn data.
 */

import { h, info, list, message, note, r, say, see } from "../blocks";
import { ACCOUNTANT, CATCH, NOT_INTERESTED, PRICE_ANSWER, TOO_BUSY } from "./objections";
import type { ScriptPart } from "./types";

export const REACH_OUT_PARTS: ScriptPart[] = [
  {
    id: "cold-call",
    title: "Cold call",
    goal: "Two to five minutes. Book the review and do nothing else.",
    blocks: [
      info(
        "Why the review works as the offer",
        "Owners don't take calls to be sold to. They take them for something they really want. The review is that: 30 minutes on their business, one constraint, one action, and a written summary, free.",
        "Hormozi's team found it took months to get right. Their first month made one sale. Keep going as long as each step is improving.",
      ),
      h("Before you dial"),
      list(
        "Look the business up first: website, LinkedIn, a recent post. Find one true detail to mention.",
        "Check the number against TPS and CTPS. Calling a number on either list breaks UK rules (PECR).",
        "Call from a local landline number, not a withheld or 0800 one. Pickups depend on it.",
        "Aim for 50 dials in about two hours. At Gym Launch's rates (100 dials, 20 pickups, 2 shows) that's about one review a day.",
      ),
      h("The call"),
      say("Hi [Name], it's {me}. I'm calling out of the blue, so I'll be quick. Can I take 30 seconds to tell you why, and then you can tell me if it's worth carrying on?"),
      say("I work with owners of [sector] businesses around [area], mostly [your turnover range]. Three things hold most firms your size back: prices that haven't kept up with costs, cash stuck in unpaid invoices, and too much still running through the owner."),
      say("Is any of those on your mind at the moment?"),
      r(
        "green",
        "Yes",
        say("Which one?"),
        note("Let them talk for a minute."),
        say("That's exactly what a BOSS Score Review is for. It's 30 minutes. We score the business across ten areas, find the one thing holding it back, and you leave with one action and a written summary. It's free and there's no pitch. Would [day] at [time] or [day] at [time] suit you better?"),
        say("Great. I'll send the invite now, with a 3-minute check to fill in first. If you do it before we speak, I can tailor the review to your results. Is [email] the best address?"),
      ),
      r("orange", "\"Not interested\"", ...NOT_INTERESTED),
      r(
        "blue",
        "\"Just send me something\"",
        say("Happy to. So I send the right thing, which of those three is closest?"),
        say("I'll send the 3-minute BOSS Score. Shall we put 30 minutes in the diary to go through your results?"),
      ),
      r("blue", "\"What's the catch?\"", ...CATCH),
      r("blue", "\"How much is it?\"", ...PRICE_ANSWER),
      r("blue", "\"I'm too busy\"", ...TOO_BUSY),
      r("blue", "\"I've already got an accountant\"", ...ACCOUNTANT),
      info("Once it's true", "When you've spoken to enough owners in a sector, the reason can become Hormozi's line: \"I've been speaking to a lot of [sector] owners round here, and the same three things keep coming up.\" Only say it once it's true."),
      h("Gatekeeper"),
      say("Hi, it's {me}. Could you put me through to [Name]? It's about a business review."),
      note("If they ask more:"),
      say("I'm offering [Name] a free BOSS Score Review. Can I send them the details?"),
      h("Voicemail"),
      say("Hi [Name], it's {me} on [number]. I'm running a few free BOSS Score Reviews for [sector] owners this month. 30 minutes, one action, no pitch. I'll drop you an email too."),
      note("Then send the cold email."),
      h("Anything else they say"),
      see("Objections before the review", "objections", "before"),
    ],
  },
  {
    id: "email",
    title: "Cold email",
    goal: "A three-email campaign you send by hand from your own inbox, a few a day, until the full set-up is ready.",
    blocks: [
      info(
        "Why it's written this way",
        "It follows what the best cold email teachers agree on. Email 1 gets a hand raised, it doesn't sell: it gives a real fix first, asks for a one-word yes, and has no links, so it reads like a note from a person.",
        "Good results are 1 or 2 replies in every 100. If nobody replies after 100, change the first line or the sector before anything else.",
      ),
      h("Your rules"),
      list(
        "Send from your own email, by hand, up to 20 a day. Any more waits for the full set-up, so your own address stays out of spam.",
        "Company addresses only (Ltd, LLP, plc). Sole traders and partnerships need consent first under UK rules (PECR).",
        "Keep the \"reply no\" line in every email, and stop the moment someone says no.",
        "Owners, founders and MDs only, at firms of about 10 to 50 staff.",
        "Plain text: no links, pictures, attachments or tracking until they reply.",
        "Write the first line yourself, from something true: a new hire, a job won, a recent post. Use first names and the everyday company name (\"Smith Engineering\", not \"Smith Engineering Holdings Ltd\").",
        "Answer replies within the hour. Answer their question, then offer two times.",
        "Add everyone you email to Prospects, so you know who's had what.",
      ),
      h("Email 1, day 0: pick their sector"),
      note("Subject: pick one that doesn't look like a sale: \"Question, [Name]?\", \"[Company]\" or \"[Name], quick one\". The sector lines are drafts: change them to fit what you know."),
      r(
        "blue",
        "Construction and trades",
        message(
          "Email 1",
          "Hi [Name],\n\n[One true line about them, e.g. \"Saw you've just started the job on Mill Lane.\"]\n\nA lot of building firms win the work on price, then lose the profit on the changes. Every variation agreed on site and priced later quietly costs them money.\n\nThe quick fix: price every variation in writing before the work starts, even the small ones.\n\nI've got a couple more ideas for [Company]. Would it be okay if I sent them over?\n\n{me}\n\nIf this isn't for you, reply \"no\" and I won't email again.",
        ),
      ),
      r(
        "blue",
        "Engineering and manufacturing",
        message(
          "Email 1",
          "Hi [Name],\n\n[One true line about them, e.g. \"Saw you've taken on two new engineers this year.\"]\n\nA lot of manufacturers have watched material costs rise faster than their prices. The margin goes quietly, a few pence a part.\n\nThe quick fix: check this year's costs against the prices on your top 20 products. Most owners find two or three that barely make money.\n\nI've got a couple more ideas for [Company]. Would it be okay if I sent them over?\n\n{me}\n\nIf this isn't for you, reply \"no\" and I won't email again.",
        ),
      ),
      r(
        "blue",
        "Professional services",
        message(
          "Email 1",
          "Hi [Name],\n\n[One true line about them, e.g. \"Saw you've opened a second office.\"]\n\nA lot of firms like yours haven't moved their fees in a couple of years, while salaries have gone up in every one of them.\n\nThe quick fix: put every new client on this year's rate from today, and move existing clients at renewal.\n\nI've got a couple more ideas for [Company]. Would it be okay if I sent them over?\n\n{me}\n\nIf this isn't for you, reply \"no\" and I won't email again.",
        ),
      ),
      r(
        "blue",
        "Any other sector",
        message(
          "Email 1",
          "Hi [Name],\n\n[One true line about them, e.g. \"Saw you've just won the contract with the council.\"]\n\nA lot of owners of firms your size have one of three things holding profit back: prices behind costs, cash stuck in unpaid invoices, or too much still running through them.\n\nThe quick fix: chase every invoice over 30 days this week. It's often tens of thousands sitting there.\n\nI've got a couple more ideas for [Company]. Would it be okay if I sent them over?\n\n{me}\n\nIf this isn't for you, reply \"no\" and I won't email again.",
        ),
      ),
      h("Email 2, day 3, same thread"),
      message("Email 2", "Hi [Name], just bumping this up in case it got buried. Shall I send them over?\n\n{me}\n\nIf this isn't for you, reply \"no\" and I won't email again."),
      h("Email 3, day 7, new thread"),
      note("A new subject, so it reads fresh: \"One idea for [Company]\"."),
      message(
        "Email 3",
        "Hi [Name],\n\nOne idea, whether or not we ever speak.\n\nA 5% price rise with no customers lost adds 5% of your turnover straight to profit. On £2M that's £100,000. For a business making 8%, that's 62% more profit.\n\nIf you'd like to see what your own numbers could be worth, I run a free 30-minute BOSS Score Review. You leave with your score, the one thing holding the business back, and one action for this week. Worth a look?\n\nEither way, this is my last email.\n\n{me}\n\nIf this isn't for you, reply \"no\" and I won't email again.",
      ),
      info("Why email 3 works", "It gives value even if they never book. It's also a taste of the review."),
      h("When they reply"),
      r(
        "green",
        "\"Yes\" or \"Go on then\"",
        note("Now it's a conversation, so a link is fine. Give the two ideas you promised, then offer the review."),
        message(
          "Reply",
          "Great, thanks [Name]. Here are two:\n\n1. [A second quick fix for their sector]\n2. [A third quick fix for their sector]\n\nThe bigger one depends on your numbers, which is what my BOSS Score Review is for. It's free and takes 30 minutes: we score the business across ten areas, find the one thing holding it back most, and you leave with one action for this week and a written summary. No pitch.\n\nWould [day] at [time] or [day] at [time] work? Before we speak, the 3-minute BOSS Score is here: [your BOSS Score link]\n\n{me}",
        ),
        note("Take the quick fixes from the playbook for the area that fits them best."),
      ),
      r(
        "yellow",
        "\"Not now\"",
        message("Reply", "No problem at all, [Name]. Would it be useful if I sent you one idea a month, like the one above? No pitch, and you can say stop any time.\n\n{me}"),
        note("If they say yes, they go on your monthly list."),
      ),
      r("blue", "A question or a push back", see("Booking objections: what to say", "objections", "before")),
      r("red", "\"No\" or \"Stop\"", note("Stop straight away, take them off your list, and don't email them again.")),
    ],
  },
  {
    id: "linkedin",
    title: "LinkedIn and DMs",
    goal: "The same promise, worded for each channel. Be specific, and keep links out of first messages.",
    blocks: [
      info(
        "What our LinkedIn data says",
        "Specific messages get 2 to 3 times the meetings. Link notes got no meetings at all, so keep links out of first messages. Offering two times got twice as many people confirming as offering one.",
      ),
      h("Connection request"),
      note("If you have a result to quote, use the \"I ask because\" note. It got the most meetings per request in our data. With no result yet, send a blank request."),
      message("Connection note", "Hi [Name], quick one: when did you last put your prices up? I ask because one [sector] owner I work with added £[X] profit from that alone. Happy to connect."),
      h("Once they accept"),
      message(
        "Message 1",
        "Thanks for connecting, [Name]. Quick question: when did you last put your prices up? I ask because on a £2M business every 1% is £20,000 a year.\n\nI run a free 30-minute BOSS Score Review that finds the one thing holding a business back, and you leave with one action. Happy to run one for [Company] if it's useful?",
      ),
      message("Message 2, day 4, if no reply", "Hi [Name], bumping this up in case you missed it. I've still got a couple of BOSS Score Reviews open this month. Want me to save you one?"),
      h("When they reply"),
      r("green", "They say yes", message("Reply", "Great. Would [day] at [time] or [day] at [time] work better? If neither, here's my calendar: [your booking link]")),
      r(
        "blue",
        "They ask what it is",
        message(
          "Reply",
          "It's 30 minutes on Zoom. We score your business across ten areas, from strategy and cash to team and systems, and find the one constraint costing you the most. You leave with one action for this week, and I send you a written summary the same day. No pitch.",
        ),
      ),
      h("Other DMs (Instagram, Facebook)"),
      message("DM", "Hi [Name], [one true line about their post]. Quick one: I'm running a few free BOSS Score Reviews for [sector] owners. In 30 minutes we find the one thing holding the business back, and you leave with one action. Want the details?"),
      note("Only send WhatsApp messages and texts to people who have already been in touch with you."),
    ],
  },
  {
    id: "warm",
    title: "Warm network",
    goal: "The fastest route to your first reviews. It also asks for a referral.",
    blocks: [
      message(
        "Message",
        "Hi [Name], hope you're well. I've started running free BOSS Score Reviews for business owners. In 30 minutes we find the one thing holding the business back, and they leave with one action. I'm looking for a few owners of [your turnover range] businesses to run them with this month. Is that you, or is there someone you'd put me in touch with?",
      ),
      note("Send it one person at a time, not as a group message."),
    ],
  },
  {
    id: "industry",
    title: "Fit it to their industry",
    goal: "Change the words that show you know their world. Keep the offer the same.",
    blocks: [
      info("Why", "Hormozi's opener worked because it named problems that gym owners in the area really had. Owners listen when you name their problems in their words."),
      h("What stays the same"),
      note("The name, the promise, what they get, and how the review runs."),
      h("What changes"),
      note("The three things that hold firms back, the examples, the one true detail about the business, your proof, and which money moment you lead with."),
      h("Starting lines"),
      note("These are drafts. Check them against what you know of the sector before you use them."),
      r("blue", "Construction and trades", list("Quoting too low to win the job.", "Cash stuck in retentions and late payments.", "The owner still on site every day."), note("Lead with: price.")),
      r("blue", "Engineering and manufacturing", list("Margins squeezed by material costs.", "Cash tied up in stock and work in progress.", "Every quote going through the owner."), note("Lead with: costs.")),
      r("blue", "Professional services", list("Fees that haven't moved in years.", "Time that's never billed.", "The owner still doing the client work."), note("Lead with: average fee, then the time audit.")),
    ],
  },
];
