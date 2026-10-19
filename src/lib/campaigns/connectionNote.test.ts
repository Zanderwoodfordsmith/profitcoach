import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONNECTION_NOTE_MAX,
  checkConnectionNote,
  connectionNoteLength,
  templateFillIns,
} from "./connectionNote";

describe("connectionNoteLength", () => {
  it("counts plain text as typed, ignoring outer spaces", () => {
    assert.equal(connectionNoteLength("  Hi there  "), 8);
  });

  it("leaves room for a 10-character first name", () => {
    assert.equal(connectionNoteLength("Hi {{first_name}},"), 3 + 10 + 1);
  });

  it("resolves aliases and counts unknown fields at a typical length", () => {
    assert.equal(connectionNoteLength("{{firstName}}"), 10);
    assert.equal(connectionNoteLength("{{something_new}}"), 20);
  });
});

describe("checkConnectionNote", () => {
  it("is fine at exactly the limit and over by one past it", () => {
    const atLimit = "a".repeat(CONNECTION_NOTE_MAX - 10) + "{{first_name}}";
    assert.equal(checkConnectionNote(atLimit).over, 0);
    assert.equal(checkConnectionNote(atLimit + "!").over, 1);
  });

  it("sorts scorecard fields into links and results, once each", () => {
    const check = checkConnectionNote(
      "Hi {{first_name}}, take {{assessment_url}}. You scored {{boss_score}} and {{boss_score}}."
    );
    assert.deepEqual(check.scorecardLinks, ["Boss assessment link"]);
    assert.deepEqual(check.scorecardResults, ["BOSS score"]);
  });

  it("leaves prospect fields alone", () => {
    const check = checkConnectionNote("Hi {{first_name}} at {{company}}");
    assert.deepEqual(check.scorecardLinks, []);
    assert.deepEqual(check.scorecardResults, []);
  });
});

describe("templateFillIns", () => {
  it("finds [bracketed] template bits and ignores merge fields", () => {
    assert.deepEqual(
      templateFillIns("Hi {{first_name}}, I work with [who you help] in [area]."),
      ["[who you help]", "[area]"]
    );
    assert.deepEqual(templateFillIns("Hi {{first_name}}, all done."), []);
  });

  it("is counted in the note check", () => {
    assert.equal(checkConnectionNote("I work with [who you help].").fillIns, 1);
  });
});
