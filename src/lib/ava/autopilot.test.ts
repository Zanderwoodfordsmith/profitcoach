import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autopilotEligible, composeTimeOffer, draftNamesOffer, firstNameOf } from "./autopilot";
import { DEFAULT_AVA_SETTINGS } from "./settings";

const offered = [
  { startsAt: "2026-10-20T09:30:00Z", label: "tomorrow at 10:30am", dayKey: "2026-10-20", half: "am" as const },
  { startsAt: "2026-10-21T13:00:00Z", label: "Wednesday at 2pm", dayKey: "2026-10-21", half: "pm" as const },
];
const settings = { coach_id: "c", ...DEFAULT_AVA_SETTINGS, reply_mode: "autopilot" as const, autopilot_allowed: true };
const wantsCall = { disposition: "interested" as const, situation: "interested", nextStep: "calendar" as const, confidence: 0.92, reason: "" };

describe("Ava autopilot", () => {
  it("only runs when every switch is on and the prospect clearly wants a call", () => {
    const base = { globalOn: true, settings, triage: wantsCall, channel: "linkedin", live: true, recentAutopilot: false, replyAgeMs: 30_000 };
    assert.equal(autopilotEligible(base).run, true);
    assert.equal(autopilotEligible({ ...base, globalOn: false }).run, false);
    assert.equal(autopilotEligible({ ...base, settings: { ...settings, autopilot_allowed: false } }).run, false);
    assert.equal(autopilotEligible({ ...base, settings: { ...settings, reply_mode: "copilot" } }).run, false);
    assert.equal(autopilotEligible({ ...base, triage: { ...wantsCall, confidence: 0.6 } }).run, false);
    assert.equal(autopilotEligible({ ...base, triage: { ...wantsCall, nextStep: "scorecard" } }).run, false);
    assert.equal(autopilotEligible({ ...base, recentAutopilot: true }).run, false);
    assert.equal(autopilotEligible({ ...base, live: false }).run, false);
    assert.equal(autopilotEligible({ ...base, channel: "email" }).run, false);
    assert.equal(autopilotEligible({ ...base, replyAgeMs: 3 * 60 * 60 * 1000 }).run, false);
  });

  it("offers two times with the link as the fallback", () => {
    const text = composeTimeOffer({ firstName: "Sarah", offered, zone: "UK time", link: "https://x/book/sam" });
    assert.equal(
      text,
      "Great, Sarah. Would tomorrow at 10:30am or Wednesday at 2pm (UK time) work for a 20-minute call?\n\nIf neither suits, grab any time that works here: https://x/book/sam"
    );
    assert.match(composeTimeOffer({ firstName: "", offered: [], zone: "UK time", link: "https://x/book/sam" }) ?? "", /diary/);
    assert.equal(composeTimeOffer({ firstName: "Sarah", offered: [], zone: "UK time", link: null }), null);
  });

  it("only trusts an AI draft that names the exact times and link", () => {
    assert.equal(draftNamesOffer("Would tomorrow at 10:30am or Wednesday at 2pm work? https://x/book/sam", offered, "https://x/book/sam"), true);
    assert.equal(draftNamesOffer("Would Tuesday morning work? https://x/book/sam", offered, "https://x/book/sam"), false);
    assert.equal(draftNamesOffer("Would tomorrow at 10:30am or Wednesday at 2pm work?", offered, "https://x/book/sam"), false);
  });

  it("only uses a real-looking first name", () => {
    assert.equal(firstNameOf("Sarah Jones"), "Sarah");
    assert.equal(firstNameOf("Dr."), "");
    assert.equal(firstNameOf(null), "");
  });
});
