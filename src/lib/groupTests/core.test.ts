import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fillArm, pValue, slotsUsed, validateFills, validateTest, verdict } from "./core";

const arms = [
  { key: "A", label: "Tribe", body: "Thanks for connecting, {{first_name}}. I work with [[tribe]]. Most say [[pain]]. True for you?" },
  { key: "B", label: "Location", body: "Thanks for connecting, {{first_name}}. I work with owners around {{city}}. Most say [[pain]]. True for you?" },
];
const slots = [
  { key: "tribe", label: "Who you help" },
  { key: "pain", label: "What they say most" },
];

describe("group tests", () => {
  it("validates a test and finds its fill-ins", () => {
    assert.deepEqual(slotsUsed(arms).sort(), ["pain", "tribe"]);
    assert.equal(validateTest({ name: "Callout", arms, slots, step_type: "message" }), null);
    assert.match(validateTest({ name: "Callout", arms, slots: [slots[0]!], step_type: "message" }) ?? "", /\[\[pain\]\]/);
    assert.match(validateTest({ name: "x", arms: [arms[0]!], slots, step_type: "message" }) ?? "", /2 versions/);
  });

  it("fills each coach's slots and leaves merge fields for send time", () => {
    const { fills, error } = validateFills(slots, { tribe: " Midlands engineering MDs ", pain: "margins are the worry" });
    assert.equal(error, null);
    assert.equal(fillArm(arms[0]!.body, fills), "Thanks for connecting, {{first_name}}. I work with Midlands engineering MDs. Most say margins are the worry. True for you?");
    assert.match(validateFills(slots, { tribe: "x" }).error ?? "", /What they say most/);
    assert.match(validateFills(slots, { tribe: "{{bad}}", pain: "y" }).error ?? "", /brackets/);
  });

  it("only calls a winner when the gap is unlikely to be luck", () => {
    assert.ok((pValue(30, 1000, 10, 1000) ?? 1) < 0.01);
    assert.ok((pValue(11, 1000, 10, 1000) ?? 0) > 0.5);
    const early = verdict(
      [
        { key: "A", label: "Tribe", people: 120, accepted: 30, replied: 6, interested: 3, coaches: 4 },
        { key: "B", label: "Location", people: 118, accepted: 25, replied: 4, interested: 1, coaches: 4 },
      ],
      "interested",
      1500
    );
    assert.match(early, /Too early/);
    const clear = verdict(
      [
        { key: "A", label: "Tribe", people: 2000, accepted: 500, replied: 120, interested: 60, coaches: 9 },
        { key: "B", label: "Location", people: 2000, accepted: 420, replied: 70, interested: 20, coaches: 9 },
      ],
      "interested",
      1500
    );
    assert.match(clear, /Tribe is winning/);
  });
});
