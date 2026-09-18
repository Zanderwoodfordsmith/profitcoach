import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCoachIdHeader } from "../coachId";
import { effectiveMessagingCoachId } from "./messagingCoachScope";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEMO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COACH = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("effectiveMessagingCoachId", () => {
  it("locks a coach to themselves even if an impersonate header is present", () => {
    assert.equal(
      effectiveMessagingCoachId({
        userId: COACH,
        isAdmin: false,
        impersonateId: DEMO,
      }),
      COACH
    );
  });

  it("scopes an admin to the impersonated coach", () => {
    assert.equal(
      effectiveMessagingCoachId({
        userId: ADMIN,
        isAdmin: true,
        impersonateId: DEMO,
      }),
      DEMO
    );
  });

  it("fails closed to the admin's own id — never all coaches", () => {
    assert.equal(
      effectiveMessagingCoachId({
        userId: ADMIN,
        isAdmin: true,
        impersonateId: null,
      }),
      ADMIN
    );
  });
});

describe("parseCoachIdHeader", () => {
  it("accepts a UUID and rejects garbage", () => {
    assert.equal(parseCoachIdHeader(DEMO), DEMO);
    assert.equal(parseCoachIdHeader("  " + DEMO + "  "), DEMO);
    assert.equal(parseCoachIdHeader("not-a-uuid"), null);
    assert.equal(parseCoachIdHeader(""), null);
    assert.equal(parseCoachIdHeader(null), null);
  });
});
