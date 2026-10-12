import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  personFromMagnetSignals,
  scorecardProgressFromScreen,
  summarizeMagnetAudience,
  timestampInRange,
  type MagnetSignal,
} from "./audience";

function signal(partial: Partial<MagnetSignal> & { id: string }): MagnetSignal {
  return {
    full_name: "Ada Lovelace",
    email: "ada@example.com",
    business_name: "Analytical Engines",
    optedInAt: null,
    startedAt: null,
    finishedAt: null,
    score: null,
    scoreAt: null,
    screen: null,
    progressAt: null,
    ...partial,
  };
}

describe("personFromMagnetSignals", () => {
  it("keeps someone who only opted in in that stage", () => {
    const person = personFromMagnetSignals(
      signal({ id: "1", optedInAt: "2026-10-01T00:00:00.000Z" }),
      { trackProgress: true }
    );
    assert.equal(person?.stage, "opted_in");
    assert.equal(person?.score, null);
    assert.equal(person?.progress_step, null);
  });

  it("treats a start as started, not a second opted-in bucket", () => {
    const person = personFromMagnetSignals(
      signal({
        id: "1",
        optedInAt: "2026-10-01T00:00:00.000Z",
        startedAt: "2026-10-02T00:00:00.000Z",
        screen: 4,
      }),
      { trackProgress: true }
    );
    assert.equal(person?.stage, "started");
    assert.equal(person?.progress_step, 4);
    assert.equal(person?.progress_total, 15);
    assert.equal(person?.at, "2026-10-02T00:00:00.000Z");
  });

  it("uses the furthest screen when progress is newer than the start event", () => {
    const person = personFromMagnetSignals(
      signal({
        id: "1",
        startedAt: "2026-10-01T00:00:00.000Z",
        screen: 8,
        progressAt: "2026-10-03T00:00:00.000Z",
      }),
      { trackProgress: true }
    );
    assert.equal(person?.stage, "started");
    assert.equal(person?.at, "2026-10-03T00:00:00.000Z");
    assert.equal(person?.progress_step, 8);
  });

  it("shows the score once they finish, even if they also started", () => {
    const person = personFromMagnetSignals(
      signal({
        id: "1",
        optedInAt: "2026-10-01T00:00:00.000Z",
        startedAt: "2026-10-02T00:00:00.000Z",
        screen: 10,
        score: 64,
        scoreAt: "2026-10-04T00:00:00.000Z",
      }),
      { trackProgress: true }
    );
    assert.equal(person?.stage, "completed");
    assert.equal(person?.score, 64);
    assert.equal(person?.progress_step, null);
    assert.equal(person?.at, "2026-10-04T00:00:00.000Z");
  });

  it("counts a zero score as completed", () => {
    const person = personFromMagnetSignals(
      signal({ id: "1", score: 0, scoreAt: "2026-10-04T00:00:00.000Z" }),
      { trackProgress: true }
    );
    assert.equal(person?.stage, "completed");
    assert.equal(person?.score, 0);
  });

  it("ignores scorecard screen progress on Boss Pro", () => {
    const person = personFromMagnetSignals(
      signal({ id: "1", screen: 6, progressAt: "2026-10-02T00:00:00.000Z" }),
      { trackProgress: false }
    );
    assert.equal(person, null);
  });
});

describe("scorecardProgressFromScreen", () => {
  it("maps the last screen onto question 15 of 15", () => {
    assert.deepEqual(scorecardProgressFromScreen(16), { step: 15, total: 15 });
  });

  it("ignores a screen that has not started the questions", () => {
    assert.equal(scorecardProgressFromScreen(0), null);
    assert.equal(scorecardProgressFromScreen(null), null);
  });
});

describe("timestampInRange", () => {
  it("keeps everyone when the window is open", () => {
    assert.equal(timestampInRange("2026-01-01T00:00:00.000Z", null, null), true);
  });

  it("drops a person whose stage time is outside the window", () => {
    assert.equal(
      timestampInRange(
        "2026-09-01T00:00:00.000Z",
        "2026-10-01T00:00:00.000Z",
        "2026-10-12T00:00:00.000Z"
      ),
      false
    );
  });
});

describe("summarizeMagnetAudience", () => {
  it("counts mutually exclusive stages and sorts newest first", () => {
    const summary = summarizeMagnetAudience({
      uniqueViews: 10,
      optIns: 4,
      people: [
        {
          id: "old",
          full_name: "Old",
          email: null,
          business_name: null,
          stage: "opted_in",
          score: null,
          progress_step: null,
          progress_total: null,
          at: "2026-10-01T00:00:00.000Z",
        },
        {
          id: "done",
          full_name: "Done",
          email: null,
          business_name: null,
          stage: "completed",
          score: 70,
          progress_step: null,
          progress_total: null,
          at: "2026-10-08T00:00:00.000Z",
        },
        {
          id: "mid",
          full_name: "Mid",
          email: null,
          business_name: null,
          stage: "started",
          score: null,
          progress_step: 3,
          progress_total: 15,
          at: "2026-10-04T00:00:00.000Z",
        },
      ],
    });

    assert.deepEqual(summary.stages, {
      opted_in: 1,
      started: 1,
      completed: 1,
    });
    assert.equal(summary.started_total, 2);
    assert.deepEqual(
      summary.people.map((person) => person.id),
      ["done", "mid", "old"]
    );
  });
});
