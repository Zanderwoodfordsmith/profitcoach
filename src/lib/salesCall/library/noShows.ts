/**
 * No-shows and reschedules, for the review and the Profit Roadmap call.
 * Turned round from BCA's "No-Show SOP" and "Reschedule SOP" (DeltaIQ for
 * Alex and Yan, Oct 2026) for a coach who books and runs their own calls,
 * wording kept close to theirs.
 */

import { h, info, list, message, note, say, see } from "../blocks";
import type { ScriptPart } from "./types";

export const NO_SHOW_PARTS: ScriptPart[] = [
  {
    id: "rules",
    title: "The rules",
    goal: "A missed or moved call is normal. Never end without a new day and time.",
    tight: true,
    blocks: [
      info(
        "Why this matters",
        "This gives every no-show a real chance to still show up, without ever making the owner feel chased or guilted. A reschedule request isn't a problem, it's normal. The only thing that turns it into a lost lead is leaving it open-ended.",
      ),
      h("Golden rule"),
      note("Never end a reschedule conversation without a specific day and time locked in. \"I'll be in touch\" isn't a reschedule, it's a soft no wearing a disguise."),
      h("Tone"),
      note("Calm, matter of fact, never a dare, never guilt. A missed call is normal, not a crisis. Every message ties back to what the owner actually said before, not a generic nudge. If they don't respond, the door stays open. You don't chase."),
      h("When to call"),
      note("Try different times of day. Owners are often busiest in working hours, so early morning, early evening or a Saturday morning can be when they actually pick up. If one time doesn't work, try the next attempt at a different one. Keep it sensible: nothing late at night."),
      h("Repeat no-shows and reschedules"),
      list(
        "2nd time: note the pattern. Still no pressure, but name it honestly (see Reschedule).",
        "3rd time: stop booking. Don't book a 4th time blind. Move them to your monthly list.",
      ),
      h("Logging"),
      note("Log every attempt against the prospect, including no response. Keep a count of reschedules so the pattern is visible without digging through notes. Never delete a no-show: your monthly list depends on it being complete."),
    ],
  },
  {
    id: "no-show",
    title: "No-show",
    goal: "Three days of calm, specific follow-up. Then the door stays open.",
    blocks: [
      h("The plan"),
      list(
        "1. 5 to 10 minutes after the start time: call. No answer, leave the voicemail, then send the text straight after.",
        "2. Same day, 2 to 3 hours later, at a different time of day if you can: call again. No answer, send the second text.",
        "3. Next day: call, plus a personal message tied to what they told you.",
        "4. Day 3: the final door-open message. No more active attempts after this.",
        "5. After that, no response: move them to your monthly list. Don't delete them.",
      ),
      h("Step 1. Straight away"),
      note("Voicemail, if no answer:"),
      say("Hi [Name], it's {me}, think we might have just missed each other for the call. No problem at all, I'll drop you a text now."),
      message("Text, sent right after", "Hi [Name], I'm on the Zoom now. If today's gone sideways, no problem. Would [day] at [time] or [day] at [time] work instead?"),
      h("Step 2. Same day, second try"),
      message("Text", "Hi [Name], just trying again, no rush at all. When you get a minute, let me know what works, morning or afternoon both fine."),
      h("Step 3. Next day, personal"),
      note("This is the one that actually earns a response. Reference the specific thing they told you they wanted, not a generic follow-up."),
      message("Text", "Hi [Name], didn't want to just keep calling without a reason. You mentioned [their goal or problem], that's exactly what this call would help with. No pressure, just let me know if you'd still like to get it sorted."),
      note("Pull the line straight from your notes. This one step is what separates a real reschedule from a dead lead."),
      h("Step 4. Day 3, door open"),
      message("Text", "Hi [Name], I'll leave this one with you for now, timing's probably just not right and that's fine. If anything changes, message me any time and we'll sort it."),
      note("Last active touch. Nothing further unless they reply first."),
      h("What to send"),
      note("One thing at most, with the rebook. A short video about the review if you have one: [your review explainer video]."),
      h("If they give you a reason instead of a time"),
      see("Rebooking objections", "objections", "rebooking"),
    ],
  },
  {
    id: "reschedule",
    title: "Reschedule",
    goal: "Reply straight away, offer two set times, and rebuild the reason to show up.",
    blocks: [
      h("Step 1. Respond immediately"),
      note("Whenever the request comes in, reply straight away. A slow reply is one of the easiest ways to lose someone who was still genuinely interested."),
      say("No problem at all, [Name], life happens. Let's find you a time that actually works properly rather than one you're rushing for."),
      h("Step 2. Diagnose only if they hesitate"),
      note("If they give a new time straight away, skip this. Only use it if they go vague or stall."),
      say("All good, can I ask, is it more that the timing's just not working, or has something changed on your side?"),
      h("Step 3. Offer two set times"),
      note("Never ask \"when works\" open-ended. Always give two specific options."),
      say("I've got [day] or [day], which works better? And [time] or [time], whichever's easier."),
      h("Step 4. Reconfirm the reason to show up"),
      note("A reschedule resets the buy-in from the original booking. Rebuild it the same way the commitment step does: tie the new time back to what they said matters to them."),
      say("Good, I've got you booked for [day, date, time]. That'll still be all about [their goal or problem], I look forward to hearing how it goes."),
      h("When the request comes by text"),
      note("Call them straight after they text. If there's no answer, you've no chance to get them live for steps 2 to 4, so get a real slot confirmed by text instead."),
      message("Reply straight away", "No problem at all, [Name], life happens. I've got [day] or [day], which works better? And [time] or [time], whichever's easier."),
      message("No reply the same day: one follow-up", "Just checking in, [Name], want to get you sorted rather than leave it hanging. [Day] or [day] still work for you, or is there a better window?"),
      note("Still no reply: don't leave it open. Log it as an unconfirmed reschedule, count it, and try again the next day."),
      h("The 2nd reschedule"),
      note("Still no pressure, but name the pattern honestly. It reads as attentive, not pushy."),
      say("Totally understand things keep coming up. My diary for these is limited, so I want to make sure this next one actually works for you. Is [day, time] genuinely clear, or is there a better window?"),
      h("The 3rd reschedule"),
      note("Stop. Don't book a 4th time blind. Move them to your monthly list."),
      h("If they give you a reason instead of a time"),
      see("Rebooking objections", "objections", "rebooking"),
    ],
  },
];
