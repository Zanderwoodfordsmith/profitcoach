import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composerChannelMenuSections,
  composerChannelOptions,
  connectedComposerChannels,
} from "./composerChannels";

describe("connectedComposerChannels", () => {
  it("treats every platform as connected until accounts load", () => {
    const connected = connectedComposerChannels({
      accounts: [],
      accountsLoaded: false,
    });
    assert.equal(connected.has("email"), true);
    assert.equal(connected.has("linkedin"), true);
    assert.equal(connected.has("whatsapp"), true);
  });

  it("maps Unipile accounts and org-wide email", () => {
    const connected = connectedComposerChannels({
      accounts: [
        { provider: "LINKEDIN", status: "OK" },
        { provider: "GOOGLE", status: "OK" },
        { provider: "WHATSAPP", status: "CREDENTIALS" },
      ],
      accountsLoaded: true,
    });
    assert.equal(connected.has("linkedin"), true);
    assert.equal(connected.has("email"), true);
    assert.equal(connected.has("whatsapp"), false);
    assert.equal(connected.has("sms"), true);

    const orgWide = connectedComposerChannels({
      accounts: [],
      accountsLoaded: true,
      adminOrgWideEmail: true,
    });
    assert.equal(orgWide.has("email"), true);
  });
});

describe("composerChannelOptions", () => {
  it("separates missing contact from a disconnected account", () => {
    const connected = connectedComposerChannels({
      accounts: [{ provider: "LINKEDIN", status: "OK" }],
      accountsLoaded: true,
    });
    const options = composerChannelOptions({
      lastChannel: "linkedin",
      prospectEmail: null,
      prospectPhone: null,
      prospectLinkedInUrl: "https://linkedin.com/in/chan",
      connected,
    });
    const byId = Object.fromEntries(options.map((row) => [row.id, row]));
    assert.equal(byId.linkedin?.sendable, true);
    assert.equal(byId.email?.notConnected, true);
    assert.equal(byId.email?.noContact, true);
    assert.equal(byId.email?.blockedLabel, "Not connected · No email");
    assert.equal(byId.whatsapp?.notConnected, true);
    assert.equal(byId.whatsapp?.noContact, true);
    assert.equal(byId.sms?.notConnected, false);
    assert.equal(byId.sms?.noContact, true);
    assert.equal(byId.sms?.blockedLabel, "No phone");
  });

  it("keeps WhatsApp sendable from an existing chat even without a stored phone", () => {
    const connected = connectedComposerChannels({
      accounts: [{ provider: "WHATSAPP", status: "OK" }],
      accountsLoaded: true,
    });
    const options = composerChannelOptions({
      lastChannel: "whatsapp",
      prospectPhone: null,
      connected,
      includeInternalNote: false,
    });
    const whatsapp = options.find((row) => row.id === "whatsapp");
    assert.equal(whatsapp?.sendable, true);
    assert.equal(
      options.some((row) => row.id === "comment"),
      false
    );
  });
});

describe("composerChannelMenuSections", () => {
  it("hides unsendable platforms unless they are current or hold the draft", () => {
    const connected = connectedComposerChannels({
      accounts: [{ provider: "LINKEDIN", status: "OK" }],
      accountsLoaded: true,
    });
    const options = composerChannelOptions({
      lastChannel: "linkedin",
      prospectLinkedInUrl: "https://linkedin.com/in/x",
      prospectEmail: "a@b.com",
      connected,
    });
    const sections = composerChannelMenuSections(options, "linkedin", "email");
    assert.deepEqual(
      sections.visible.map((row) => row.id),
      ["email", "linkedin"]
    );
    assert.equal(
      sections.hidden.some((row) => row.id === "sms"),
      true
    );
    assert.equal(sections.comment[0]?.id, "comment");
  });
});
