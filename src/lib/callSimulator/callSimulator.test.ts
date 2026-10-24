import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { callScore } from "./ai";
import { CALLS, SALES_SKILLS, callFacts, sessionParts } from "./calls";
import { BOOKING_OBJECTIONS, CLOSE_OBJECTIONS, REBOOKING_OBJECTIONS, drillParts, surpriseObjections } from "./objections";
import { PROFILES, PROSPECTS } from "./prospects";
import { callBrief, prospectFirstMessage, prospectPrompt } from "./prompt";
import { callScript, followScript, saidLine } from "./script";

const unique = (ids: string[]) => new Set(ids).size === ids.length;

describe("call simulator content", () => {
  it("reads every objection from the Scripts", () => {
    // A renamed script answer would drop an objection silently; these counts catch it.
    assert.equal(BOOKING_OBJECTIONS.length, 12);
    assert.equal(REBOOKING_OBJECTIONS.length, 6);
    assert.equal(CLOSE_OBJECTIONS.length, 7);
    for (const o of [...BOOKING_OBJECTIONS, ...REBOOKING_OBJECTIONS, ...CLOSE_OBJECTIONS]) {
      assert.ok(o.says && o.lines.length, o.id);
    }
  });

  it("every call has uniquely named parts, and drills build theirs", () => {
    assert.ok(unique(CALLS.map((c) => c.id)));
    for (const c of CALLS) {
      if (c.drill) assert.equal(c.parts.length, 0, c.id);
      else assert.ok(c.parts.length >= 4 && unique(c.parts.map((p) => p.id)), c.id);
    }
    assert.equal(SALES_SKILLS.length, 5);
    assert.deepEqual(drillParts("close", ["money", "fear"]).map((p) => p.id), ["money", "fear"]);
    const picked = surpriseObjections("booking");
    assert.ok(picked.length >= 3 && picked.length <= 4 && unique(picked));
  });

  it("starting partway scores only the parts from there", () => {
    const roadmap = CALLS.find((c) => c.id === "roadmap")!;
    assert.deepEqual(sessionParts(roadmap, { startPart: "investment", objections: [] }).map((p) => p.id), ["investment", "objections", "next"]);
    assert.equal(sessionParts(roadmap, { startPart: null, objections: [] }).length, 5);
  });

  it("builds a prompt for every owner, call and level", () => {
    for (const p of PROSPECTS) {
      for (const c of CALLS) {
        const objections = c.drill ? surpriseObjections(c.drill) : [];
        for (const difficulty of ["easy", "medium", "hard"] as const) {
          const prompt = prospectPrompt({ prospect: p, call: c, difficulty, coachName: "Sam", startPart: c.startable ? c.parts[2].id : null, objections });
          assert.ok(!/undefined|\[object/.test(prompt), `${p.id} ${c.id} ${difficulty}`);
          assert.ok(callBrief(c, p, difficulty, null).setup.length > 20);
        }
        assert.equal(typeof prospectFirstMessage(c, p, "Sam", null), "string");
        assert.ok(callFacts(c, p, "hard").every((f) => f.label && f.hint && f.detail), `${p.id} ${c.id}`);
      }
    }
    assert.equal(PROSPECTS.length, Object.keys(PROFILES).length);
  });

  it("scores out of 100 whatever the number of parts", () => {
    const area = (score: number) => ({ id: "x", label: "x", score, evidence: "", better: "" });
    assert.equal(callScore({ parts: [area(5), area(5)], skills: [area(5)] }), 100);
    assert.equal(callScore({ parts: [area(3)], skills: [area(4), area(4), area(4), area(3), area(3)] }), 70);
  });

  it("gives every call a script with lines to say, starting where the coach starts", () => {
    for (const c of CALLS) {
      const pages = callScript(c, { startPart: null, objections: c.drill ? surpriseObjections(c.drill) : [] });
      assert.ok(pages.length && pages.some((p) => p.blocks.some((b) => b.type === "say" || b.type === "response")), c.id);
      assert.ok(pages.every((p) => p.blocks.every((b) => b.type !== "live")), c.id);
    }
    const roadmap = CALLS.find((c) => c.id === "roadmap")!;
    assert.equal(callScript(roadmap, { startPart: "investment", objections: [] })[0].id, "investment");
  });

  it("knows a script line was said, even in the coach's own words", () => {
    const line = "Hi [Name], it's {me}. I'm calling out of the blue, so I'll be quick. Can I take 30 seconds to tell you why, and then you can tell me if it's worth carrying on?";
    assert.ok(saidLine(line, ["Hi Kit, it's Sam. I'm calling out of the blue so I'll be quick. Can I take thirty seconds to tell you why and you tell me if it's worth carrying on?"]));
    assert.ok(!saidLine(line, ["How's business at the moment?"]));
    // A short line needs nearly all its words: two in passing jumped the script ahead (23 Oct).
    assert.ok(!saidLine("So that's your constraint: [constraint].", ["What do you think your constraint might be?"]));
    assert.ok(saidLine("So that's your constraint: [constraint].", ["So that's your constraint, pricing."]));
  });

  it("follows the coach through the review without jumping into the optional part", () => {
    const review = CALLS.find((c) => c.id === "review")!;
    const pages = callScript(review, { startPart: "score", objections: [] });
    const heard = ["Here's how you've scored the business.", "What do you think your constraint might be, out of these?"];
    const { all, said, next } = followScript(pages, heard, 0);
    const line = all.find((l) => l.key === next)!;
    assert.ok(said.size >= 1);
    assert.ok(!line.optional, line.text);
    assert.ok(all.filter((l) => l.optional).length > 0, "the review's score page has an optional part");
  });
});
