import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { campaignContactHref, prospectDetailHref } from "./prospectDetailHref";

describe("campaignContactHref", () => {
  it("opens the contact from campaigns and asks for that lead's message", () => {
    const leadId = "11111111-1111-4111-8111-111111111111";
    assert.equal(
      campaignContactHref("contact-1", false, leadId),
      `/coach/prospects/contact-1?from=campaigns&composeLead=${leadId}`
    );
    assert.equal(
      campaignContactHref("contact-1", true, leadId),
      `/admin/prospects/contact-1?from=campaigns&composeLead=${leadId}`
    );
  });

  it("still opens the contact when there is no lead to compose", () => {
    assert.equal(
      campaignContactHref("contact-1", false, "waiting-not-a-uuid"),
      "/coach/prospects/contact-1?from=campaigns"
    );
    assert.equal(campaignContactHref(null, false, "x"), null);
    assert.equal(
      prospectDetailHref("contact-1", false),
      "/coach/prospects/contact-1"
    );
  });
});
