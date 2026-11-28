import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoolPerson } from "./poolPeople";
import {
  SMART_LIST_TEMPLATES,
  createSmartRule,
  normalizeSmartRules,
  poolRowMatchesSmartRules,
  type PoolSmartRules,
  type SmartRule,
} from "./smartListRules";
import { mergeOutreach, outreachFromCampaignLead } from "./outreachStatus";

const NOW = Date.parse("2026-11-26T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

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
    created_at: daysAgo(10),
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

function rule(patch: Partial<SmartRule>): SmartRule {
  return { ...createSmartRule(patch.field ?? "tag"), ...patch };
}

describe("smart list rules", () => {
  it("lets everyone in when no rule is filled in", () => {
    const rules: PoolSmartRules = { match: "all", items: [createSmartRule("tag")] };
    assert.equal(poolRowMatchesSmartRules(person(), rules, NOW), true);
  });

  it("matches a tag, case-insensitive", () => {
    const rules: PoolSmartRules = { match: "all", items: [rule({ field: "tag", op: "has", value: "vip" })] };
    assert.equal(poolRowMatchesSmartRules(person({ tags: ["VIP"] }), rules, NOW), true);
    assert.equal(poolRowMatchesSmartRules(person({ tags: ["Hot"] }), rules, NOW), false);
  });

  it("status with days: connected for more than 90 days", () => {
    const rules: PoolSmartRules = {
      match: "all",
      items: [rule({ field: "status", op: "is", value: "connected", when: "more", days: 90 })],
    };
    const old = person({ outreach_status: "connected", outreach_status_at: daysAgo(120) });
    const recent = person({ outreach_status: "connected", outreach_status_at: daysAgo(30) });
    const unknown = person({ outreach_status: "connected", outreach_status_at: null });
    const replied = person({ outreach_status: "replied", outreach_status_at: daysAgo(200) });
    assert.equal(poolRowMatchesSmartRules(old, rules, NOW), true);
    assert.equal(poolRowMatchesSmartRules(recent, rules, NOW), false);
    assert.equal(poolRowMatchesSmartRules(unknown, rules, NOW), false);
    assert.equal(poolRowMatchesSmartRules(replied, rules, NOW), false);
  });

  it("treats a missing status as not contacted", () => {
    const rules: PoolSmartRules = { match: "all", items: [rule({ field: "status", op: "is", value: "none" })] };
    assert.equal(poolRowMatchesSmartRules(person(), rules, NOW), true);
  });

  it("all of: tag and status; any group: fit good or size 51-200", () => {
    const rules: PoolSmartRules = {
      match: "all",
      items: [
        rule({ field: "tag", op: "has", value: "VIP" }),
        {
          kind: "group",
          id: "g1",
          match: "any",
          rules: [
            rule({ field: "fit", op: "is", value: "good" }),
            rule({ field: "headcount", op: "is", value: "51-200" }),
          ],
        },
      ],
    };
    assert.equal(poolRowMatchesSmartRules(person({ tags: ["VIP"], fit: "good" }), rules, NOW), true);
    assert.equal(poolRowMatchesSmartRules(person({ tags: ["VIP"], team_size: "51-200" }), rules, NOW), true);
    assert.equal(poolRowMatchesSmartRules(person({ tags: ["VIP"], fit: "bad" }), rules, NOW), false);
    assert.equal(poolRowMatchesSmartRules(person({ fit: "good" }), rules, NOW), false);
  });

  it("any of at the top level", () => {
    const rules: PoolSmartRules = {
      match: "any",
      items: [
        rule({ field: "tag", op: "has", value: "VIP" }),
        rule({ field: "contact", op: "has", value: "email" }),
      ],
    };
    assert.equal(poolRowMatchesSmartRules(person({ email: "a@b.co" }), rules, NOW), true);
    assert.equal(poolRowMatchesSmartRules(person(), rules, NOW), false);
  });

  it("date added more / less than N days ago", () => {
    const more = { match: "all" as const, items: [rule({ field: "added", op: "more", days: 7 })] };
    const less = { match: "all" as const, items: [rule({ field: "added", op: "less", days: 7 })] };
    assert.equal(poolRowMatchesSmartRules(person({ created_at: daysAgo(10) }), more, NOW), true);
    assert.equal(poolRowMatchesSmartRules(person({ created_at: daysAgo(3) }), more, NOW), false);
    assert.equal(poolRowMatchesSmartRules(person({ created_at: daysAgo(3) }), less, NOW), true);
  });

  it("campaign: in any campaign, or not in one", () => {
    const inAny = { match: "all" as const, items: [rule({ field: "campaign", op: "in", value: "any" })] };
    const notIn = { match: "all" as const, items: [rule({ field: "campaign", op: "not_in", value: "c1" })] };
    assert.equal(poolRowMatchesSmartRules(person({ in_campaign: true, campaign_ids: ["c1"] }), inAny, NOW), true);
    assert.equal(poolRowMatchesSmartRules(person({ in_campaign: true, campaign_ids: ["c1"] }), notIn, NOW), false);
    assert.equal(poolRowMatchesSmartRules(person(), notIn, NOW), true);
  });

  it("normalising is stable and drops junk", () => {
    const raw = {
      match: "any",
      items: [
        { kind: "rule", field: "tag", op: "has", value: "VIP" },
        { kind: "rule", field: "nonsense" },
        { kind: "group", match: "all", rules: [{ field: "fit", op: "is", value: "good" }] },
      ],
    };
    const once = normalizeSmartRules(raw);
    const twice = normalizeSmartRules(once);
    assert.deepEqual(once, twice);
    assert.equal(once?.items.length, 2);
    assert.equal(normalizeSmartRules(null), null);
  });
});

describe("outreach status", () => {
  it("keeps the connection after later steps overwrite the status", () => {
    const state = outreachFromCampaignLead({ status: "in_sequence", connected_at: daysAgo(40) });
    assert.equal(state.status, "connected");
  });

  it("takes the furthest status, earliest date on a tie", () => {
    const a = { status: "connected" as const, at: daysAgo(10) };
    const b = { status: "connected" as const, at: daysAgo(50) };
    assert.equal(mergeOutreach(a, b).at, daysAgo(50));
    assert.equal(mergeOutreach(a, { status: "replied", at: null }).status, "replied");
    assert.equal(mergeOutreach({ status: "invited", at: null }, a).status, "connected");
    assert.equal(mergeOutreach({ status: "interested", at: null }, { status: "booked", at: null }).status, "booked");
  });
});

describe("smart list templates (28 Nov)", () => {
  const template = (key: string) => {
    const t = SMART_LIST_TEMPLATES.find((x) => x.key === key)!;
    // Saved and loaded the way a real tab is.
    return normalizeSmartRules(t.rules())!;
  };
  const match = (key: string, patch: Partial<PoolPerson>) => poolRowMatchesSmartRules(person(patch), template(key), NOW);

  it("Connections: connected or further on, not invited or never contacted", () => {
    assert.equal(match("connections", { outreach_status: "connected" }), true);
    assert.equal(match("connections", { outreach_status: "replied" }), true);
    assert.equal(match("connections", { outreach_status: "booked" }), true);
    assert.equal(match("connections", { outreach_status: "invited" }), false);
    assert.equal(match("connections", { outreach_status: "none" }), false);
  });

  it("Connected owners: connected, an owner-type title, and not a bad fit", () => {
    assert.equal(match("connected-owners", { outreach_status: "connected", job_title: "Managing Director" }), true);
    assert.equal(match("connected-owners", { outreach_status: "replied", job_title: "Co-owner" }), true);
    assert.equal(match("connected-owners", { outreach_status: "connected", job_title: "MD at Acme" }), true);
    assert.equal(match("connected-owners", { outreach_status: "connected", job_title: "Sales Director" }), false);
    assert.equal(match("connected-owners", { outreach_status: "connected", job_title: "MDF supplier" }), false);
    assert.equal(match("connected-owners", { outreach_status: "invited", job_title: "Founder" }), false);
    assert.equal(match("connected-owners", { outreach_status: "connected", job_title: "Founder", fit: "bad" }), false);
  });

  it("VIP and Referral: only people tagged by the coach", () => {
    assert.equal(match("vip", { tags: ["vip"] }), true);
    assert.equal(match("vip", { tags: [] }), false);
    assert.equal(match("referral", { tags: ["Referral"] }), true);
    assert.equal(match("referral", { tags: ["VIP"] }), false);
  });
});
