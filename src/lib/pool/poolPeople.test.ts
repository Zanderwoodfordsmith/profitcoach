import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  poolDisplayName,
  poolLeadCompany,
  poolRowFitsCampaignChannel,
  poolRowMatchesContactFilter,
  poolRowMatchesDateAddedFilter,
  poolRowMatchesTagFilter,
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
});
