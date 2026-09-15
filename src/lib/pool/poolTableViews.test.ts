import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POOL_COLUMN_LAYOUT_VERSION } from "./poolPeople";
import {
  createDefaultPoolTableViewSettings,
  normalizePoolTableViewSettings,
  poolTableViewSettingsEqual,
  uniquePoolViewCopyName,
} from "./poolTableViews";

describe("pool table views", () => {
  it("normalizes unknown filters to All", () => {
    const settings = normalizePoolTableViewSettings({
      sourceFilter: "sales_nav",
      campaignFilter: "not_in_campaign",
      sortField: "company",
      sortOrder: "desc",
    });
    assert.equal(settings.sourceFilter, "sales_nav");
    assert.equal(settings.campaignFilter, "not_in_campaign");
    assert.equal(settings.contactFilter, "all");
    assert.equal(settings.dateAddedFilter, "all");
    assert.equal(settings.tagFilter, "all");
    assert.equal(settings.sortField, "company");
    assert.equal(settings.sortOrder, "desc");
    assert.equal(settings.grouping.field, null);
  });

  it("keeps contact, date, and tag filters", () => {
    const settings = normalizePoolTableViewSettings({
      contactFilter: "both",
      dateAddedFilter: "7d",
      tagFilter: "Hot",
      grouping: { field: "tags", order: "asc", manualOrder: {} },
    });
    assert.equal(settings.contactFilter, "both");
    assert.equal(settings.dateAddedFilter, "7d");
    assert.equal(settings.tagFilter, "Hot");
    assert.equal(settings.grouping.field, "tags");
    assert.equal(settings.columnVisibility.tags, true);
  });

  it("folds title company website into the name cell and keeps Contact Info", () => {
    const settings = normalizePoolTableViewSettings({
      columnVisibility: {
        title: true,
        company: true,
        website: true,
        source: true,
        campaign: true,
        created_at: true,
        linkedin: true,
        address: false,
      },
      columnOrder: [
        "title",
        "company",
        "website",
        "source",
        "campaign",
        "created_at",
        "linkedin",
      ],
    });
    assert.equal(settings.columnVisibility.title, false);
    assert.equal(settings.columnVisibility.company, false);
    assert.equal(settings.columnVisibility.website, false);
    assert.equal(settings.columnVisibility.contact_info, true);
    assert.equal(settings.columnVisibility.address, false);
    assert.equal(settings.columnLayoutVersion, POOL_COLUMN_LAYOUT_VERSION);
    assert.equal(settings.columnOrder[0], "contact_info");
  });

  it("drops legacy email and phone columns", () => {
    const settings = normalizePoolTableViewSettings({
      columnLayoutVersion: 2,
      columnVisibility: {
        title: false,
        company: false,
        email: true,
        phone: true,
        website: false,
        source: true,
        campaign: true,
        created_at: true,
        linkedin: true,
        address: false,
      },
      columnOrder: ["email", "phone", "source"],
    } as never);
    assert.equal(settings.columnVisibility.contact_info, true);
    assert.equal(
      settings.columnOrder.includes("email" as never),
      false
    );
    assert.equal(
      settings.columnOrder.includes("phone" as never),
      false
    );
  });

  it("keeps Contact Info hidden after the current layout version", () => {
    const settings = normalizePoolTableViewSettings({
      columnLayoutVersion: POOL_COLUMN_LAYOUT_VERSION,
      columnVisibility: {
        contact_info: false,
        title: false,
        company: false,
        website: false,
        source: true,
        campaign: true,
        created_at: true,
        linkedin: true,
        address: false,
        tags: true,
      },
    });
    assert.equal(settings.columnVisibility.contact_info, false);
  });

  it("treats matching settings as equal", () => {
    const a = createDefaultPoolTableViewSettings();
    const b = normalizePoolTableViewSettings({
      ...a,
      sourceFilter: "all",
    });
    assert.equal(poolTableViewSettingsEqual(a, b), true);
  });

  it("names duplicated views with copy, then a number", () => {
    assert.equal(uniquePoolViewCopyName("All", ["All"]), "All copy");
    assert.equal(
      uniquePoolViewCopyName("All", ["All", "All copy"]),
      "All copy 2"
    );
    assert.equal(
      uniquePoolViewCopyName("Warm leads", ["All", "Warm leads"]),
      "Warm leads copy"
    );
  });
});
