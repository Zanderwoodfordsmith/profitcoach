import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { seedPayloadFromLinkedIn } from "./seedFromLinkedIn";

describe("seedPayloadFromLinkedIn", () => {
  it("seeds roles and industries from experiences", () => {
    const snapshot = {
      linkedinUrl: "https://www.linkedin.com/in/jane",
      location: "London",
      experiences: [
        { title: "MD", company: "JCB", industry: "Manufacturing" },
        { title: "MD", company: "IBM", industry: "Technology" },
      ],
    } as LinkedInProfileSnapshot;
    const patch = seedPayloadFromLinkedIn(snapshot);
    assert.deepEqual(patch.market?.roles_held?.value, ["MD"]);
    assert.ok(patch.market?.industries_worked?.value?.includes("Manufacturing"));
    assert.equal(patch.identity?.location?.value, "London");
    assert.equal(patch.identity?.linkedin_url?.source, "linkedin");
  });
});
