import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bcaTranscriptsUrlForTest } from "./bcaTranscripts";

describe("bca transcript URL", () => {
  it("rewrites the member webhook path", () => {
    assert.equal(
      bcaTranscriptsUrlForTest(
        "https://www.businesscoachacademy.com/api/webhooks/profit-coach/member"
      ),
      "https://www.businesscoachacademy.com/api/internal/profit-coach/transcripts"
    );
  });
});
