import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseLinkedInSsi, pillarsFromCache } from "./linkedinSsi";

describe("parseLinkedInSsi", () => {
  it("reads Unipile-wrapped Sales API memberScore", () => {
    const parsed = parseLinkedInSsi({
      object: "LinkedinRawData",
      data: {
        memberScore: { ssi: 72.41 },
        industry: { top: 15, industryName: "Professional Training" },
        network: { top: 10 },
      },
    });
    assert.deepEqual(parsed, {
      score: 72.4,
      industryTop: 15,
      networkTop: 10,
      pillars: [],
    });
  });

  it("reads a bare SSI number", () => {
    const parsed = parseLinkedInSsi({ ssi: 64 });
    assert.deepEqual(parsed, {
      score: 64,
      industryTop: null,
      networkTop: null,
      pillars: [],
    });
  });

  it("reads nested currentScore", () => {
    const parsed = parseLinkedInSsi({
      socialSellingIndex: { currentScore: { score: 81.05 } },
    });
    assert.equal(parsed?.score, 81.1);
    assert.deepEqual(parsed?.pillars, []);
  });

  it("rejects out-of-range and missing scores", () => {
    assert.equal(parseLinkedInSsi({ memberScore: { ssi: 140 } }), null);
    assert.equal(parseLinkedInSsi({ headline: "Coach" }), null);
    assert.equal(parseLinkedInSsi(null), null);
  });

  it("does not treat industry percentile as the score", () => {
    const parsed = parseLinkedInSsi({
      memberScore: { ssi: 40 },
      industry: { ssi: 88, top: 22 },
    });
    assert.equal(parsed?.score, 40);
    assert.equal(parsed?.industryTop, 22);
  });

  it("reads salesApiSsi memberScore.overall and group ranks", () => {
    const parsed = parseLinkedInSsi({
      object: "LinkedinRawData",
      data: {
        memberScore: {
          overall: 54.6,
          subScores: [
            { score: 21, pillar: "PROFESSIONAL_BRAND" },
            { score: 6.4, pillar: "FIND_RIGHT_PEOPLE" },
            { score: 2.2, pillar: "INSIGHT_ENGAGEMENT" },
            { score: 25, pillar: "STRONG_RELATIONSHIP" },
          ],
        },
        groupScore: [
          {
            rank: 5,
            groupType: "INDUSTRY",
            score: { overall: 33.75 },
          },
          {
            rank: 24,
            groupType: "NETWORK",
            score: { overall: 46.19 },
          },
          {
            rank: 1,
            groupType: "TEAM",
            score: { overall: 54.6 },
          },
        ],
      },
    });
    assert.deepEqual(parsed, {
      score: 54.6,
      industryTop: 5,
      networkTop: 24,
      pillars: [
        {
          id: "brand",
          label: "Establish your professional brand",
          score: 21,
          max: 25,
        },
        {
          id: "people",
          label: "Find the right people",
          score: 6.4,
          max: 25,
        },
        {
          id: "engagement",
          label: "Engage with insights",
          score: 2.2,
          max: 25,
        },
        {
          id: "relationships",
          label: "Build relationships",
          score: 25,
          max: 25,
        },
      ],
    });
  });

  it("reads cached pillar objects and ignores junk keys", () => {
    assert.deepEqual(
      pillarsFromCache({
        brand: 12.79,
        people: "8.51",
        engagement: -1,
        relationships: 40,
        extra: 9,
      }),
      [
        {
          id: "brand",
          label: "Establish your professional brand",
          score: 12.8,
          max: 25,
        },
        {
          id: "people",
          label: "Find the right people",
          score: 8.5,
          max: 25,
        },
      ]
    );
  });
});
