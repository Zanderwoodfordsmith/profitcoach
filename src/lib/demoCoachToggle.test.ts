import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  demoCoachToggleUserForEmail,
  pathAfterDemoCoachToggle,
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
      "Pam Woodford"
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

describe("blueprint path when using as a coach", () => {
  it("opens the same blueprint page on the coach Blueprint", () => {
    assert.equal(
      pathAfterDemoCoachToggle("/admin/blueprint/coach", "coach"),
      "/coach/blueprint"
    );
    assert.equal(
      pathAfterDemoCoachToggle("/admin/blueprint/coach/story", "coach"),
      "/coach/blueprint/story"
    );
    assert.equal(
      pathAfterDemoCoachToggle("/admin/blueprint/coach/blueprint", "coach"),
      "/coach/blueprint/blueprint"
    );
  });

  it("sends admin-only blueprint tools to the coach Blueprint home", () => {
    assert.equal(
      pathAfterDemoCoachToggle("/admin/blueprint/records", "coach"),
      "/coach/blueprint"
    );
    assert.equal(
      pathAfterDemoCoachToggle("/admin/blueprint/map", "coach"),
      "/coach/blueprint"
    );
  });

  it("returns to the admin Blueprint for the same page", () => {
    assert.equal(
      pathAfterDemoCoachToggle("/coach/blueprint", "admin"),
      "/admin/blueprint/coach"
    );
    assert.equal(
      pathAfterDemoCoachToggle("/coach/blueprint/story", "admin"),
      "/admin/blueprint/coach/story"
    );
    assert.equal(
      pathAfterDemoCoachToggle("/coach/practice/story", "admin"),
      "/admin/blueprint/coach/story"
    );
  });
});
