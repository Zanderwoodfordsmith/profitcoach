import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EXAMPLE,
  EXAMPLE_MARKETING,
  EXAMPLE_YEAR,
  costPerCustomer,
  costPerLead,
  defaultProfitTargets,
  gainIfHit,
  improvedBy,
  lifetimeGross,
  monthOf,
  needsFor,
  overheadsFrom,
  profitAYear,
  salesCheck,
  type Numbers,
} from "./profitPublic";

const NOW: Numbers = { ...EXAMPLE, marketing: EXAMPLE_MARKETING, overheads: overheadsFrom(EXAMPLE_YEAR, EXAMPLE.margin, EXAMPLE_MARKETING) };

describe("profit levers, public page", () => {
  it("works out overheads from last year's sales and profit", () => {
    // £2M × 40% = £800k kept; £400k profit left, so £400k of costs, £33,333 a month: £5,000 marketing and the rest overheads.
    assert.ok(Math.abs(NOW.overheads + NOW.marketing - 400_000 / 12) < 1e-6);
  });

  it("runs traffic down to profit: the run sheet's £1.98M sales", () => {
    const m = monthOf(NOW);
    assert.equal(m.leads, 20);
    assert.ok(Math.abs(m.sales * 12 - 1_980_000) < 1e-6);
    assert.ok(Math.abs(profitAYear(NOW) - 392_000) < 1e-6);
  });

  it("says whether their numbers add up to the sales they gave", () => {
    assert.equal(salesCheck(NOW, EXAMPLE_YEAR).ok, true);
    assert.equal(salesCheck(NOW, { sales: 3_000_000, profit: 400_000 }).ok, false);
  });

  it("10% on all seven nearly doubles gross profit and moves overheads not at all", () => {
    const better = improvedBy(NOW, 0.1);
    assert.ok(Math.abs(monthOf(better).grossProfit / monthOf(NOW).grossProfit - Math.pow(1.1, 7)) < 1e-9);
    assert.equal(better.overheads, NOW.overheads);
  });

  it("finds the traffic each profit target needs", () => {
    const need = needsFor(1_000_000, NOW);
    assert.ok(Math.abs(need.profit * 12 - 1_000_000) < 1e-6);
  });

  it("values a cut in overheads", () => {
    // 10% off £28,333 a month of overheads is £34,000 a year.
    assert.ok(Math.abs(gainIfHit(NOW, "overheads", NOW.overheads * 0.9) - 34_000) < 1e-6);
  });

  it("works out cost per lead, cost to win a customer and lifetime gross value", () => {
    // £5,000 ÷ 20 leads; £5,000 ÷ 2.5 new customers; £22,000 × 3 a year × 40% × 3 years.
    assert.equal(costPerLead(NOW), 250);
    assert.equal(costPerCustomer(NOW), 2_000);
    assert.ok(Math.abs(lifetimeGross(NOW) - 79_200) < 1e-6);
    assert.equal(costPerLead({ ...NOW, marketing: 0 }), 0);
  });

  it("starts the three profit targets above last year", () => {
    // 20% more, double, triple.
    assert.deepEqual(defaultProfitTargets(400_000), { need: 480_000, great: 800_000, amazing: 1_200_000 });
  });
});
