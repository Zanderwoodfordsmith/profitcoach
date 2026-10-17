import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SalesNavImportedLead } from "@/lib/apify/salesNavigatorTypes";
import {
  mergeSalesNavLeadSnapshots,
  rankSalesNavSnapshot,
} from "./importJob";

function lead(slug: string, title = "Owner"): SalesNavImportedLead {
  return {
    fullName: slug,
    firstName: slug,
    lastName: null,
    jobTitle: title,
    company: null,
    linkedinUrl: `https://www.linkedin.com/in/${slug}`,
    location: null,
    email: null,
    headline: null,
    about: null,
    photoUrl: null,
    tenureLabel: null,
    monthsAtCompany: null,
    monthsInRole: null,
    yearsAtCompanyBucket: null,
    premium: false,
    openProfile: null,
    raw: {},
  };
}

describe("mergeSalesNavLeadSnapshots", () => {
  it("keeps Sales Nav order and tags the segment", () => {
    const merged = mergeSalesNavLeadSnapshots([], [lead("b"), lead("a")], 0);
    assert.deepEqual(
      merged.map((row) => [row.fullName, row.segment]),
      [
        ["b", 0],
        ["a", 0],
      ]
    );
  });

  it("keeps a repeat person at their first position and segment", () => {
    const first = mergeSalesNavLeadSnapshots([], [lead("a"), lead("b")], 0);
    const merged = mergeSalesNavLeadSnapshots(
      first,
      [lead("c"), lead("a", "Director")],
      1
    );
    assert.deepEqual(
      merged.map((row) => [row.fullName, row.segment, row.jobTitle]),
      [
        ["a", 0, "Director"],
        ["b", 0, "Owner"],
        ["c", 1, "Owner"],
      ]
    );
  });
});

describe("rankSalesNavSnapshot", () => {
  it("leaves a single search in Sales Nav order", () => {
    const rows = [{ id: "x", segment: 0 }, { id: "y", segment: 0 }];
    assert.deepEqual(
      rankSalesNavSnapshot(rows).map((row) => row.id),
      ["x", "y"]
    );
  });

  it("interleaves split searches best-first", () => {
    const rows = [
      { id: "s0-1", segment: 0 },
      { id: "s0-2", segment: 0 },
      { id: "s0-3", segment: 0 },
      { id: "s1-1", segment: 1 },
      { id: "s2-1", segment: 2 },
      { id: "s2-2", segment: 2 },
    ];
    assert.deepEqual(
      rankSalesNavSnapshot(rows).map((row) => row.id),
      ["s0-1", "s1-1", "s2-1", "s0-2", "s2-2", "s0-3"]
    );
  });

  it("treats old snapshots without a segment as one search", () => {
    const rows: Array<{ id: string; segment?: number }> = [{ id: "x" }, { id: "y" }];
    assert.deepEqual(
      rankSalesNavSnapshot(rows).map((row) => row.id),
      ["x", "y"]
    );
  });
});
