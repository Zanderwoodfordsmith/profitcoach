import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeDraftPreview,
  emptyComposeDraftStore,
  nextComposeDraftChannel,
  parseComposeDraftStore,
  removeDraftFromStore,
  upsertDraftInStore,
} from "./composeDraft";

describe("composeDraft store", () => {
  it("reads the legacy single-draft shape", () => {
    const store = parseComposeDraftStore(
      JSON.stringify({
        conversationId: "abc",
        body: "Hi there",
        channel: "linkedin",
      })
    );
    assert.equal(store.lastId, "abc");
    assert.equal(store.drafts.abc?.body, "Hi there");
    assert.equal(store.drafts.abc?.channel, "linkedin");
  });

  it("keeps a draft per conversation and drops empty ones", () => {
    let store = emptyComposeDraftStore();
    store = upsertDraftInStore(store, {
      conversationId: "one",
      body: "Draft one",
    });
    store = upsertDraftInStore(store, {
      conversationId: "two",
      body: "Draft two",
      channel: "email",
    });
    assert.equal(Object.keys(store.drafts).length, 2);
    store = upsertDraftInStore(store, { conversationId: "one", body: "   " });
    assert.equal(store.drafts.one, undefined);
    assert.equal(store.drafts.two?.body, "Draft two");
    store = removeDraftFromStore(store, "two");
    assert.deepEqual(store.drafts, {});
  });

  it("keeps the original draft channel until the text changes", () => {
    const existing = {
      conversationId: "one",
      body: "Hello",
      channel: "linkedin" as const,
    };
    assert.equal(
      nextComposeDraftChannel({
        existing,
        body: "Hello",
        channel: "email",
      }),
      "linkedin"
    );
    assert.equal(
      nextComposeDraftChannel({
        existing,
        body: "Hello there",
        channel: "email",
      }),
      "email"
    );
    assert.equal(
      composeDraftPreview({ body: "A short draft", subject: "Hi" }),
      "A short draft"
    );
  });
});
