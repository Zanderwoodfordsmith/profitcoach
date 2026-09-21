import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLibraryItemId,
  liveStepsFromLibrary,
  publishedTemplateError,
} from "./instantiateCore";
import type { CampaignLibraryItemDetail } from "./types";
import { defaultLibraryTemplateSettings } from "./sanitize";

function template(
  patch: Partial<CampaignLibraryItemDetail>
): CampaignLibraryItemDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    item_type: "template",
    kind: "connector",
    name: "Connection",
    description: "Invite then follow up.",
    status: "published",
    settings: defaultLibraryTemplateSettings(),
    step_count: 2,
    step_types: ["invite", "message"],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    steps: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        position: 3,
        step_type: "invite",
        body: "",
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        position: 9,
        step_type: "message",
        body: "Hi {{first_name}}",
      },
    ],
    ...patch,
  };
}

describe("published campaign templates", () => {
  it("accepts library uuids and hides drafts, sequences, and missing items", () => {
    assert.equal(isLibraryItemId("11111111-1111-4111-8111-111111111111"), true);
    assert.equal(isLibraryItemId("not-a-uuid"), false);
    assert.equal(publishedTemplateError(null), "Template not found.");
    assert.equal(
      publishedTemplateError(template({ status: "draft" })),
      "Template not found."
    );
    assert.equal(
      publishedTemplateError(template({ item_type: "sequence" })),
      "Template not found."
    );
    assert.equal(publishedTemplateError(template({})), null);
  });

  it("drops library step ids and reindexes for a live campaign", () => {
    const steps = liveStepsFromLibrary(template({}));
    assert.equal(steps.length, 2);
    assert.equal("id" in steps[0], false);
    assert.equal(steps[0].position, 0);
    assert.equal(steps[0].step_type, "invite");
    assert.equal(steps[1].position, 1);
    assert.equal(steps[1].body, "Hi {{first_name}}");
  });
});
