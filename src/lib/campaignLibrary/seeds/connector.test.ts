import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONNECTOR_LIBRARY_SEED, connectorLibrarySteps } from "./connector";

const MSG2_B = `Hi {{first_name}}, thanks for connecting. I work with {{type_of_owner}}, so I hear the same thing a lot.

{{market_observation}}

Ring any bells, or is it different your end?`;

const MSG2_A = `Hi {{first_name}}, great to have you in my network.

Are you focused on growing your business at the moment, or more on maintaining what you've already built?`;

const MSG3 = `Hi {{first_name}}, one thing I see either way,  whether someone's pushing for growth or protecting what they've built... is that every business has a weakest link, and most owners are guessing which one it is.

Growth tends to break it. Steady tends to hide it.

If you had to guess, where's yours?`;

const MSG4 = `Hi {{first_name}}, that's one of the reasons we built the BOSS Scorecard . It's designed to find the root constraint rather than just the symptoms.

If you fancy giving it a go, I can send you a personalised link.`;

const MSG5 = `Hi {{first_name}}, I’ll leave this here in case it’s useful: {{scorecard_link}}

The BOSS Scorecard is a short assessment designed to show where the biggest constraint may be across profit, performance and owner-dependence.

No pressure to use it. I’ll leave you to it.`;

describe("connector library template", () => {
  it("stores the Connection sequence with the supplied copy", () => {
    assert.equal(CONNECTOR_LIBRARY_SEED.kind, "connector");
    assert.equal(CONNECTOR_LIBRARY_SEED.name, "Connection");
    assert.equal(CONNECTOR_LIBRARY_SEED.settings?.daily_invite_limit, 9);
    assert.equal(CONNECTOR_LIBRARY_SEED.settings?.stop_on_reply, true);

    const steps = connectorLibrarySteps();
    assert.equal(steps[0]?.step_type, "invite");
    assert.equal((steps[0]?.body ?? "").trim(), "");
    assert.deepEqual(
      steps.filter((step) => step.step_type === "wait").map((step) => step.wait_hours),
      [24, 72, 96, 96]
    );

    const messages = steps.filter((step) => step.step_type === "message");
    assert.deepEqual(
      messages.map((step) => step.body),
      [MSG2_B, MSG3, MSG4, MSG5]
    );
  });

  it("uses observation as the control and growth vs maintain as the test", () => {
    const first = connectorLibrarySteps().filter(
      (step) => step.step_type === "message"
    )[0];
    const variants = first?.variants ?? [];
    assert.equal(variants[0]?.key, "B");
    assert.equal(variants[0]?.body, MSG2_B);
    assert.equal(first?.body, MSG2_B);
    assert.equal(variants[1]?.key, "A");
    assert.equal(variants[1]?.body, MSG2_A);
  });
});
