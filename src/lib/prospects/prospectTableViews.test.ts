import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDefaultProspectTableViewSettings,
  normalizeProspectTableViewSettings,
  prospectTableViewSettingsEqual,
} from "./prospectTableViews";

describe("prospect table view settings", () => {
  it("fills defaults for empty input", () => {
    const normalized = normalizeProspectTableViewSettings(null);
    assert.deepEqual(normalized, createDefaultProspectTableViewSettings());
  });

  it("keeps a valid custom setup", () => {
    const normalized = normalizeProspectTableViewSettings({
      statusFilter: "lead",
      tagFilter: "hot",
      coachFilter: "abc",
      assessedFilter: "assessed",
      callFilter: "has_call",
      sortField: "next_call",
      sortOrder: "desc",
      grouping: { field: "status", order: "manual", manualOrder: { status: ["status:lead"] } },
      columnVisibility: { status: false, linkedin: true },
      columnOrder: ["next_call", "status"],
    });
    assert.equal(normalized.statusFilter, "lead");
    assert.equal(normalized.tagFilter, "hot");
    assert.equal(normalized.coachFilter, "abc");
    assert.equal(normalized.assessedFilter, "assessed");
    assert.equal(normalized.callFilter, "has_call");
    assert.equal(normalized.sortField, "next_call");
    assert.equal(normalized.sortOrder, "desc");
    assert.equal(normalized.grouping.field, "status");
    assert.equal(normalized.grouping.order, "manual");
    assert.deepEqual(normalized.grouping.manualOrder.status, ["status:lead"]);
    assert.equal(normalized.columnVisibility.status, false);
    assert.equal(normalized.columnOrder[0], "next_call");
  });

  it("rejects unknown sort and group values", () => {
    const normalized = normalizeProspectTableViewSettings({
      sortField: "nope",
      sortOrder: "sideways",
      grouping: { field: "unknown", order: "random" },
    });
    assert.equal(normalized.sortField, "name");
    assert.equal(normalized.sortOrder, "asc");
    assert.equal(normalized.grouping.field, null);
    assert.equal(normalized.grouping.order, "asc");
  });

  it("treats equivalent settings as equal after normalize", () => {
    const a = createDefaultProspectTableViewSettings();
    const b = normalizeProspectTableViewSettings({
      ...a,
      columnVisibility: { ...a.columnVisibility, actions: false },
    });
    assert.equal(prospectTableViewSettingsEqual(a, b), true);
  });
});
