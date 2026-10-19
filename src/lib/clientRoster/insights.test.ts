import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLIENT_SOURCE_LABELS,
  CLIENT_SOURCES,
  parseChoice,
  parseClientSource,
  parseRevenueBand,
  parseTeamSize,
  REVENUE_BAND_LABELS,
  REVENUE_BANDS,
} from "./fields";
import { clientInsights } from "./insights";

const c = (o: Partial<Parameters<typeof clientInsights>[0][number]>) => ({
  client_sector: null,
  client_revenue_band: null,
  client_team_size: null,
  client_source: null,
  client_fee_amount: null,
  client_fit: null,
  client_result: null,
  ...o,
});

describe("client insights", () => {
  it("reads spreadsheet wording for bands and sources", () => {
    assert.equal(parseChoice("£1m to £2m", REVENUE_BANDS, REVENUE_BAND_LABELS, "revenue band"), "1m_2m");
    assert.equal(parseChoice("1m_2m", REVENUE_BANDS, REVENUE_BAND_LABELS, "revenue band"), "1m_2m");
    assert.equal(parseChoice("Referral", CLIENT_SOURCES, CLIENT_SOURCE_LABELS, "source"), "referral");
    assert.equal(parseChoice("", CLIENT_SOURCES, CLIENT_SOURCE_LABELS, "source"), null);
    assert.throws(() => parseChoice("carrier pigeon", CLIENT_SOURCES, CLIENT_SOURCE_LABELS, "source"), /isn't a source/);
  });

  it("describes the best clients, weighting the ones they'd want more of", () => {
    const out = clientInsights([
      c({ client_sector: "Construction", client_revenue_band: "1m_2m", client_team_size: "16_50", client_source: "referral", client_fit: 5, client_fee_amount: 2000 }),
      c({ client_sector: "construction", client_revenue_band: "1m_2m", client_team_size: "16_50", client_source: "referral", client_fit: 4, client_fee_amount: 2500 }),
      c({ client_sector: "Retail", client_revenue_band: "under_500k", client_team_size: "1_5", client_source: "linkedin_outreach", client_fit: 1 }),
    ]);
    assert.equal(out.summary, "Your best clients are mostly £1m to £2m turnover construction businesses with 16 to 50 staff, and most found you through referral.");
    assert.equal(out.best, 2);
    assert.equal(out.averageFee, 2250);
    assert.equal(out.sectors[0]!.label, "Construction");
  });

  it("says what's missing instead of guessing", () => {
    const out = clientInsights([c({}), c({})]);
    assert.equal(out.summary, null);
    assert.equal(out.missing.length, 3);
  });
});

describe("forgiving spreadsheet values", () => {
  it("reads turnover however people type it", () => {
    assert.equal(parseRevenueBand("£1m-£3m"), "2m_5m");
    assert.equal(parseRevenueBand("1-1.5m"), "1m_2m");
    assert.equal(parseRevenueBand("750k"), "500k_1m");
    assert.equal(parseRevenueBand("£1,200,000"), "1m_2m");
    assert.equal(parseRevenueBand("2.5"), "2m_5m");
    assert.equal(parseRevenueBand("Under £500k"), "under_500k");
    assert.equal(parseRevenueBand("12 million"), "10m_plus");
    assert.equal(parseRevenueBand(""), null);
    assert.throws(() => parseRevenueBand("not sure"));
  });

  it("reads team size and source", () => {
    assert.equal(parseTeamSize("10-24"), "16_50");
    assert.equal(parseTeamSize("4"), "1_5");
    assert.equal(parseTeamSize("about 30"), "16_50");
    assert.equal(parseTeamSize("6 to 15"), "6_15");
    assert.equal(parseClientSource("Referred by Sam"), "referral");
    assert.equal(parseClientSource("LinkedIn"), "linkedin_outreach");
    assert.equal(parseClientSource("saw my LinkedIn posts"), "linkedin_content");
    assert.equal(parseClientSource("BOSS Score"), "scorecard");
    assert.equal(parseClientSource("golf club"), "other");
  });
});
