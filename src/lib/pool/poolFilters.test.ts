import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoolPerson } from "./poolPeople";
import {
  countActivePoolFilters,
  createEmptyPoolFilters,
  POOL_CAMPAIGN_ANY,
  POOL_CAMPAIGN_NONE,
  POOL_NO_TAGS,
  poolRowMatchesFilters,
  type PoolFilters,
} from "./poolFilters";

function person(patch: Partial<PoolPerson> = {}): PoolPerson {
  return {
    id: "p1",
    full_name: "Sam Lee",
    first_name: "Sam",
    last_name: "Lee",
    job_title: null,
    company: "Acme",
    linkedin_url: "https://www.linkedin.com/in/sam-lee/",
    email: null,
    phone: null,
    website: null,
    address: null,
    location: null,
    city: null,
    postcode: null,
    team_size: null,
    open_profile: null,
    linkedin_premium: null,
    industry: null,
    place_id: null,
    source: "sales_nav",
    created_at: new Date().toISOString(),
    tags: [],
    in_campaign: false,
    campaign_ids: [],
    blacklisted: false,
    campaignable: true,
    linkedinCampaignable: true,
    emailCampaignable: false,
    whatsappCampaignable: false,
    canFindPerson: false,
    contact_id: null,
    ...patch,
  };
}

const f = (patch: Partial<PoolFilters>): PoolFilters => ({ ...createEmptyPoolFilters(), ...patch });

describe("pool filters", () => {
  it("lets everyone through with nothing ticked", () => {
    assert.equal(poolRowMatchesFilters(person(), createEmptyPoolFilters()), true);
    assert.equal(countActivePoolFilters(createEmptyPoolFilters()), 0);
  });

  it("ticks inside one filter mean any of them", () => {
    const filters = f({ statusFilter: ["connected", "replied"] });
    assert.equal(poolRowMatchesFilters(person({ outreach_status: "replied" }), filters), true);
    assert.equal(poolRowMatchesFilters(person({ outreach_status: "invited" }), filters), false);
    assert.equal(poolRowMatchesFilters(person(), f({ statusFilter: ["none"] })), true);
  });

  it("different filters must all match", () => {
    const filters = f({ fitFilter: ["good"], tagFilter: ["VIP"] });
    assert.equal(poolRowMatchesFilters(person({ fit: "good", tags: ["vip"] }), filters), true);
    assert.equal(poolRowMatchesFilters(person({ fit: "good" }), filters), false);
    assert.equal(countActivePoolFilters(filters), 2);
  });

  it("No tags and not checked", () => {
    assert.equal(poolRowMatchesFilters(person(), f({ tagFilter: [POOL_NO_TAGS] })), true);
    assert.equal(poolRowMatchesFilters(person({ tags: ["Hot"] }), f({ tagFilter: [POOL_NO_TAGS, "hot"] })), true);
    assert.equal(poolRowMatchesFilters(person(), f({ fitFilter: ["none"] })), true);
    assert.equal(poolRowMatchesFilters(person({ fit: "bad" }), f({ fitFilter: ["none", "good"] })), false);
  });

  it("campaign: any, none, or a named one", () => {
    const inOne = person({ in_campaign: true, campaign_ids: ["c1"] });
    assert.equal(poolRowMatchesFilters(inOne, f({ campaignFilter: [POOL_CAMPAIGN_ANY] })), true);
    assert.equal(poolRowMatchesFilters(inOne, f({ campaignFilter: [POOL_CAMPAIGN_NONE] })), false);
    assert.equal(poolRowMatchesFilters(inOne, f({ campaignFilter: ["c2", "c1"] })), true);
    assert.equal(poolRowMatchesFilters(person(), f({ campaignFilter: [POOL_CAMPAIGN_NONE, "c1"] })), true);
  });

  it("source and hidden tags", () => {
    assert.equal(poolRowMatchesFilters(person(), f({ sourceFilter: ["google_maps", "sales_nav"] })), true);
    assert.equal(poolRowMatchesFilters(person(), f({ sourceFilter: ["google_maps"] })), false);
    assert.equal(poolRowMatchesFilters(person({ tags: ["Cold"] }), f({ excludeTags: ["cold"] })), false);
  });
});
