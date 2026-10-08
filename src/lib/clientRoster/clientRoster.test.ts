import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientRosterToContactPatch,
  parseClientRosterCreate,
  parseFeeAmount,
  parseJoinedOn,
} from "./fields";
import {
  compareRosterClients,
  formatClientTenure,
  formatGbp,
  rosterSummaryLine,
} from "./format";

const now = new Date(2026, 9, 5, 12, 0, 0);

describe("client roster fields", () => {
  it("parses a monthly price with a pound sign and commas", () => {
    assert.equal(parseFeeAmount("£2,000"), 2000);
    assert.equal(parseFeeAmount("2000.5"), 2000.5);
    assert.equal(parseFeeAmount(""), null);
    assert.equal(parseFeeAmount(0), 0);
  });

  it("rejects a price that is not a number", () => {
    assert.throws(() => parseFeeAmount("-5"), /between 0 and 1,000,000/);
    assert.throws(() => parseFeeAmount("two thousand"), /number/);
  });

  it("parses a real join date and rejects an impossible one", () => {
    assert.equal(parseJoinedOn("2026-10-05"), "2026-10-05");
    assert.equal(parseJoinedOn(""), null);
    assert.throws(() => parseJoinedOn("2026-02-31"), /real date/);
  });

  it("requires a name when creating a client", () => {
    const created = parseClientRosterCreate({
      fullName: "  Jane Owner ",
      businessName: "Acme",
      joinedOn: "2024-01-15",
      feeAmount: "1500",
      problemNotes: " Cash is tight ",
    });
    assert.equal(created.fullName, "Jane Owner");
    assert.equal(created.feeAmount, 1500);
    assert.equal(created.problemNotes, "Cash is tight");
    assert.throws(() => parseClientRosterCreate({ businessName: "Acme" }), /name/);
  });

  it("maps roster fields onto contact columns", () => {
    const patch = clientRosterToContactPatch({
      fullName: "Jane Owner",
      feeAmount: 2000,
      joinedOn: "2024-01-15",
    });
    assert.equal(patch.full_name, "Jane Owner");
    assert.equal(patch.first_name, "Jane");
    assert.equal(patch.last_name, "Owner");
    assert.equal(patch.client_fee_amount, 2000);
    assert.equal(patch.client_joined_on, "2024-01-15");
  });
});

describe("client roster summary", () => {
  it("describes tenure from the join date", () => {
    assert.equal(formatClientTenure("2025-10-05", now), "1 year");
    assert.equal(formatClientTenure("2026-09-05", now), "1 month");
    assert.equal(formatClientTenure("2026-09-20", now), "2 weeks");
    assert.equal(formatClientTenure("2026-10-05", now), "Today");
    assert.equal(formatClientTenure("2026-11-01", now), "Not started");
  });

  it("sums price and averages how long clients have been on the roster", () => {
    const line = rosterSummaryLine(
      [
        { feeAmount: 2000, joinedOn: "2025-10-05" },
        { feeAmount: 1000, joinedOn: "2026-09-05" },
        { feeAmount: null, joinedOn: null },
      ],
      now
    );
    assert.equal(
      line,
      "3 clients · £3,000 a month on 2 of 3 · 7 months on average"
    );
    assert.equal(formatGbp(2000), "£2,000");
  });

  it("puts clients without a join date first", () => {
    const rows = [
      { fullName: "Bea", joinedOn: "2024-01-01" },
      { fullName: "Ada", joinedOn: null },
    ];
    assert.deepEqual([...rows].sort(compareRosterClients).map((row) => row.fullName), [
      "Ada",
      "Bea",
    ]);
  });
});
