import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { coachLinkedInUrl, sameCoachLinkedInUrl } from "./linkedinSync";

describe("coach LinkedIn URL", () => {
  it("treats the same profile in different shapes as one address", () => {
    assert.equal(
      sameCoachLinkedInUrl(
        "linkedin.com/in/pamwoodford",
        "https://www.linkedin.com/in/pamwoodford/"
      ),
      true
    );
    assert.equal(
      coachLinkedInUrl("https://linkedin.com/in/pamwoodford"),
      "https://www.linkedin.com/in/pamwoodford"
    );
  });

  it("keeps two different profiles apart", () => {
    assert.equal(
      sameCoachLinkedInUrl(
        "https://www.linkedin.com/in/pam",
        "https://www.linkedin.com/in/zander"
      ),
      false
    );
  });

  it("treats blanks as the same empty value", () => {
    assert.equal(sameCoachLinkedInUrl("", null), true);
    assert.equal(coachLinkedInUrl("  "), null);
  });
});
