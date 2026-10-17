import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { latestUserText } from "../ava/voiceBridgeParse";
import { avaCallProtocol, practiceStepStates } from "./intakeCall";

describe("Ava call protocol", () => {
  it("starts as the intake call and becomes a follow-up once that call is done", () => {
    assert.equal(avaCallProtocol(null), "intake");
    assert.equal(avaCallProtocol(undefined), "intake");
    assert.equal(avaCallProtocol("2026-10-17T12:00:00.000Z"), "followup");
  });

  it("ticks a step only once that part is finished", () => {
    const open = practiceStepStates({ interviewCompletedAt: null, decisionLockedAt: null, builtSections: {} });
    assert.deepEqual(open, { ava: "current", pam: "waiting", build: "waiting" });

    const afterAva = practiceStepStates({
      interviewCompletedAt: "2026-10-17T12:00:00.000Z",
      decisionLockedAt: null,
      builtSections: { "linkedin:rewrite": {} },
    });
    assert.deepEqual(afterAva, { ava: "done", pam: "current", build: "waiting" });

    const afterPam = practiceStepStates({
      interviewCompletedAt: "2026-10-17T12:00:00.000Z",
      decisionLockedAt: "2026-10-18T12:00:00.000Z",
      builtSections: { "linkedin:rewrite": {}, "campaigns:messaging": {} },
    });
    assert.deepEqual(afterPam, { ava: "done", pam: "done", build: "current" });

    const built = practiceStepStates({
      interviewCompletedAt: "2026-10-17T12:00:00.000Z",
      decisionLockedAt: "2026-10-18T12:00:00.000Z",
      builtSections: {
        "linkedin:rewrite": {},
        "campaigns:messaging": {},
        "conversations:followup": {},
        "campaigns:nurture": {},
      },
    });
    assert.deepEqual(built, { ava: "done", pam: "done", build: "done" });
  });

  it("reads only the newest thing the coach said", () => {
    assert.equal(
      latestUserText([
        { role: "system", content: "ignore" },
        { role: "assistant", content: "Where did the profit move?" },
        { role: "user", content: " From £150k to £9m. " },
      ]),
      "From £150k to £9m."
    );
    assert.equal(latestUserText([{ role: "system", content: "open the call" }]), "");
    assert.equal(
      latestUserText([{ role: "user", content: [{ type: "text", text: "Manufacturing." }] }]),
      "Manufacturing."
    );
  });
});
