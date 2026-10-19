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
      [...new Set(LIBRARY_SEEDS.map((seed) => seed.kind))],
      [...CAMPAIGN_LIBRARY_KINDS]
    );
    assert.deepEqual(
      LIBRARY_SEEDS.map((seed) => seed.name),
      [
        "Connection",
        "Tribe connection",
        "Reactivation",
        "Warm network",
        "Ongoing nurture",
        "Positive replies",
      ]
    );
  });

  it("puts no link in any connection note or cold first message", () => {
    for (const seed of LIBRARY_SEEDS) {
      if (seed.kind !== "connector" && seed.kind !== "reactivation") continue;
      for (const step of seed.steps) {
        const bodies = [step.body ?? "", ...(step.variants ?? []).map((v) => v.body)];
        for (const body of bodies) {
          assert.equal(/https?:|{{(assessment_url|scorecard_link|scorecard_url)}}/.test(body), false, `${seed.name}: ${body.slice(0, 40)}`);
        }
      }
    }
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
