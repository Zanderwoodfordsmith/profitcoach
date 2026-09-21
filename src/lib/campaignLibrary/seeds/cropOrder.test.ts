import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIBRARY_SEEDS } from "./catalog";
import {
  CAMPAIGN_LIBRARY_KINDS,
  sortByCampaignLibraryKind,
} from "../types";

describe("CROP template order", () => {
  it("seeds Connection, Reactivation, Ongoing nurture, then Positive replies", () => {
    assert.deepEqual(
      LIBRARY_SEEDS.map((seed) => seed.kind),
      [...CAMPAIGN_LIBRARY_KINDS]
    );
    assert.deepEqual(
      LIBRARY_SEEDS.map((seed) => seed.name),
      ["Connection", "Reactivation", "Ongoing nurture", "Positive replies"]
    );
  });

  it("sorts published templates into CROP order even when recency is reversed", () => {
    const ordered = sortByCampaignLibraryKind([
      { kind: "positive_reply", name: "Positive replies" },
      { kind: "nurture", name: "Ongoing nurture" },
      { kind: "reactivation", name: "Reactivation" },
      { kind: "connector", name: "Connection" },
    ]);
    assert.deepEqual(
      ordered.map((item) => item.name),
      ["Connection", "Reactivation", "Ongoing nurture", "Positive replies"]
    );
  });
});
