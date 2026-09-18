import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyComposeDraftStore,
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
});
