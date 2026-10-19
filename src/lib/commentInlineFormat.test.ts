import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LINK_MARKER as M,
  boldRanges,
  deleteBesideLinkMarker,
  linkIndexAt,
  linkSpans,
  reconcileLinkMarkers,
  splitBoldRuns,
  toggleBoldAt,
} from "./commentInlineFormat";
import { splitTextWithLinks } from "./communityAutolink";

describe("link markers", () => {
  const display = `See ${M}docs${M} and ${M}site${M}`;

  it("pairs markers in order", () => {
    assert.deepEqual(linkSpans(display), [
      { open: 4, close: 9 },
      { open: 15, close: 20 },
    ]);
  });

  it("finds the link holding the caret", () => {
    assert.equal(linkIndexAt(display, 6), 0);
    assert.equal(linkIndexAt(display, 9), 0);
    assert.equal(linkIndexAt(display, 4), -1);
    assert.equal(linkIndexAt(display, 17), 1);
  });

  it("keeps URLs when a label is edited", () => {
    const typed = `See ${M}docsX${M} and ${M}site${M}`;
    const out = reconcileLinkMarkers(display, ["a", "b"], typed, 10);
    assert.equal(out.display, typed);
    assert.deepEqual(out.urls, ["a", "b"]);
    assert.equal(out.caret, 10);
  });

  it("unlinks a link that lost one marker and keeps later URLs aligned", () => {
    // Select "cs‌ an" and delete: the first link's closing marker goes.
    const typed = `See ${M}dod${M}site${M}`;
    const out = reconcileLinkMarkers(display, ["a", "b"], typed, 7);
    assert.equal(out.display, `See dod${M}site${M}`);
    assert.deepEqual(out.urls, ["b"]);
    assert.equal(out.caret, 6);
  });

  it("drops a link whose label was emptied", () => {
    const typed = `See ${M}${M} and ${M}site${M}`;
    const out = reconcileLinkMarkers(display, ["a", "b"], typed, 5);
    assert.equal(out.display, `See  and ${M}site${M}`);
    assert.deepEqual(out.urls, ["b"]);
    assert.equal(out.caret, 4);
  });

  it("drops pasted markers", () => {
    const typed = `${M}x${display}`;
    const out = reconcileLinkMarkers(display, ["a", "b"], typed, 2);
    assert.equal(out.display, `x${display}`);
    assert.deepEqual(out.urls, ["a", "b"]);
    assert.equal(out.caret, 1);
  });

  it("backspace after a link deletes the label's last letter", () => {
    const edit = deleteBesideLinkMarker(display, 10, "backward");
    assert.deepEqual(edit, { display: `See ${M}doc${M} and ${M}site${M}`, caret: 9 });
  });

  it("delete before a link removes its first letter", () => {
    const edit = deleteBesideLinkMarker(display, 4, "forward");
    assert.deepEqual(edit, { display: `See ${M}ocs${M} and ${M}site${M}`, caret: 4 });
  });

  it("backspace removes a whole emoji past a marker", () => {
    const edit = deleteBesideLinkMarker(`a👍${M}x${M}`, 4, "backward");
    assert.deepEqual(edit, { display: `a${M}x${M}`, caret: 2 });
  });

  it("leaves ordinary backspace alone", () => {
    assert.equal(deleteBesideLinkMarker(display, 2, "backward"), null);
  });
});

describe("bold", () => {
  it("finds bold ranges and splits runs", () => {
    assert.deepEqual(boldRanges("a **b** c **d e**"), [
      { start: 2, end: 7 },
      { start: 10, end: 17 },
    ]);
    assert.deepEqual(splitBoldRuns("Hi **there** you"), [
      { text: "Hi ", bold: false },
      { text: "there", bold: true },
      { text: " you", bold: false },
    ]);
  });

  it("ignores stars with spaces inside or across lines", () => {
    assert.deepEqual(boldRanges("** no**"), []);
    assert.deepEqual(boldRanges("**a\nb**"), []);
    assert.deepEqual(boldRanges("****"), []);
  });

  it("wraps, unwraps and keeps spaces outside the stars", () => {
    assert.deepEqual(toggleBoldAt("say hi now", 3, 7), {
      text: "say **hi** now",
      start: 6,
      end: 8,
    });
    assert.deepEqual(toggleBoldAt("say **hi** now", 6, 8), {
      text: "say hi now",
      start: 4,
      end: 6,
    });
    assert.deepEqual(toggleBoldAt("ab", 1, 1), { text: "a****b", start: 3, end: 3 });
    assert.deepEqual(toggleBoldAt("a****b", 3, 3), { text: "ab", start: 1, end: 1 });
  });
});

describe("comment links", () => {
  it("renders markdown links and bare URLs", () => {
    assert.deepEqual(splitTextWithLinks("Read [the doc](https://x.com/a) or https://y.com"), [
      { type: "text", text: "Read " },
      { type: "url", href: "https://x.com/a", label: "the doc" },
      { type: "text", text: " or " },
      { type: "url", href: "https://y.com/", label: "https://y.com" },
    ]);
  });

  it("keeps unsafe links as text", () => {
    assert.deepEqual(splitTextWithLinks("[x](javascript:alert(1))"), [
      { type: "text", text: "[x](javascript:alert(1))" },
    ]);
  });
});
