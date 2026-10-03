import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bestPersonName,
  mailboxPersonName,
  statedCounterpartEmail,
} from "./threadIdentity";

describe("statedCounterpartEmail", () => {
  it("reads a message that is only an email address", () => {
    assert.equal(
      statedCounterpartEmail("derekhollingdale@hotmail.com"),
      "derekhollingdale@hotmail.com"
    );
  });

  it("reads a short lead-in", () => {
    assert.equal(
      statedCounterpartEmail("My email is derek@hotmail.com"),
      "derek@hotmail.com"
    );
  });

  it("ignores an address buried in a longer note", () => {
    assert.equal(
      statedCounterpartEmail(
        "Hi Hilary, you can also reach my colleague ada@example.com about the course."
      ),
      null
    );
  });

  it("ignores a message with more than one address", () => {
    assert.equal(
      statedCounterpartEmail("ada@example.com or grace@example.com"),
      null
    );
  });
});

describe("mailboxPersonName", () => {
  it("uses the recipient display name on sent mail", () => {
    assert.equal(
      mailboxPersonName({
        isSent: true,
        fromName: "Hilary Mcnair",
        toName: "Derek Hollingdale",
      }),
      "Derek Hollingdale"
    );
  });

  it("does not treat the address as a name", () => {
    assert.equal(
      mailboxPersonName({
        isSent: true,
        toName: "derekhollingdale@hotmail.com",
      }),
      null
    );
  });
});

describe("bestPersonName", () => {
  it("prefers a full name over Unknown or the email", () => {
    assert.equal(
      bestPersonName([
        "Unknown",
        "derekhollingdale@hotmail.com",
        "Derek",
        "Derek Hollingdale",
      ]),
      "Derek Hollingdale"
    );
  });
});
