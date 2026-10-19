import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { connectionNoteIndex, fitConnectionNote, keepsFacts } from "./connectionNote";
import type { BlueprintBlock } from "./types";

const blocks: BlueprintBlock[] = [
  { type: "lede", text: "The angle." },
  { type: "message", label: "Example", body: "Not the note." },
  { type: "heading", text: "The sequence" },
  { type: "message", label: "Connection request", body: "Hi {first_name}, short note. Is this of interest?", note: "Send with request. 50 characters." },
  { type: "message", label: "Message 1", body: "Thanks for connecting." },
];

describe("connection note", () => {
  it("finds the first message under the sequence heading", () => {
    assert.equal(connectionNoteIndex(blocks), 3);
    assert.equal(connectionNoteIndex([{ type: "lede", text: "x" }]), -1);
  });

  it("checks a shorter note kept every number and token", () => {
    const before = "Hi {first_name}, I grew it from £4.2m to £11.8m in 5 years. [Your result] Is this of interest?";
    assert.equal(keepsFacts(before, "Hi {first_name}, from £4.2m to £11.8m in 5 years. [Your result] Of interest?"), true);
    assert.equal(keepsFacts(before, "Hi {first_name}, I grew it a lot. [Your result] Of interest?"), false);
  });

  it("leaves short notes and other sections alone without calling a model", async () => {
    assert.equal(await fitConnectionNote("campaigns:messaging", blocks), blocks);
    assert.equal(await fitConnectionNote("campaigns:nurture", blocks), blocks);
  });
});
