import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { payloadFromWelcomeIntake } from "./ingestWelcome";

describe("payloadFromWelcomeIntake", () => {
  it("maps LinkedIn URL and weekly hours", () => {
    const patch = payloadFromWelcomeIntake({
      linkedinUrl: "https://www.linkedin.com/in/jane",
      timeCommitment: "5_10_hours_week",
    });
    assert.equal(
      patch.identity?.linkedin_url?.value,
      "https://www.linkedin.com/in/jane"
    );
    assert.equal(patch.identity?.linkedin_url?.source, "form");
    assert.equal(patch.working_times?.hours_per_week?.value, "5_10_hours_week");
  });

  it("skips empty fields", () => {
    const patch = payloadFromWelcomeIntake({});
    assert.equal(patch.identity?.linkedin_url, null);
    assert.equal(patch.working_times?.hours_per_week, null);
  });
});
