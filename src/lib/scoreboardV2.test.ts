import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GREAT, STARTING, volumesOf } from "./scoreboard";
import { MAX_CLIENTS, extraGainIfHit, fullnessOf, needsForV2, paceText, readSavedV2, volumesOfV2, type ExtraSource } from "./scoreboardV2";

const referrals: ExtraSource = { id: "r", name: "Referrals", amount: 2, rate: 0.5, target: 0.5 };

describe("Scoreboard V2 maths", () => {
  it("matches V1 when no source is added: 400 outbound comes to £12k", () => {
    assert.deepEqual(volumesOfV2(STARTING, []), volumesOf(STARTING));
    assert.equal(Math.round(volumesOf(STARTING).income), 12000);
  });

  it("adds an added source to interested", () => {
    assert.equal(volumesOfV2(STARTING, [referrals]).interested, volumesOf(STARTING).interested + 1);
  });

  it("scales added sources with the rest for a target", () => {
    const need = needsForV2(24000, STARTING, [referrals]);
    const now = volumesOfV2(STARTING, [referrals]).income;
    assert.ok(Math.abs(need.income - 24000) < 1e-6);
    assert.ok(Math.abs(need.extra[0] - 2 * (24000 / now)) < 1e-9);
  });

  it("says what hitting an added source's target adds", () => {
    const low = { ...referrals, rate: 0.25 };
    assert.ok(extraGainIfHit(STARTING, [low], "r") > 0);
    assert.equal(extraGainIfHit(STARTING, [referrals], "r"), 0);
  });

  it("stops at 20 clients, so Great at 400 outbound is £40k, not £96k", () => {
    const great = { ...STARTING, ...GREAT, inbound: 4 };
    const v = volumesOfV2(great, []);
    assert.equal(v.clients, MAX_CLIENTS);
    assert.equal(Math.round(v.income), 40000);
    const f = fullnessOf(great, []);
    assert.equal(f.full, true);
    assert.equal(f.fullInMonths, 5);
  });

  it("still says what a target needs past the cap", () => {
    const need = needsForV2(60000, STARTING, []);
    assert.ok(Math.abs(need.income - 60000) < 1e-6);
  });

  it("keeps saved sources tidy", () => {
    const saved = readSavedV2(JSON.stringify({ extra: [{ id: "a", name: "Partners", amount: 3, rate: 2, target: 0.4 }, { nope: 1 }], picked: [10000, 7] }));
    assert.equal(saved.extra.length, 1);
    assert.equal(saved.extra[0].rate, 0.5);
    assert.deepEqual(saved.picked, [10000]);
    assert.deepEqual(readSavedV2("not json").extra, []);
    assert.equal(readSavedV2(JSON.stringify({ now: { outbound: 250, fee: -5 } })).now.outbound, 250);
    assert.equal(readSavedV2(JSON.stringify({ now: { outbound: 250, fee: -5 } })).now.fee, STARTING.fee);
  });
});

describe("pace in words", () => {
  it("weeks up to 8, then months", () => {
    assert.equal(paceText(6.5), "7 weeks");
    assert.equal(paceText(8.7), "2 months");
    assert.equal(paceText(10.4), "2.4 months");
    assert.equal(paceText(null), "never");
  });
});
