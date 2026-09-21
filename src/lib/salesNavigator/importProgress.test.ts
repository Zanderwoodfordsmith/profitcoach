import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  jobDisplayTargetCount,
  salesNavLeadDedupeKey,
  segmentScrapedCap,
  shouldFinishUnipileSegment,
} from "./importProgress";

describe("salesNavLeadDedupeKey", () => {
  it("prefers LinkedIn URL", () => {
    assert.equal(
      salesNavLeadDedupeKey({
        linkedinUrl: "https://www.linkedin.com/in/Ada",
        fullName: "Ada",
        company: "X",
      }),
      "https://www.linkedin.com/in/ada"
    );
  });
});

describe("segmentScrapedCap", () => {
  it("caps a band at Unipile total_count instead of 2,500", () => {
    assert.equal(
      segmentScrapedCap({
        searchTotalCount: 91,
        pageTarget: 2500,
        importAll: true,
      }),
      91
    );
  });

  it("keeps the page target when the coach asked for a small list", () => {
    assert.equal(
      segmentScrapedCap({
        searchTotalCount: 800,
        pageTarget: 250,
        importAll: false,
      }),
      250
    );
  });
});

describe("jobDisplayTargetCount", () => {
  it("shows the LinkedIn extract cap until band totals arrive", () => {
    assert.equal(
      jobDisplayTargetCount({
        pageTarget: 2500,
        importAll: true,
        segmentPlan: [{}, {}, {}],
      }),
      2500
    );
  });

  it("sums known band totals once every segment has reported", () => {
    assert.equal(
      jobDisplayTargetCount({
        pageTarget: 2500,
        importAll: true,
        segmentPlan: [
          { searchTotalCount: 222 },
          { searchTotalCount: 156 },
          { searchTotalCount: 60 },
        ],
      }),
      438
    );
  });

  it("uses known totals plus progress while later bands are still unknown", () => {
    assert.equal(
      jobDisplayTargetCount({
        pageTarget: 2500,
        progressCount: 69,
        importAll: true,
        segmentPlan: [{ searchTotalCount: 222 }, {}, {}],
      }),
      222
    );
  });
});

describe("shouldFinishUnipileSegment", () => {
  it("stops after two overlapping pages with no new people", () => {
    assert.equal(
      shouldFinishUnipileSegment({
        scrapedCount: 91,
        scrapedCap: 2500,
        nextCursor: "page-2",
        stalledCursor: false,
        itemsLength: 50,
        newUniqueCount: 0,
        duplicatePages: 2,
      }),
      true
    );
  });

  it("keeps going after one overlapping page when a next cursor exists", () => {
    assert.equal(
      shouldFinishUnipileSegment({
        scrapedCount: 10,
        scrapedCap: 1409,
        nextCursor: "page-2",
        stalledCursor: false,
        itemsLength: 10,
        newUniqueCount: 0,
        duplicatePages: 1,
      }),
      false
    );
  });

  it("keeps going when the page added unique people", () => {
    assert.equal(
      shouldFinishUnipileSegment({
        scrapedCount: 50,
        scrapedCap: 2500,
        nextCursor: "page-2",
        stalledCursor: false,
        itemsLength: 50,
        newUniqueCount: 40,
      }),
      false
    );
  });

  it("stops on an empty page", () => {
    assert.equal(
      shouldFinishUnipileSegment({
        scrapedCount: 10,
        scrapedCap: 1409,
        nextCursor: "page-2",
        stalledCursor: false,
        itemsLength: 0,
        newUniqueCount: 0,
      }),
      true
    );
  });
});
