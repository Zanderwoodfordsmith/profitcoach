/**
 * Objections before a call: booking the review, and rebooking a missed or
 * moved call. Turned round from BCA's setter docs (Alex and Yan, Oct 2026:
 * "BCA Setter Objection Guide" and "BCA Recontact Objection Handling") for a
 * coach talking to an owner, with the wording kept close to theirs. The
 * objections on the Profit Roadmap call itself live in its own script.
 * Fill-ins: [in brackets] on the day, {price} from the Blueprint.
 */

import { type Block, h, info, list, note, r, say, see, they } from "../blocks";
import type { ScriptPart } from "./types";

/** Said when they ask the price before the review. Zander, 22 Oct: never evasive, the review is free. */
export const PRICE_ANSWER: Block[] = [
  say("Sure. The review itself is free, and everything you get from it is yours to keep. My top clients invest over [what your top clients invest a year], and there are ways to work with me from {price}. If you want to hear about that, I'll take you through it all on a second call, and we'll see if it even makes sense for you, because it might not. I can't work with everybody."),
  info(
    "Say the number like it's normal",
    "Answer it straight and keep moving. Say the number like it's the most normal thing in the world. Don't pause after it, and don't ask how it sounds. Price is information here, not a decision point.",
    "If they wobble at the number, flip from price to fit: the second call isn't there to sell you on price, it's to work out whether this is the right fit. For some people it isn't, and I'll tell you that straight. Note their reaction for the review.",
  ),
];

export const SEND_INFO: Block[] = [
  note("What it usually means: they're not sold yet, or they're nervous about the next step. More content rarely fixes that. It gives them a reason to go away and think, and most leads go cold."),
  say("Happy to, I just want to send you the right thing rather than a pile of stuff. What's the one thing you're least sure about?"),
  note("Find that one thing, answer it, then send the single thing that covers it. One thing at a time, never a list of links."),
  say("The best version of this is the review itself, because it's about your business, not a generic PDF. So let's get it booked, and I'll send you the 3-minute BOSS Score to do before we speak, so we can spend the time on your results."),
  note("Then: if they still push, ask what they'd most want to see, and promise to build the review around it. Don't promise to send things you don't have."),
];

export const NOT_INTERESTED: Block[] = [
  say("No problem. Can I ask, is that because things are going well, or just bad timing?"),
  r("green", "Going well", say("Glad to hear it. Every level has its devil. Owners who are doing well use the review to find what to fix next. Worth 30 minutes?"), note("Try once, then thank them and go.")),
  r("blue", "Bad timing", say("Understood. When would be a better time for me to come back to you?"), note("Put a date in the diary. Never leave it as \"I'll follow up sometime\".")),
];

export const ACCOUNTANT: Block[] = [
  say("Good, this sits alongside them. They look after the numbers. The review looks at what to fix next. Plenty of owners share their summary with their accountant."),
];

export const CATCH: Block[] = [
  say("Fair question. I do work with some owners after a review. If you want to hear about that, I'll tell you at the end and we'll book another time. If not, the review is yours to keep."),
];

export const TOO_BUSY: Block[] = [
  note("What it usually means: either a permanent constraint, or they've no clear structure for it yet."),
  say("That's usually why owners book it. Is it a permanent thing, or more that there's never a clear gap in the week?"),
  say("Would early morning or the end of the day be easier?"),
  note("Then: it's 30 minutes. If the worry eases, book it. If it's a real future thing, set a dated follow-up."),
];

const howTo: Block[] = [
  info(
    "Why we handle objections this way",
    "An objection is not a no. It's the owner telling you something they're unsure about. Most of the time, the first thing they say is not the real reason.",
    "For example, \"I need to think about it\" can mean I don't understand what it is, I'm not sure it's worth it, or it isn't a priority right now. You can only help with the real reason, so your first job is to find it.",
    "You're not there to convince anyone. Your job is to find out whether the next conversation makes sense for both sides. When you push or argue, people feel sold to, get defensive and dig in. When you stay curious, they relax and tell you what's really going on.",
    "Not everyone will say yes, and that's fine. If you asked, listened and answered honestly, you did the job well.",
  ),
  h("The four steps"),
  note("Use these four steps for every objection, in this order."),
  list(
    "1. Hear it. Let them finish. Don't jump in with the answer. Repeat the key part back so they know you heard it.",
    "2. Ask. Ask one question to find the real reason. Don't assume you know what they mean.",
    "3. Answer short. Give a short, honest answer to the real concern. Two or three sentences, not a speech.",
    "4. Move on. Go back to the script, book the call, or agree a dated follow-up. Never leave it hanging.",
  ),
  h("Worked example"),
  they("\"I need to think about it.\""),
  say("Of course. Is there something specific you'd need to think through, or are you still working out whether this is a priority for you?"),
  they("\"It's mainly the time.\""),
  say("That makes sense. It's 30 minutes, and the whole point is to show you what to fix first, so you're not spending time on the wrong thing. Would early morning or the end of the day be easier?"),
  note("You heard it, asked one question, found the real reason, answered in two sentences and moved to the next step."),
  h("How to dig one level deeper"),
  note("Digging deeper just means asking one more question about what they said, using their own words. It shows you're listening, and it gives you better information for the review."),
  list(
    "Repeat it back as a question. They say \"I'm not sure it's for me.\" You say \"Not sure it's for you?\"",
    "Ask what's behind it. \"What makes you say that?\"",
    "Give two options. \"Is that more about the time, or more about the cost?\" Two options make it easy to answer.",
    "Ask what would need to be true. \"What would need to be true for this to make sense for you?\"",
    "Switch to a goal if they go guarded. \"Let's say the next 12 months went really well for the business. What would you want it to give you?\" People find it much easier to talk about what they want than about what's wrong.",
    "Then stay quiet. Silence is part of the question. Count to three in your head and let them fill it.",
  ),
  h("Three rules"),
  list("One question at a time. Don't stack a second one on top of the first.", "Use their words, not yours.", "Never answer for them. If you fill the gap, you take away their answer."),
  h("When to let go"),
  note("Don't force a yes. Thank them politely and end the call when:"),
  list(
    "They're not the owner and can't bring the owner in, or are only curious with no possible next step.",
    "They won't consider paying for help under any circumstances.",
    "They want a guaranteed result, or an outcome you can't honestly promise.",
    "The timing makes any real conversation impossible, and they have no interest in a future follow-up.",
  ),
  note("Don't create pain that isn't there. Find the gap, make it specific, and let the owner decide whether closing it is important enough to explore now."),
  h("Never say"),
  list(
    "A promise of results, profit or income.",
    "A guarantee you haven't set in your Blueprint.",
    "Anything that isn't true, like \"I've two places left\" when you haven't.",
  ),
  h("Check yourself after every objection"),
  list("Did I let them finish?", "Did I ask one question, not two?", "Did I find the real reason?", "Was my answer short and honest?", "Did I move to the next step, or set a dated follow-up?"),
];

const beforeReview: Block[] = [
  note("Find what they said, read what it usually means, then use the wording."),
  h("They want to know more"),
  r(
    "blue",
    "\"I'm just having a look\"",
    note("What it usually means: there's no clear reason or goal yet. This is not a no."),
    say("That's completely fine, a lot of owners start out just having a look. So let's say the next 12 months went really well for the business. What would you want it to give you?"),
    note("Dig deeper:"),
    say("What would that change for you?"),
    say("What would make it worth your time?"),
    note("Then: their answer is the real reason. Carry on with the script. If there's still nothing, don't push. Book a dated follow-up."),
  ),
  r("blue", "\"Just send me something\"", ...SEND_INFO),
  r(
    "blue",
    "\"What exactly do you do?\"",
    note("What it usually means: they genuinely don't know yet. Answer first, or they won't answer your questions."),
    say("I help owners of [the kind of business you help] find what's holding back their profit, time and control, and then fix it with them, one 90-day plan at a time. The review is where we start. We score the business across ten areas and find the one thing to fix first."),
    note("Dig deeper:"),
    say("So if that one thing was fixed, what would you want it to give you?"),
    note("Then: go back to the next step of the script."),
  ),
  r("blue", "\"What's the catch?\"", ...CATCH),
  r(
    "blue",
    "\"Why do you need all this information?\"",
    note("What it usually means: they feel questioned, or they don't see the point."),
    say("I ask these questions because I need to understand where the business is now, where you want it to go, and what's been getting in the way. Without that, I'd only be giving you generic advice, and that wouldn't be useful to you."),
    note("Then: go back to the question you were on."),
  ),
  h("Cost and time"),
  r("blue", "\"How much is it?\"", ...PRICE_ANSWER),
  r("blue", "\"I'm too busy\"", ...TOO_BUSY),
  r(
    "blue",
    "\"I need to think about it\"",
    note("What it usually means: often a polite way of saying they're unsure about value, fit or timing."),
    say("Of course. Is there something specific you'd need to think through, or are you still working out whether this is a priority for you?"),
    note("Don't argue with the answer. Diagnose it."),
    r("yellow", "Value or fit", say("That makes sense. The whole point of the review is to help you work that out before you decide anything. Would it be useful to look at it together?")),
    r("blue", "Timing", say("Understood. How much time have you actually got in the week to put towards something like this?"), note("It's 30 minutes. If the worry eases, book it. If it's a genuine future thing, set a specific callback date.")),
  ),
  r(
    "blue",
    "\"I'm not ready yet\" or \"The timing isn't right\"",
    note("What it usually means: either they need more clarity, they don't have the time, or it isn't a priority. Don't decide which for them."),
    say("OK, and when you say not ready, is that because you need more clarity, you don't have the time, or it's simply not a priority right now?"),
    note("Then: if it's clarity, book the review. If it's genuinely later, say \"Would it be OK if I checked in again in a couple of months?\" Then put a date in the diary. Never leave it as \"I'll follow up sometime\"."),
  ),
  h("Not sure it's for them"),
  r("blue", "\"Not interested\"", ...NOT_INTERESTED),
  r("blue", "\"I've already got an accountant\"", ...ACCOUNTANT),
  r(
    "orange",
    "\"It's not for me\" (e.g. tried a consultant before)",
    note("What it usually means: they've formed an opinion, often from a bad experience or a misunderstanding. They may also be afraid of being pushed."),
    say("Got it. Out of curiosity, what was it that put you off?"),
    note("Listen to the one point they raise, then answer only that point honestly in two sentences."),
    say("I'm not here to convince you. We could look at it in a review if you wanted, but only if it feels worth it."),
    note("Then: if they get defensive, stop. Thank them and close cleanly. You don't need to win every call."),
  ),
  r(
    "blue",
    "\"I need to speak to my partner\"",
    note("What it usually means: there's a second decision maker, like a co-owner, business partner or spouse."),
    say("That makes sense. Would it help if they joined the review, so you're both hearing the same thing?"),
    note("Then: book a time that works for both of them. Note who they are."),
  ),
  r(
    "red",
    "A clean no",
    note("What it usually means: they've made up their mind. Respect it."),
    say("No problem at all, I completely understand. Best of luck with everything, and feel free to reach back out if anything changes."),
    note("Then: log the reason accurately. Don't chase a clean no."),
  ),
];

const rebooking: Block[] = [
  info(
    "Golden rules",
    "Diagnose, don't argue. Every objection gets one honest response and a next step, not a debate. Never manufacture urgency or guilt to get someone back on the calendar.",
    "If what you're hearing is a genuine no rather than a reason, stop. Don't keep pushing a diagnostic question at someone who's already answered it.",
    "Find the objection closest to what they actually said, don't force it into the wrong box. Every response still ends with getting a specific day and time, not just a better feeling.",
  ),
  h("Time and busy"),
  r("blue", "\"I completely forgot, sorry\"", say("No problem at all, it happens to everyone. Let's grab a new time now while we're both here, what's realistically good for you?")),
  r("blue", "\"Something came up at work\"", say("Totally get it, that stuff doesn't wait. When's usually a quieter window for you, mornings, evenings, somewhere in the middle of the day?")),
  r("blue", "\"I'm on holiday at the minute\"", say("No worries, enjoy it. When are you back? I'll get something in the diary for after that so it's one less thing to think about while you're away.")),
  r(
    "blue",
    "\"Can we push it back a few weeks?\"",
    say("Of course. Rather than leave it open, let's put something in the diary a few weeks out right now. You can always move it again if you need to, but at least it's booked rather than floating."),
    note("A far-out booked date beats an open promise, every time. Never leave this one without a date in the diary."),
  ),
  h("Stalling and uncertainty"),
  r(
    "yellow",
    "\"I need a bit more time to think about it\"",
    say("Sure, can I ask, is it more that you're still deciding whether this is for you, or is it more a timing thing?"),
    note("If timing, offer two slots. If it's genuine uncertainty about fit, that's still worth a call, not less worth one."),
  ),
  r(
    "yellow",
    "\"I'm not sure this is really for me\"",
    say("Fair enough, can I ask what's making you feel that way?"),
    note("Let them answer."),
    say("That's exactly the kind of thing worth looking at together. I'll tell you straight whether it's a fit, rather than you having to guess on your own."),
  ),
  r(
    "yellow",
    "\"I don't know if the business is ready for this\"",
    say("That's really common, and it's one of the first things the review gets clear on. No point guessing on your own when we can find out in 30 minutes."),
  ),
  h("Money"),
  r(
    "blue",
    "\"I'm worried about the cost\"",
    say("Totally fair to be thinking about that. The review itself is free, so that's a good reason to still have it, not a reason to skip it. If you want to hear how I work after that, I'll take you through it and whether it makes sense for you. No pressure to decide anything on the call itself. Sound fair?"),
    note("Don't negotiate price here. If they ask the number, give it."),
    see("How to answer \"How much is it?\"", "objections", "before"),
  ),
  h("Someone else decides"),
  r("blue", "\"I need to speak to my partner first\"", say("Completely understand, that's a decision worth making together. Would it help if they joined the call too, so you're both hearing the same thing at the same time rather than you having to explain it after?")),
  h("Avoiding the call"),
  r(
    "blue",
    "\"Can you just send me some information instead?\"",
    say("The best version of that is the call itself, because it's built around your business rather than a generic PDF. I can send you the 3-minute BOSS Score to do beforehand though, so the call's more useful for you."),
  ),
  r(
    "blue",
    "\"Can we just do this over WhatsApp?\"",
    say("I get wanting to keep it quick, but this one really works better as a proper conversation. It's your business we're talking through, not something that fits in a few text bubbles. Thirty minutes on a call and you'll get a straight answer."),
  ),
  h("Already decided"),
  r(
    "red",
    "\"I've decided to go with someone else\"",
    say("No problem at all, appreciate you letting me know. Out of curiosity, what made you go that way?"),
    note("Listen, log it."),
    say("Good luck with it, genuinely. If it's not the right fit down the line, I'll still be here."),
    note("This is a clean no. Stop here."),
  ),
  r(
    "red",
    "\"I don't think I'm interested anymore\"",
    say("No problem, can I ask, is it more that the timing's off, or is it that it's not something you want to look at at all?"),
    note("Timing: offer two slots. Not interested at all: one diagnostic question and then let it go. Don't ask this twice."),
  ),
  h("Bad line"),
  r("blue", "\"Bad signal, can we sort this another time?\"", say("No worries, let's lock in a proper time now so we're not chasing each other. Does [time] work, or would [time] be better?")),
];

const onRoadmap: Block[] = [
  note("After the price on the Profit Roadmap call, objections work differently: you're helping them make a decision, not getting a booking. Those pages, and the closes, live in that script, next to the investment."),
  see("Open the Profit Roadmap call's objections", "roadmap", "objections"),
  see("Open the closes", "roadmap", "closes"),
];

export const OBJECTIONS_PARTS: ScriptPart[] = [
  { id: "how", title: "How to handle any objection", goal: "Hear it, ask one question, answer short, move on. Read this once, then use the pages as a quick reference.", blocks: howTo, tight: true },
  { id: "before", title: "Before the review", goal: "When an owner pushes back on booking the review.", blocks: beforeReview },
  { id: "rebooking", title: "Rebooking", goal: "When a no-show or reschedule gives you a reason instead of a new time.", blocks: rebooking },
  { id: "roadmap", title: "On the Profit Roadmap call", goal: "Objections after the price, and the closes, are in that call's script.", blocks: onRoadmap },
];
