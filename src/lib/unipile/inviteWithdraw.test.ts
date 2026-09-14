import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampWithdrawValue,
  remainingAutoQuota,
  selectInvitesToWithdraw,
  withdrawPolicySummary,
} from "./inviteWithdraw";
import {
  pendingInviteZone,
  pendingInviteZoneColor,
} from "./pendingInviteDial";

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-12T12:00:00.000Z");

function invites(agesDays: number[]) {
  return agesDays.map((days, i) => ({
    id: `i${i}`,
    sentAt: NOW - days * DAY,
  }));
}

describe("clampWithdrawValue", () => {
  it("clamps per mode", () => {
    assert.equal(clampWithdrawValue("daily", 200), 50);
    assert.equal(clampWithdrawValue("cap", 0), 1);
    assert.equal(clampWithdrawValue("age", 14.6), 15);
    assert.equal(clampWithdrawValue("off", 99), 600);
  });
});

describe("remainingAutoQuota", () => {
  it("resets on a new UTC day", () => {
    assert.equal(
      remainingAutoQuota(
        { mode: "daily", value: 20, ranOn: "2026-09-11", ranCount: 20 },
        "2026-09-12"
      ),
      20
    );
    assert.equal(
      remainingAutoQuota(
        { mode: "daily", value: 20, ranOn: "2026-09-12", ranCount: 7 },
        "2026-09-12"
      ),
      13
    );
  });

  it("caps cap/age modes at AUTO_DAILY_MAX on weekdays", () => {
    assert.equal(
      remainingAutoQuota(
        { mode: "cap", value: 600, ranOn: null, ranCount: 0 },
        "2026-09-12",
        false
      ),
      25
    );
  });

  it("skips weekends", () => {
    assert.equal(
      remainingAutoQuota(
        { mode: "cap", value: 600, ranOn: null, ranCount: 0 },
        "2026-09-12",
        true
      ),
      0
    );
  });
});

describe("selectInvitesToWithdraw", () => {
  it("daily takes the oldest first", () => {
    const ids = selectInvitesToWithdraw(
      invites([1, 20, 3, 40]),
      { mode: "daily", value: 2 },
      10,
      NOW
    );
    assert.deepEqual(ids, ["i3", "i1"]);
  });

  it("cap only withdraws the overflow, oldest first", () => {
    const ids = selectInvitesToWithdraw(
      invites([1, 2, 3, 4, 5]),
      { mode: "cap", value: 3 },
      25,
      NOW
    );
    assert.deepEqual(ids, ["i4", "i3"]);
  });

  it("age skips invites newer than the cutoff", () => {
    const ids = selectInvitesToWithdraw(
      invites([3, 14, 15, 1]),
      { mode: "age", value: 14 },
      25,
      NOW
    );
    assert.deepEqual(ids, ["i2", "i1"]);
  });

  it("respects remaining daily quota", () => {
    const ids = selectInvitesToWithdraw(
      invites([30, 20, 10]),
      { mode: "daily", value: 20 },
      1,
      NOW
    );
    assert.deepEqual(ids, ["i0"]);
  });

  it("returns nothing when off or quota is 0", () => {
    assert.deepEqual(
      selectInvitesToWithdraw(invites([30]), { mode: "off", value: 20 }, 10, NOW),
      []
    );
    assert.deepEqual(
      selectInvitesToWithdraw(invites([30]), { mode: "daily", value: 20 }, 0, NOW),
      []
    );
  });
});

describe("withdrawPolicySummary", () => {
  it("explains the active rule in one line", () => {
    assert.match(
      withdrawPolicySummary(
        { mode: "daily", value: 20, ranOn: null, ranCount: 0 },
        47
      ),
      /20 oldest/
    );
    assert.match(
      withdrawPolicySummary(
        { mode: "cap", value: 600, ranOn: null, ranCount: 0 },
        612
      ),
      /12 over 600/
    );
  });
});

describe("pendingInviteZone", () => {
  it("maps counts into dial bands", () => {
    assert.equal(pendingInviteZone(0), "green");
    assert.equal(pendingInviteZone(249), "green");
    assert.equal(pendingInviteZone(250), "yellow");
    assert.equal(pendingInviteZone(500), "orange");
    assert.equal(pendingInviteZone(749), "orange");
    assert.equal(pendingInviteZone(750), "red");
    assert.equal(pendingInviteZoneColor(612), "#ea580c");
  });
});
