import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  arrangeProspectTableViews,
  createDefaultProspectTableViewSettings,
  createProspectSmartListSettings,
  DEFAULT_PROSPECT_SMART_LISTS,
  isProtectedProspectViewName,
  normalizeProspectTableViewSettings,
  orderProspectTableViews,
  prependMissingIds,
  prospectSmartListIdsInOrder,
  prospectTableViewSettingsEqual,
  uniqueProspectViewCopyName,
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
    assert.equal(normalized.columnOrder[0], "contact_info");
    assert.equal(normalized.columnOrder[1], "next_call");
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

  it("inserts Contact Info at the start of saved column order", () => {
    const normalized = normalizeProspectTableViewSettings({
      columnOrder: ["status", "linkedin"],
    });
    assert.equal(normalized.columnOrder[0], "contact_info");
    assert.equal(normalized.columnVisibility.contact_info, true);
  });

  it("treats equivalent settings as equal after normalize", () => {
    const a = createDefaultProspectTableViewSettings();
    const b = normalizeProspectTableViewSettings({
      ...a,
      columnVisibility: { ...a.columnVisibility, actions: false },
    });
    assert.equal(prospectTableViewSettingsEqual(a, b), true);
  });

  it("seeds prospect pipeline smart lists separately from Pool", () => {
    assert.deepEqual(
      DEFAULT_PROSPECT_SMART_LISTS.map((list) => list.name),
      ["Replied", "Interested", "Booked", "Follow-up"]
    );
    assert.equal(isProtectedProspectViewName("All"), true);
    assert.equal(isProtectedProspectViewName("Replied"), true);
    assert.equal(isProtectedProspectViewName("Interested"), true);
    const booked = createProspectSmartListSettings("booked");
    assert.equal(booked.statusFilter, "booked");
    assert.equal(booked.grouping.field, null);
    const interested = createProspectSmartListSettings("interested");
    assert.equal(interested.statusFilter, "interested");
  });

  it("arranges All then pipeline lists before custom views", () => {
    const arranged = arrangeProspectTableViews([
      { id: "custom", name: "Warm" },
      { id: "follow", name: "Follow-up" },
      { id: "all", name: "All" },
      { id: "replied", name: "Replied" },
      { id: "interested", name: "Interested" },
      { id: "booked", name: "Booked" },
    ]);
    assert.deepEqual(
      arranged.map((view) => view.name),
      ["All", "Replied", "Interested", "Booked", "Follow-up", "Warm"]
    );
  });

  it("puts newly seeded smart lists after All without reshuffling saved order", () => {
    const views = [
      { id: "all", name: "All" },
      { id: "replied", name: "Replied" },
      { id: "interested", name: "Interested" },
      { id: "booked", name: "Booked" },
      { id: "follow", name: "Follow-up" },
    ];
    assert.deepEqual(prospectSmartListIdsInOrder(views), [
      "replied",
      "interested",
      "booked",
      "follow",
    ]);
    assert.deepEqual(
      prependMissingIds(["follow"], ["replied", "interested", "booked", "follow"]),
      ["replied", "interested", "booked", "follow"]
    );
    assert.deepEqual(
      prependMissingIds(
        ["booked", "follow", "replied"],
        ["replied", "interested", "booked", "follow"]
      ),
      ["interested", "booked", "follow", "replied"]
    );
  });

  it("pins pipeline lists in canonical order even if saved order is shuffled", () => {
    const views = [
      {
        id: "warm",
        name: "Warm",
        settings: createDefaultProspectTableViewSettings(),
        createdBy: "u",
        canEdit: true,
      },
      {
        id: "follow",
        name: "Follow-up",
        settings: createProspectSmartListSettings("follow_up"),
        createdBy: "u",
        canEdit: true,
      },
      {
        id: "all",
        name: "All",
        settings: createDefaultProspectTableViewSettings(),
        createdBy: "u",
        canEdit: true,
      },
      {
        id: "booked",
        name: "Booked",
        settings: createProspectSmartListSettings("booked"),
        createdBy: "u",
        canEdit: true,
      },
      {
        id: "interested",
        name: "Interested",
        settings: createProspectSmartListSettings("interested"),
        createdBy: "u",
        canEdit: true,
      },
      {
        id: "replied",
        name: "Replied",
        settings: createProspectSmartListSettings("replied"),
        createdBy: "u",
        canEdit: true,
      },
    ];
    assert.deepEqual(
      orderProspectTableViews(views, ["warm", "follow", "booked"]).map(
        (view) => view.name
      ),
      ["All", "Replied", "Interested", "Booked", "Follow-up", "Warm"]
    );
  });

  it("names duplicated views with copy, then a number", () => {
    assert.equal(uniqueProspectViewCopyName("All", ["All"]), "All copy");
    assert.equal(
      uniqueProspectViewCopyName("Replied", ["All", "Replied"]),
      "Replied copy"
    );
    assert.equal(
      uniqueProspectViewCopyName("Replied", ["All", "Replied", "Replied copy"]),
      "Replied copy 2"
    );
  });
});
