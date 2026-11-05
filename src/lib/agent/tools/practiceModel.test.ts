import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkRate, moneyIn, paceWords, practiceModel, workBack } from "./practiceModel";

describe("practice model: the ceiling and how long to the goal", () => {
  it("one client every 3 months, kept 12 months at £2,000 tops out at 4 clients and £8,000", () => {
    const m = practiceModel({ signed_180d: 2, client_join_months_ago: [], fee_month: 2000, months_kept: 12, goal_income_month: null });
    assert.equal(m.ceiling_clients, 4);
    assert.equal(m.ceiling_income, 8000);
    assert.equal(m.months_to_ceiling, 12);
  });

  it("counts only clients within one lifetime as still with them", () => {
    const m = practiceModel({ signed_180d: 2, client_join_months_ago: [1, 4, 14], fee_month: 2000, months_kept: 12, goal_income_month: null });
    assert.equal(m.clients_now, 2);
    assert.equal(m.income_now, 4000);
    assert.equal(m.months_to_ceiling, 6);
  });

  it("says what each number would need when the goal is above the ceiling", () => {
    const m = practiceModel({ signed_180d: 2, client_join_months_ago: [], fee_month: 2000, months_kept: 12, goal_income_month: 10000 });
    assert.equal(m.goal_clients, 5);
    assert.equal(m.goal_reachable, false);
    assert.equal(m.months_to_goal, null);
    assert.deepEqual(m.to_reach_goal, { sign_one_every_months: 2.4, or_months_kept: 15, or_fee: 2500 });
  });

  it("gives the time to a goal under the ceiling", () => {
    const m = practiceModel({ signed_180d: 6, client_join_months_ago: [0, 1], fee_month: 2000, months_kept: 12, goal_income_month: 10000 });
    assert.equal(m.goal_reachable, true);
    assert.equal(m.months_to_goal, 3);
  });
});

describe("work back from the goal", () => {
  it("shows people a month at their rates, at Good and at Great", () => {
    const w = workBack({
      goal_clients: 5,
      months_kept: 12,
      outbound_month: 400,
      inbound_interested_month: null,
      their_outbound_to_interested: 0.005,
      their_interested_to_client: null,
    })!;
    assert.equal(w.sign_one_every_months, 2.4);
    const [theirs, good, great] = w.plans;
    // Good: 10% of interested become clients, 1% of outbound get interested.
    assert.equal(good.interested_a_month, 4.2);
    assert.equal(good.outbound_a_month, 420);
    // Their outbound rate is half of Good, so twice the people.
    assert.equal(theirs.outbound_a_month, 840);
    // Great: 40% and 2%.
    assert.equal(great.outbound_a_month, 60);
  });

  it("counts inbound interest first", () => {
    const w = workBack({ goal_clients: 5, months_kept: 12, outbound_month: 0, inbound_interested_month: 5, their_outbound_to_interested: null, their_interested_to_client: null })!;
    assert.equal(w.plans[1].outbound_a_month, 0);
  });

  it("marks a zero rate as never", () => {
    const w = workBack({ goal_clients: 5, months_kept: 12, outbound_month: 400, inbound_interested_month: null, their_outbound_to_interested: 0, their_interested_to_client: null })!;
    assert.equal(w.plans[0].outbound_a_month, -1);
  });
});

describe("rates against the Scoreboard", () => {
  it("bands a rate and waits for enough people", () => {
    assert.equal(checkRate("outbound_to_interested", 2, 400).band, "below_good");
    assert.equal(checkRate("outbound_to_interested", 5, 400).band, "good");
    assert.equal(checkRate("outbound_to_interested", 8, 400).band, "great");
    assert.equal(checkRate("outbound_to_interested", 0, 100).band, "too_early");
    assert.equal(checkRate("calls_to_client", 1, 5).band, "good");
    assert.equal(checkRate("calls_to_client", 0, 5).side, "sales");
  });
});

describe("signing pace in words", () => {
  it("says weeks under 2 months, months otherwise", () => {
    assert.equal(paceWords(2 / 3), "one every 7 weeks");
    assert.equal(paceWords(5 / 12), "one every 2.4 months");
    assert.equal(paceWords(0), "no clients signed yet");
  });
});

describe("money in free text", () => {
  it("reads the first amount", () => {
    assert.equal(moneyIn("£1,500 a month with a six-month minimum"), 1500);
    assert.equal(moneyIn("£2k a month"), 2000);
    assert.equal(moneyIn("six months at 3k"), 3000);
    assert.equal(moneyIn("to be agreed"), null);
  });
});
