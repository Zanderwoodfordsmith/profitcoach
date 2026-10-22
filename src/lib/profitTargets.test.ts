import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EXAMPLE, defaultProfitTargets, gainIfHit, labelRows, needsFor, pounds, profitOf, volumesOf } from "./profitTargets";

describe("profit targets", () => {
  it("matches the run sheet: £1.98M sales and £792k gross profit", () => {
    const v = volumesOf(EXAMPLE);
    assert.equal(v.leads, 240);
    assert.equal(v.customers, 30);
    assert.equal(v.sales, 1_980_000);
    assert.equal(pounds(v.grossProfit), "£792k");
  });

  it("takes marketing and overheads off when costs are on", () => {
    // £792k gross - £12k marketing (240 leads × £50) - £400k overheads.
    assert.equal(profitOf(EXAMPLE, true), 380_000);
    assert.equal(profitOf(EXAMPLE, false), 792_000);
  });

  it("works out the leads a target needs, and they make exactly that profit", () => {
    for (const costs of [false, true]) {
      const need = needsFor(1_000_000, EXAMPLE, costs);
      assert.ok(Math.abs((costs ? need.netProfit : need.grossProfit) - 1_000_000) < 1e-6);
    }
    // Gross: £3,300 of gross profit a lead, so £1M needs about 303 leads.
    assert.equal(Math.round(needsFor(1_000_000, EXAMPLE, false).leads), 303);
  });

  it("says what hitting one target adds", () => {
    // 10% more meetings is 10% more gross profit.
    assert.ok(Math.abs(gainIfHit(EXAMPLE, "meetingRate", 0.55, false) - 79_200) < 1e-6);
    // A cheaper lead only matters with costs on.
    assert.equal(gainIfHit(EXAMPLE, "costPerLead", 40, false), 0);
    assert.equal(gainIfHit(EXAMPLE, "costPerLead", 40, true), 2_400);
  });

  it("starts the three £ targets above where they are, rounded", () => {
    assert.deepEqual(defaultProfitTargets(792_000), { need: 990_000, great: 1_300_000, amazing: 2_000_000 });
  });
});

describe("target labels", () => {
  it("moves a label up a line when two targets sit close together", () => {
    // Need £990k and Great £1.3M against Amazing £2M: Great fits beside Amazing, Need goes up.
    assert.deepEqual(labelRows([0.495, 0.65, 1], 0.3), [1, 0, 0]);
    assert.deepEqual(labelRows([0.2, 0.6, 1], 0.3), [0, 0, 0]);
  });
});
