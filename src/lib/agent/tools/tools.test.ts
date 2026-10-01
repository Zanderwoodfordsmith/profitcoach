import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pageHref } from "./guide";
import { INVITE_NOTE_MAX, stepsFromDraft } from "./messaging";
import { buildSalesNavSearch, salesNavCriteriaFromInput, salesNavPoolLimitFor } from "./prospects";

describe("Sales Navigator search building", () => {
  it("applies the classroom base search plus company-name narrowing", () => {
    const built = buildSalesNavSearch(
      salesNavCriteriaFromInput({
        location: "United Kingdom",
        company_includes: ["engineering", "engineers"],
      })
    );
    assert.ok("url" in built);
    const url = decodeURIComponent(decodeURIComponent(built.url));
    assert.ok(url.startsWith("https://www.linkedin.com/sales/search/people"));
    assert.ok(url.includes("text:engineering,selectionType:INCLUDED"));
    assert.ok(url.includes("text:coach,selectionType:EXCLUDED"), "base exclusions");
    assert.ok(url.includes("text:Owner,selectionType:INCLUDED"), "base titles");
    assert.ok(url.includes("type:REGION"), "location");
    assert.ok(url.includes("type:COMPANY_HEADCOUNT"), "headcount");
    assert.ok(url.includes("type:RELATIONSHIP"), "2nd and 3rd degree");
    assert.equal(built.region, "United Kingdom");
  });

  it("refuses company names and keywords together", () => {
    const built = buildSalesNavSearch(
      salesNavCriteriaFromInput({ location: "United Kingdom", company_includes: ["law"], keywords: "legal" })
    );
    assert.ok("error" in built);
  });

  it("explains unknown locations", () => {
    const built = buildSalesNavSearch(salesNavCriteriaFromInput({ location: "Atlantis" }));
    assert.ok("error" in built && built.error.includes("United Kingdom"));
  });

  it("drops headcounts and degrees it does not know", () => {
    const criteria = salesNavCriteriaFromInput({
      location: "United Kingdom",
      team_sizes: ["11-50", "lots"],
      degrees: ["1", "9"],
    });
    assert.deepEqual(criteria.teamSizes, ["11-50"]);
    assert.deepEqual(criteria.degrees, ["1"]);
  });

  it("snaps import sizes to the options", () => {
    assert.equal(salesNavPoolLimitFor(null), 1_000);
    assert.equal(salesNavPoolLimitFor(0), null);
    assert.equal(salesNavPoolLimitFor(300), 500);
    assert.equal(salesNavPoolLimitFor(2_500), 2_500);
    assert.equal(salesNavPoolLimitFor(5_000), null);
  });
});

describe("campaign step drafts", () => {
  it("builds an invite then waits and messages on remind, with merge fields", () => {
    const parsed = stepsFromDraft([
      { step_type: "invite", body: "Hi {first_name}, I see you run {company}." },
      { step_type: "wait", wait_hours: 24 },
      { step_type: "message", body: "Thanks {{first_name}}", variant_b: "Cheers {first_name}" },
    ]);
    assert.ok("steps" in parsed);
    const [invite, wait, message] = parsed.steps;
    assert.equal(invite.body, "Hi {{first_name}}, I see you run {{company}}.");
    assert.equal(invite.send_mode, "auto");
    assert.equal(wait.wait_hours, 24);
    assert.equal(message.send_mode, "remind");
    assert.deepEqual(
      message.variants?.map((v) => [v.key, v.body]),
      [
        ["A", "Thanks {{first_name}}"],
        ["B", "Cheers {{first_name}}"],
      ]
    );
  });

  it("rejects long invite notes, late invites, and empty messages", () => {
    assert.ok("error" in stepsFromDraft([{ step_type: "invite", body: "x".repeat(INVITE_NOTE_MAX + 1) }]));
    assert.ok(
      "error" in
        stepsFromDraft([
          { step_type: "message", body: "hi" },
          { step_type: "invite", body: "" },
        ])
    );
    assert.ok("error" in stepsFromDraft([{ step_type: "message", body: " " }]));
    assert.ok("error" in stepsFromDraft([{ step_type: "wait" }]));
    assert.ok("error" in stepsFromDraft([{ step_type: "delete_everything" }]));
  });

  it("keeps auto when asked", () => {
    const parsed = stepsFromDraft([{ step_type: "message", body: "Hi", send_mode: "auto" }]);
    assert.ok("steps" in parsed && parsed.steps[0].send_mode === "auto");
  });
});

describe("page links", () => {
  it("uses the mode's prefix", () => {
    assert.equal(pageHref("coach", "pool")?.href, "/coach/campaigns?tab=pool");
    assert.equal(pageHref("admin", "calls")?.href, "/admin/calls");
    assert.equal(
      pageHref("coach", "campaign", "5cb89c87-88a9-4cfc-9f95-9591f74f8529")?.href,
      "/coach/campaigns/5cb89c87-88a9-4cfc-9f95-9591f74f8529"
    );
    assert.equal(pageHref("coach", "campaign", "nope"), null);
    assert.equal(pageHref("coach", "nowhere"), null);
  });
});
