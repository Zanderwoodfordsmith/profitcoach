import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  poolDisplayName,
  poolLeadCompany,
  poolRowFitsCampaignChannel,
  poolPlaceFields,
  poolRowMatchesCityFilter,
  poolRowMatchesContactFilter,
  poolRowMatchesDateAddedFilter,
  poolRowMatchesHeadcountFilter,
  poolRowMatchesIndustryFilter,
  poolRowMatchesLinkedInFilter,
  poolRowMatchesPostcodeFilter,
  poolRowMatchesTagFilter,
  ukPostcodeMatches,
  type PoolPerson,
} from "./poolPeople";

function person(partial: Partial<PoolPerson>): PoolPerson {
  return {
    id: "1",
    full_name: "Jane Smith",
    first_name: "Jane",
    last_name: "Smith",
    job_title: "Owner",
    company: "Acme Plumbing Ltd",
    linkedin_url: "https://www.linkedin.com/in/jane",
    email: "jane@acme.test",
    phone: "447700900000",
    website: "https://acme.test",
    address: null,
    location: null,
    city: null,
    postcode: null,
    team_size: null,
    industry: null,
    place_id: null,
    source: "manual",
    created_at: null,
    tags: [],
    in_campaign: false,
    blacklisted: false,
    campaignable: true,
    linkedinCampaignable: true,
    emailCampaignable: true,
    canFindPerson: false,
    contact_id: null,
    ...partial,
  };
}

describe("pool lead display", () => {
  it("strips Ltd from a Maps business name and hides duplicate company", () => {
    const row = person({
      full_name: "121 Plumbing Solutions LTD",
      company: "121 Plumbing Solutions LTD",
      linkedin_url: null,
      place_id: "ChIJM5Q-I-2_eEgReajl80S6RPc",
      canFindPerson: true,
      campaignable: false,
      linkedinCampaignable: false,
      emailCampaignable: false,
    });
    assert.equal(poolDisplayName(row), "121 Plumbing Solutions");
    assert.equal(poolLeadCompany(row), null);
  });

  it("keeps a person name and a distinct company without Ltd", () => {
    const row = person({});
    assert.equal(poolDisplayName(row), "Jane Smith");
    assert.equal(poolLeadCompany(row), "Acme Plumbing");
  });
});

describe("poolRowFitsCampaignChannel", () => {
  it("routes LinkedIn vs email eligibility", () => {
    const withBoth = person({});
    const emailOnly = person({
      linkedin_url: null,
      linkedinCampaignable: false,
      emailCampaignable: true,
      campaignable: true,
    });
    const liOnly = person({
      email: null,
      emailCampaignable: false,
      linkedinCampaignable: true,
      campaignable: true,
    });
    assert.equal(poolRowFitsCampaignChannel(withBoth, "linkedin"), true);
    assert.equal(poolRowFitsCampaignChannel(withBoth, "email"), true);
    assert.equal(poolRowFitsCampaignChannel(emailOnly, "linkedin"), false);
    assert.equal(poolRowFitsCampaignChannel(emailOnly, "email"), true);
    assert.equal(poolRowFitsCampaignChannel(liOnly, "linkedin"), true);
    assert.equal(poolRowFitsCampaignChannel(liOnly, "email"), false);
  });
});

describe("pool filters", () => {
  it("matches contact availability", () => {
    const both = person({});
    const emailOnly = person({ phone: null });
    const phoneOnly = person({ email: null });
    const none = person({ email: null, phone: null });
    assert.equal(poolRowMatchesContactFilter(both, "both"), true);
    assert.equal(poolRowMatchesContactFilter(emailOnly, "email"), true);
    assert.equal(poolRowMatchesContactFilter(emailOnly, "phone"), false);
    assert.equal(poolRowMatchesContactFilter(phoneOnly, "phone"), true);
    assert.equal(poolRowMatchesContactFilter(none, "none"), true);
    assert.equal(poolRowMatchesContactFilter(both, "none"), false);
  });

  it("matches date-added buckets", () => {
    const now = Date.parse("2026-09-14T12:00:00.000Z");
    const today = person({ created_at: "2026-09-14T08:00:00.000Z" });
    const week = person({ created_at: "2026-09-10T12:00:00.000Z" });
    const month = person({ created_at: "2026-08-20T12:00:00.000Z" });
    const older = person({ created_at: "2026-07-01T12:00:00.000Z" });
    assert.equal(poolRowMatchesDateAddedFilter(today, "today", now), true);
    assert.equal(poolRowMatchesDateAddedFilter(week, "7d", now), true);
    assert.equal(poolRowMatchesDateAddedFilter(month, "30d", now), true);
    assert.equal(poolRowMatchesDateAddedFilter(older, "older_than_30d", now), true);
    assert.equal(poolRowMatchesDateAddedFilter(week, "today", now), false);
  });

  it("matches tags", () => {
    const tagged = person({ tags: ["Hot", "Local"] });
    const empty = person({ tags: [] });
    assert.equal(poolRowMatchesTagFilter(tagged, "all"), true);
    assert.equal(poolRowMatchesTagFilter(tagged, "hot"), true);
    assert.equal(poolRowMatchesTagFilter(tagged, "missing"), false);
    assert.equal(poolRowMatchesTagFilter(empty, "none"), true);
    assert.equal(poolRowMatchesTagFilter(tagged, "none"), false);
  });

  it("parses city and postcode from a Maps address and a Sales Nav location", () => {
    assert.deepEqual(
      poolPlaceFields({
        address: "12 High Street, Manchester M1 1AA, United Kingdom",
      }),
      { city: "Manchester", postcode: "M1 1AA" }
    );
    assert.deepEqual(
      poolPlaceFields({
        address: "1-3 High St, York YO1 7HH, United Kingdom",
      }),
      { city: "York", postcode: "YO1 7HH" }
    );
    assert.deepEqual(
      poolPlaceFields({
        location: "Greater London, England, United Kingdom",
      }),
      { city: "Greater London", postcode: null }
    );
  });

  it("matches a postcode district without swallowing the next district", () => {
    assert.equal(ukPostcodeMatches("M1 1AA", "M1"), true);
    assert.equal(ukPostcodeMatches("M1A 1AA", "m1"), true);
    assert.equal(ukPostcodeMatches("M14 5AB", "M1"), false);
    assert.equal(ukPostcodeMatches("SW1A 1AA", "SW1"), true);
    assert.equal(ukPostcodeMatches("SW2 1AA", "SW1"), false);
    assert.equal(ukPostcodeMatches("M1 1AA", "M1 1"), true);
  });

  it("matches headcount, city, postcode, and industry", () => {
    const row = person({
      team_size: "11-50",
      location: "Greater London, England, United Kingdom",
      city: "Greater London",
      address: "1 High St, York YO1 7HH, United Kingdom",
      postcode: "YO1 7HH",
      industry: "Plumber",
    });
    assert.equal(poolRowMatchesHeadcountFilter(row, []), true);
    assert.equal(poolRowMatchesHeadcountFilter(row, ["11-50"]), true);
    assert.equal(poolRowMatchesHeadcountFilter(row, ["1-10"]), false);
    assert.equal(poolRowMatchesHeadcountFilter(person({}), ["unknown"]), true);
    assert.equal(poolRowMatchesHeadcountFilter(row, ["unknown"]), false);
    assert.equal(poolRowMatchesCityFilter(row, "london"), true);
    assert.equal(poolRowMatchesCityFilter(row, "york"), true);
    assert.equal(poolRowMatchesCityFilter(row, "leeds"), false);
    assert.equal(poolRowMatchesPostcodeFilter(row, "YO1"), true);
    assert.equal(poolRowMatchesPostcodeFilter(row, "M1"), false);
    assert.equal(poolRowMatchesPostcodeFilter(person({}), "YO1"), false);
    assert.equal(poolRowMatchesIndustryFilter(row, "plumb"), true);
    assert.equal(poolRowMatchesIndustryFilter(row, "electric"), false);
  });

  it("matches LinkedIn profile presence", () => {
    const hasUrl = person({});
    const missing = person({ linkedin_url: null });
    const blank = person({ linkedin_url: "   " });
    assert.equal(poolRowMatchesLinkedInFilter(hasUrl, "all"), true);
    assert.equal(poolRowMatchesLinkedInFilter(missing, "all"), true);
    assert.equal(poolRowMatchesLinkedInFilter(hasUrl, "has"), true);
    assert.equal(poolRowMatchesLinkedInFilter(missing, "has"), false);
    assert.equal(poolRowMatchesLinkedInFilter(blank, "has"), false);
    assert.equal(poolRowMatchesLinkedInFilter(missing, "none"), true);
    assert.equal(poolRowMatchesLinkedInFilter(blank, "none"), true);
    assert.equal(poolRowMatchesLinkedInFilter(hasUrl, "none"), false);
  });
});
