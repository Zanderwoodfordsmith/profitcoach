import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inviteFunnelCounts,
  inviteFunnelSliceForLead,
  leadIsHeldBeforeAction,
  leadIsHeldByWait,
  leadStartedAt,
  patchesAfterDeletedWait,
  nextActionStep,
  nextStepLabel,
  type CampaignActivityJob,
  type CampaignActivityLead,
  type CampaignActivityStep,
} from "./campaignLeadActivity";

function lead(
  patch: Partial<CampaignActivityLead> & Pick<CampaignActivityLead, "id" | "status">
): CampaignActivityLead {
  return {
    linkedin_url: null,
    first_name: "Pat",
    last_name: "Lee",
    company: null,
    last_error: null,
    current_step_position: 0,
    ...patch,
  };
}

function step(
  position: number,
  step_type: string,
  config?: unknown
): CampaignActivityStep {
  return { position, step_type, config };
}

describe("nextStepLabel", () => {
  it("does not call a queued lead finished when the campaign has no steps", () => {
    const queued = lead({ id: "1", status: "queued" });
    assert.equal(nextStepLabel(queued, []), "—");
    assert.equal(nextActionStep(queued, []), null);
  });

  it("names the first action for a queued lead", () => {
    const queued = lead({ id: "1", status: "queued" });
    const steps = [step(0, "invite"), step(1, "wait"), step(2, "message")];
    assert.equal(nextStepLabel(queued, steps), "Connection request");
  });

  it("skips waits and still finds the first real action", () => {
    const queued = lead({ id: "1", status: "queued" });
    const steps = [step(0, "wait"), step(1, "message")];
    assert.equal(nextStepLabel(queued, steps), "LinkedIn message");
  });

  it("finds a later action when positions do not start at zero", () => {
    const queued = lead({ id: "1", status: "queued", current_step_position: 0 });
    const steps = [step(1, "invite"), step(2, "message")];
    assert.equal(nextStepLabel(queued, steps), "Connection request");
  });

  it("keeps Finished for leads that actually finished", () => {
    const done = lead({ id: "1", status: "completed", current_step_position: 2 });
    assert.equal(nextStepLabel(done, [step(0, "invite")]), "Finished");
    const replied = lead({ id: "2", status: "replied" });
    assert.equal(nextStepLabel(replied, [step(0, "invite")]), "Finished");
  });
});

describe("inviteFunnelSliceForLead", () => {
  it("counts invited as waiting and later statuses as connected", () => {
    assert.equal(
      inviteFunnelSliceForLead(lead({ id: "1", status: "queued" }), 0),
      "remaining"
    );
    assert.equal(
      inviteFunnelSliceForLead(lead({ id: "2", status: "invited" }), 0),
      "waiting"
    );
    assert.equal(
      inviteFunnelSliceForLead(lead({ id: "3", status: "connected" }), 0),
      "connected"
    );
    assert.equal(
      inviteFunnelSliceForLead(lead({ id: "4", status: "in_sequence" }), 0),
      "connected"
    );
  });

  it("treats a pause after the invite as connected", () => {
    assert.equal(
      inviteFunnelSliceForLead(
        lead({ id: "1", status: "paused", current_step_position: 2 }),
        0
      ),
      "connected"
    );
    assert.equal(
      inviteFunnelSliceForLead(
        lead({ id: "2", status: "paused", current_step_position: 0 }),
        0
      ),
      "remaining"
    );
  });

  it("splits a mix of leads into connected, waiting, and remaining", () => {
    const counts = inviteFunnelCounts(
      [
        lead({ id: "1", status: "connected" }),
        lead({ id: "2", status: "connected" }),
        lead({ id: "3", status: "invited" }),
        lead({ id: "4", status: "queued" }),
        lead({ id: "5", status: "queued" }),
      ],
      0
    );
    assert.deepEqual(counts, {
      connected: 2,
      waiting: 1,
      remaining: 2,
      total: 5,
    });
  });
});

describe("leadIsHeldByWait", () => {
  const steps = [step(0, "invite"), step(1, "wait"), step(2, "message")];

  it("counts a lead parked on the next send, even if the wait timer has elapsed", () => {
    const held = lead({
      id: "1",
      status: "in_sequence",
      current_step_position: 2,
      next_action_at: "2026-09-18T12:00:00.000Z",
    });
    assert.equal(
      leadIsHeldByWait({ lead: held, waitPosition: 1, steps }),
      true
    );
    assert.equal(
      leadIsHeldBeforeAction({
        lead: held,
        actionPosition: 2,
        steps,
      }),
      true
    );
  });

  it("leaves the wait once they have moved past the next send", () => {
    const sent = lead({
      id: "1",
      status: "in_sequence",
      current_step_position: 3,
    });
    assert.equal(
      leadIsHeldByWait({ lead: sent, waitPosition: 1, steps }),
      false
    );
  });

  it("puts stacked waits on the last wait only", () => {
    const stacked = [step(0, "wait"), step(1, "wait"), step(2, "message")];
    const held = lead({
      id: "1",
      status: "in_sequence",
      current_step_position: 2,
      next_action_at: "2026-09-20T12:00:00.000Z",
    });
    assert.equal(
      leadIsHeldByWait({ lead: held, waitPosition: 0, steps: stacked }),
      false
    );
    assert.equal(
      leadIsHeldByWait({ lead: held, waitPosition: 1, steps: stacked }),
      true
    );
  });
});

describe("patchesAfterDeletedWait", () => {
  const steps = [
    step(0, "invite"),
    step(1, "wait"),
    step(2, "message"),
    step(3, "wait"),
    step(4, "message"),
  ];
  const nowIso = "2026-09-19T12:00:00.000Z";

  it("makes people in the wait due now and shifts later leads back", () => {
    const patches = patchesAfterDeletedWait({
      waitPosition: 1,
      steps,
      nowIso,
      leads: [
        lead({
          id: "held",
          status: "in_sequence",
          current_step_position: 2,
          next_action_at: "2026-09-21T12:00:00.000Z",
        }),
        lead({
          id: "later",
          status: "in_sequence",
          current_step_position: 4,
          next_action_at: "2026-09-22T12:00:00.000Z",
        }),
        lead({
          id: "earlier",
          status: "invited",
          current_step_position: 0,
        }),
      ],
    });
    assert.deepEqual(patches, [
      {
        id: "held",
        current_step_position: 1,
        next_action_at: nowIso,
      },
      {
        id: "later",
        current_step_position: 3,
      },
    ]);
  });
});

describe("leadStartedAt", () => {
  function job(patch: Partial<CampaignActivityJob> & Pick<CampaignActivityJob, "id">): CampaignActivityJob {
    return {
      lead_id: "1",
      step_id: "s1",
      status: "pending",
      scheduled_for: "2026-09-20T12:00:00.000Z",
      last_error: null,
      ...patch,
    };
  }

  it("is empty until a send actually goes out", () => {
    assert.equal(leadStartedAt([]), null);
    assert.equal(
      leadStartedAt([job({ id: "j1", status: "pending" })]),
      null
    );
    assert.equal(
      leadStartedAt([job({ id: "j1", status: "cancelled" })]),
      null
    );
  });

  it("uses the first real send, not a later one", () => {
    assert.equal(
      leadStartedAt([
        job({
          id: "later",
          status: "succeeded",
          updated_at: "2026-09-22T12:00:00.000Z",
          scheduled_for: "2026-09-22T10:00:00.000Z",
        }),
        job({
          id: "first",
          status: "succeeded",
          updated_at: "2026-09-21T09:00:00.000Z",
          scheduled_for: "2026-09-21T08:00:00.000Z",
        }),
      ]),
      "2026-09-21T09:00:00.000Z"
    );
  });
});
