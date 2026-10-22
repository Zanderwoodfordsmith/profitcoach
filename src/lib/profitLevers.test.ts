import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EXAMPLE, eachBetterBy, formatChange, formatMoney, rangeFor, resultsOf, shareForGoal } from "./profitLevers";

describe("profit levers", () => {
  it("matches the run sheet: £1.98M sales a year", () => {
    const now = resultsOf(EXAMPLE);
    assert.equal(now.customers, 30);
    assert.equal(now.sales, 1_980_000);
    assert.equal(formatMoney(now.sales), "£1.98M");
  });

  it("10% on all five makes £3.19M, 61% more, and leaves margin alone", () => {
    const better = eachBetterBy(EXAMPLE, 0.1);
    const sales = resultsOf(better).sales;
    assert.equal(formatMoney(sales), "£3.19M");
    assert.equal(formatChange(sales / 1_980_000 - 1), "+61%");
    assert.equal(better.margin, EXAMPLE.margin);
  });

  it("never pushes a rate past 100%", () => {
    assert.equal(eachBetterBy({ ...EXAMPLE, meetingRate: 0.95 }, 0.1).meetingRate, 1);
  });

  it("spreads a goal evenly: doubling sales needs about 15% on each", () => {
    const share = shareForGoal(EXAMPLE, 3_960_000);
    assert.ok(share !== null && Math.abs(share - 0.1487) < 0.001);
    assert.ok(Math.abs(resultsOf(eachBetterBy(EXAMPLE, share!)).sales - 3_960_000) < 1);
    assert.equal(shareForGoal({ ...EXAMPLE, leads: 0 }, 1_000_000), null);
  });

  it("gives every lever room to grow past where it is", () => {
    assert.deepEqual(rangeFor("winRate", 0.25), { min: 0, max: 1, step: 0.005 });
    assert.equal(rangeFor("leads", 20).max, 50);
    assert.equal(rangeFor("averageSale", 22_000).max, 100_000);
    assert.equal(rangeFor("timesBought", 3).max, 10);
  });
});
