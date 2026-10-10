import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sortPaymentCoachesForAssign } from "./paymentCoachAssignSort";

const coaches = [
  { id: "a", full_name: "Zara Quinn", slug: "zara", joined_at: "2024-01-02" },
  { id: "b", full_name: "adam bell", slug: "adam", joined_at: "2026-03-01" },
  { id: "c", full_name: null, slug: "no-name", joined_at: null },
  { id: "d", full_name: "Mina Cole", slug: "mina", joined_at: "2026-09-15" },
];

describe("sortPaymentCoachesForAssign", () => {
  it("sorts A–Z by display name", () => {
    const sorted = sortPaymentCoachesForAssign(coaches, "az", (name) => name ?? "");
    assert.deepEqual(
      sorted.map((coach) => coach.id),
      ["b", "d", "c", "a"]
    );
  });

  it("sorts by join date, most recent first, with missing dates last", () => {
    const sorted = sortPaymentCoachesForAssign(
      coaches,
      "joined",
      (name) => name ?? ""
    );
    assert.deepEqual(
      sorted.map((coach) => coach.id),
      ["d", "b", "a", "c"]
    );
  });
});
