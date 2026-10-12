import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assessProgrammeShortfall,
  listUnrecoveredFailedCharges,
  type ProgrammeShortfallPayment,
} from "./programmeShortfall";

const NOW = new Date("2026-10-12T12:00:00Z");

function pay(
  amountCents: number,
  paidAt: string,
  currency = "gbp"
): ProgrammeShortfallPayment {
  return { amountCents, currency, status: "succeeded", paidAt };
}

describe("assessProgrammeShortfall", () => {
  it("flags a £15,000 plan with one £5,000 instalment", () => {
    const result = assessProgrammeShortfall(
      {
        joinedAt: "2025-03-31",
        payments: [pay(500_000, "2025-04-01T09:34:08Z")],
      },
      NOW
    );
    assert.equal(result?.kind, "overdue");
    assert.equal(result?.short_cents, 1_000_000);
    assert.match(result?.explanation ?? "", /£15,000/);
    assert.match(result?.explanation ?? "", /£10,000/);
  });

  it("treats a completed £9,600 February 2025 plan as paid", () => {
    const result = assessProgrammeShortfall(
      {
        joinedAt: "2025-02-14",
        payments: [pay(960_000, "2025-02-15T00:00:00Z")],
      },
      NOW
    );
    assert.equal(result, null);
  });

  it("treats a completed £7,800 plan in August 2024 as the outgoing price", () => {
    const result = assessProgrammeShortfall(
      {
        joinedAt: "2024-08-06",
        payments: [
          pay(260_000, "2024-08-06T00:00:00Z"),
          pay(260_000, "2024-09-06T00:00:00Z"),
          pay(260_000, "2024-10-07T00:00:00Z"),
        ],
      },
      NOW
    );
    assert.equal(result, null);
  });

  it("does not flag a dollar programme paid in full", () => {
    const result = assessProgrammeShortfall(
      {
        joinedAt: "2025-05-15",
        payments: [pay(1_260_000, "2025-05-16T00:00:00Z", "usd")],
      },
      NOW
    );
    assert.equal(result, null);
  });

  it("flags a coach with no programme payment on file", () => {
    const result = assessProgrammeShortfall(
      {
        joinedAt: "2024-08-14",
        payments: [pay(49_500, "2025-09-01T00:00:00Z")],
      },
      NOW
    );
    assert.equal(result?.kind, "missing");
    assert.equal(result?.short_cents, 960_000);
  });

  it("leaves a 2026 plan alone when the last instalment is recent", () => {
    const result = assessProgrammeShortfall(
      {
        joinedAt: "2026-04-15",
        payments: [
          pay(150_000, "2026-04-15T00:00:00Z"),
          pay(150_000, "2026-05-15T00:00:00Z"),
          pay(150_000, "2026-06-15T00:00:00Z"),
          pay(150_000, "2026-07-15T00:00:00Z"),
          pay(150_000, "2026-08-15T00:00:00Z"),
          pay(150_000, "2026-09-15T00:00:00Z"),
        ],
      },
      NOW
    );
    assert.equal(result, null);
  });

  it("flags a 2026 plan whose instalments have stopped", () => {
    const result = assessProgrammeShortfall(
      {
        joinedAt: "2026-04-01",
        payments: [pay(150_000, "2026-04-01T00:00:00Z")],
      },
      NOW
    );
    assert.equal(result?.kind, "overdue");
    assert.equal(result?.short_cents, 840_000);
  });

  it("does not flag an account created date when no programme payment exists", () => {
    const result = assessProgrammeShortfall(
      {
        joinedAt: "2026-02-12",
        payments: [],
        joinedOnProgrammeDate: false,
      },
      NOW
    );
    assert.equal(result, null);
  });

  it("ignores coaches who joined before the priced programme", () => {
    const result = assessProgrammeShortfall(
      { joinedAt: "2023-11-01", payments: [] },
      NOW
    );
    assert.equal(result, null);
  });
});

describe("listUnrecoveredFailedCharges", () => {
  it("hides a failure that was paid on a later attempt", () => {
    const rows = listUnrecoveredFailedCharges([
      {
        coachId: "hilary",
        coachSlug: "hilary",
        coachName: "Hilary Mcnair",
        email: "hilary.mcnair1@gmail.com",
        amountCents: 500_000,
        currency: "gbp",
        status: "failed",
        paidAt: "2025-06-13T16:00:00Z",
        declineReason: "insufficient_funds",
        description: null,
      },
      {
        coachId: "hilary",
        coachSlug: "hilary",
        coachName: "Hilary Mcnair",
        email: "hilary.mcnair1@gmail.com",
        amountCents: 500_000,
        currency: "gbp",
        status: "succeeded",
        paidAt: "2025-06-14T16:55:42Z",
        declineReason: null,
        description: null,
      },
    ]);
    assert.equal(rows.length, 0);
  });

  it("hides a large failure once later payments cover that amount", () => {
    const rows = listUnrecoveredFailedCharges([
      {
        coachId: "sri",
        coachSlug: "sri",
        coachName: "Sridhar Narayanan",
        email: "sridharnarayanan84@gmail.com",
        amountCents: 1_500_000,
        currency: "gbp",
        status: "failed",
        paidAt: "2025-05-08T00:00:00Z",
        declineReason: null,
        description: null,
      },
      {
        coachId: "sri",
        coachSlug: "sri",
        coachName: "Sridhar Narayanan",
        email: "sridharnarayanan84@gmail.com",
        amountCents: 500_000,
        currency: "gbp",
        status: "succeeded",
        paidAt: "2025-05-09T00:00:00Z",
        declineReason: null,
        description: null,
      },
      {
        coachId: "sri",
        coachSlug: "sri",
        coachName: "Sridhar Narayanan",
        email: "sridharnarayanan84@gmail.com",
        amountCents: 500_000,
        currency: "gbp",
        status: "succeeded",
        paidAt: "2025-05-21T00:00:00Z",
        declineReason: null,
        description: null,
      },
      {
        coachId: "sri",
        coachSlug: "sri",
        coachName: "Sridhar Narayanan",
        email: "sridharnarayanan84@gmail.com",
        amountCents: 500_000,
        currency: "gbp",
        status: "succeeded",
        paidAt: "2025-05-21T01:00:00Z",
        declineReason: null,
        description: null,
      },
    ]);
    assert.equal(rows.length, 0);
  });

  it("keeps a failure with no later payment of the same amount", () => {
    const rows = listUnrecoveredFailedCharges([
      {
        coachId: "christian",
        coachSlug: "christian",
        coachName: "Christian Mcclellan",
        email: "christian@example.com",
        amountCents: 1_050_000,
        currency: "usd",
        status: "failed",
        paidAt: "2025-03-17T00:00:00Z",
        declineReason: "card_declined",
        description: "Settlement",
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.failureCount, 1);
    assert.equal(rows[0]?.coachName, "Christian Mcclellan");
  });
});
