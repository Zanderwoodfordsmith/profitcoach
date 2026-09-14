import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  demoCoachToggleUserForEmail,
  staffDemosAccessibleToEmail,
} from "./demoCoachToggle";

describe("staff demo access", () => {
  it("gives Pam only her own demo", () => {
    const demos = staffDemosAccessibleToEmail("pam@businesscoachacademy.com");
    assert.deepEqual(
      demos.map((demo) => demo.coachSlug),
      ["pam"]
    );
    assert.equal(
      demoCoachToggleUserForEmail("pam@businesscoachacademy.com")?.label,
      "Pam Demo"
    );
  });

  it("lets Zander open his demo and Pam's", () => {
    const demos = staffDemosAccessibleToEmail(
      "zander@businesscoachacademy.com"
    );
    assert.deepEqual(
      demos.map((demo) => demo.coachSlug),
      ["zander-demo", "pam"]
    );
  });

  it("does not expose staff demos to other emails", () => {
    assert.deepEqual(staffDemosAccessibleToEmail("coach@example.com"), []);
    assert.equal(demoCoachToggleUserForEmail("coach@example.com"), null);
  });
});
