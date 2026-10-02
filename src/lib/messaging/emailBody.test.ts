import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emailNeedsBodyFetch,
  isPlaceholderEmailBody,
  isResolvedEmailBody,
} from "./emailBody";

describe("email body placeholders", () => {
  it("treats an empty body and a subject-only body as missing", () => {
    assert.equal(isPlaceholderEmailBody("", "Hello"), true);
    assert.equal(isPlaceholderEmailBody("Hello", "Hello"), true);
    assert.equal(isPlaceholderEmailBody("Hi there", "Hello"), false);
  });

  it("does not refetch mail Unipile already confirmed has no body", () => {
    assert.equal(isResolvedEmailBody({ body_resolved: true }), true);
    assert.equal(
      emailNeedsBodyFetch({
        bodyText: "Accepted: Call",
        subject: "Accepted: Call",
        metadata: { body_resolved: true },
      }),
      false
    );
    assert.equal(
      emailNeedsBodyFetch({
        bodyText: "Accepted: Call",
        subject: "Accepted: Call",
      }),
      true
    );
  });
});
