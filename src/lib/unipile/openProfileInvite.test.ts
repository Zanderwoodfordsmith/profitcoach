import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  campaignLeadIsOpenProfile,
  inviteOpenProfileInmailFrom,
  isInmailRejected,
  isOpenProfileSendRef,
  jobUsesInviteQuota,
  jobUsesMessageQuota,
  openInmailText,
  openProfileSendRef,
  shouldSendOpenProfileInmail,
  unipileProfileIsOpen,
} from "./openProfileInvite";

describe("inviteOpenProfileInmailFrom", () => {
  it("defaults on so Open Profiles get a message", () => {
    assert.equal(inviteOpenProfileInmailFrom({}), true);
    assert.equal(inviteOpenProfileInmailFrom({ open_profile_inmail: false }), false);
    assert.equal(inviteOpenProfileInmailFrom({ open_profile_inmail: true }), true);
  });
});

describe("unipileProfileIsOpen", () => {
  it("reads Unipile profile flags and stays null when missing", () => {
    assert.equal(unipileProfileIsOpen({ is_open_profile: true }), true);
    assert.equal(unipileProfileIsOpen({}), null);
  });
});

describe("open profile send refs", () => {
  it("tags InMail sends so they do not count as invites", () => {
    const ref = openProfileSendRef("chat-1", "msg-1");
    assert.equal(isOpenProfileSendRef(ref), true);
    assert.equal(isOpenProfileSendRef("invitation-abc"), false);
  });
});

describe("isInmailRejected", () => {
  it("detects Unipile InMail refusals so we can fall back to invite", () => {
    assert.equal(
      isInmailRejected({ raw: { type: "errors/not_allowed_inmail" } }),
      true
    );
    assert.equal(isInmailRejected({ error: "Invite failed" }), false);
  });
});

describe("openInmailText", () => {
  it("requires copy and caps length", () => {
    assert.equal(openInmailText("   "), null);
    assert.equal(openInmailText("Hi there"), "Hi there");
    assert.equal(openInmailText("x".repeat(2000))?.length, 1900);
  });
});

describe("shouldSendOpenProfileInmail", () => {
  it("needs an invite step, the setting, a known Open Profile, and a note", () => {
    assert.equal(
      shouldSendOpenProfileInmail({
        stepType: "invite",
        config: {},
        openProfile: true,
        note: "Hi",
      }),
      true
    );
    assert.equal(
      shouldSendOpenProfileInmail({
        stepType: "invite",
        config: { open_profile_inmail: false },
        openProfile: true,
        note: "Hi",
      }),
      false
    );
    assert.equal(
      shouldSendOpenProfileInmail({
        stepType: "invite",
        config: {},
        openProfile: null,
        note: "Hi",
      }),
      false
    );
    assert.equal(
      shouldSendOpenProfileInmail({
        stepType: "invite",
        config: {},
        openProfile: true,
        note: "  ",
      }),
      false
    );
    assert.equal(
      shouldSendOpenProfileInmail({
        stepType: "message",
        config: {},
        openProfile: true,
        note: "Hi",
      }),
      false
    );
  });
});

describe("open profile quota", () => {
  it("keeps InMails off the invite cap and on the message cap", () => {
    const ref = openProfileSendRef("chat-1", "msg-1");
    assert.equal(jobUsesInviteQuota("invite", ref), false);
    assert.equal(jobUsesMessageQuota("invite", ref), true);
    assert.equal(jobUsesInviteQuota("invite", "invitation-abc"), true);
    assert.equal(jobUsesMessageQuota("invite", "invitation-abc"), false);
    assert.equal(jobUsesInviteQuota("instagram_follow", ref), true);
    assert.equal(campaignLeadIsOpenProfile({ open_profile: true }), true);
    assert.equal(campaignLeadIsOpenProfile({ metadata: { open_profile: true } }), true);
    assert.equal(campaignLeadIsOpenProfile({}), null);
  });
});
