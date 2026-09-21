import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeTextToEditorHtml } from "./MergeFieldComposer";

describe("merge field editor html", () => {
  it("turns stored line breaks into <br> so paragraphs stay visible", () => {
    const html = mergeTextToEditorHtml(
      "Hi {{first_name}}, thanks for connecting.\n\nRing any bells?"
    );
    assert.match(html, /<br>/);
    assert.match(html, /data-merge-key="first_name"/);
    assert.doesNotMatch(html, /thanks for connecting.\n/);
  });
});
