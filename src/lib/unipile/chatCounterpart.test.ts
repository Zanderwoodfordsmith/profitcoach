import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { identityFromUnipileWebhook } from "./chatCounterpart";

const coach = {
  attendee_id: "a1",
  attendee_name: "Daniel Coach",
  attendee_provider_id: "ACoCOACH",
  attendee_profile_url: "https://www.linkedin.com/in/ACoCOACH/",
};
const prospect = {
  attendee_id: "a2",
  attendee_name: "Zubeel Pervez",
  attendee_provider_id: "ACoPROSPECT",
  attendee_profile_url: "https://www.linkedin.com/in/zubeel-pervez/",
};

describe("identityFromUnipileWebhook", () => {
  it("never uses the coach as the other person when the coach sent it", () => {
    const id = identityFromUnipileWebhook({
      is_sender: true,
      sender: coach,
      attendees: [coach, prospect],
    });
    assert.equal(id.providerId, "ACoPROSPECT");
    assert.equal(id.name, "Zubeel Pervez");
    assert.ok(!String(id.profileUrl).includes("ACoCOACH"));
  });

  it("leaves the person unknown rather than guessing the coach", () => {
    const id = identityFromUnipileWebhook({
      is_sender: true,
      sender: coach,
      attendees: [],
    });
    assert.equal(id.providerId, null);
    assert.equal(id.profileUrl, null);
  });

  it("drops the account owner from attendees on inbound messages", () => {
    const id = identityFromUnipileWebhook({
      is_sender: false,
      sender: prospect,
      account_info: { user_id: "ACoCOACH" },
      attendees: [coach, prospect],
    });
    assert.equal(id.providerId, "ACoPROSPECT");
    assert.equal(id.name, "Zubeel Pervez");
  });
});
