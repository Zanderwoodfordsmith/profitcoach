import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  insertableMergeFields,
  mergeFieldPickerForLibraryKind,
  mergeFieldPickerForMagnet,
  mergeFieldPickerForPlaybook,
  mergeFieldPickerHint,
  tokenizeMergeFields,
} from "./mergeFields";

function keys(picker: Parameters<typeof insertableMergeFields>[0]) {
  return insertableMergeFields(picker).map((field) => field.key);
}

describe("insertable merge fields", () => {
  it("keeps type of owner and market observation out of every picker", () => {
    const contexts = [
      { kind: "outreach" as const },
      { kind: "magnet_started" as const, magnetId: "boss-score" as const },
      { kind: "magnet_completed" as const, magnetId: "boss-score" as const },
      { kind: "custom" as const },
    ];
    for (const picker of contexts) {
      assert.ok(!keys(picker).includes("type_of_owner"));
      assert.ok(!keys(picker).includes("market_observation"));
    }
  });

  it("still recognises type of owner in existing copy", () => {
    const segments = tokenizeMergeFields("I work with {{type_of_owner}}");
    assert.equal(segments[1]?.kind, "field");
    if (segments[1]?.kind === "field") {
      assert.equal(segments[1].field.key, "type_of_owner");
    }
  });

  it("offers Boss assessment links on outreach, not score results", () => {
    const next = keys({ kind: "outreach" });
    assert.ok(next.includes("first_name"));
    assert.ok(next.includes("assessment_url"));
    assert.ok(next.includes("assessment_pro_url"));
    assert.ok(!next.includes("boss_score"));
    assert.ok(!next.includes("focus_area_1"));
    assert.ok(!next.includes("desired_outcome"));
    assert.ok(!next.includes("boss_score_report_link"));
  });

  it("offers the matching assessment link on started magnet sequences", () => {
    const boss = keys(mergeFieldPickerForMagnet("boss-score", "started"));
    assert.ok(boss.includes("assessment_url"));
    assert.ok(!boss.includes("assessment_pro_url"));
    assert.ok(!boss.includes("boss_score"));

    const pro = keys(mergeFieldPickerForMagnet("boss-score-pro", "started"));
    assert.ok(pro.includes("assessment_pro_url"));
    assert.ok(!pro.includes("assessment_url"));
    assert.ok(!pro.includes("boss_score"));
  });

  it("offers score results on completed magnet sequences, not assessment links", () => {
    const next = keys(mergeFieldPickerForMagnet("boss-score", "completed"));
    assert.ok(next.includes("boss_score"));
    assert.ok(next.includes("focus_area_1"));
    assert.ok(next.includes("desired_outcome"));
    assert.ok(next.includes("boss_score_report_link"));
    assert.ok(!next.includes("assessment_url"));
    assert.ok(!next.includes("assessment_pro_url"));
  });

  it("offers assessment links and results on custom campaigns", () => {
    const next = keys({ kind: "custom" });
    assert.ok(next.includes("assessment_url"));
    assert.ok(next.includes("assessment_pro_url"));
    assert.ok(next.includes("boss_score"));
    const score = insertableMergeFields({ kind: "custom" }).find(
      (field) => field.key === "boss_score"
    );
    assert.ok(score);
    assert.match(
      mergeFieldPickerHint(score, { kind: "custom" }),
      /completed the Boss Scorecard/
    );
  });

  it("maps playbooks and library kinds to the right picker", () => {
    assert.equal(
      mergeFieldPickerForPlaybook("vip-get-interest").kind,
      "outreach"
    );
    assert.deepEqual(mergeFieldPickerForPlaybook("scorecard-incomplete"), {
      kind: "magnet_started",
      magnetId: "boss-score",
    });
    assert.deepEqual(mergeFieldPickerForPlaybook("scorecard-pro-complete"), {
      kind: "magnet_completed",
      magnetId: "boss-score-pro",
    });
    assert.equal(mergeFieldPickerForPlaybook(null).kind, "custom");
    assert.equal(mergeFieldPickerForLibraryKind("connector").kind, "outreach");
    assert.equal(
      mergeFieldPickerForLibraryKind("positive_reply").kind,
      "custom"
    );
  });
});
