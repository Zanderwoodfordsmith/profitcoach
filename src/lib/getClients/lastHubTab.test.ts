import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getClientsTabItems } from "../../components/layout/dashboardNavItems";
import {
  GET_CLIENTS_LAST_TAB_KEYS,
  getClientsHubHomeHref,
  getClientsLastTabKeyForPathname,
  hrefForGetClientsLastTab,
  readGetClientsLastTabHref,
  rememberGetClientsLastTab,
  type StorageLike,
} from "./lastHubTab";

function memoryStorage(initial?: Record<string, string>): StorageLike {
  const map = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("getClientsLastTabKeyForPathname", () => {
  it("maps tab roots and nested routes to tab keys", () => {
    assert.equal(
      getClientsLastTabKeyForPathname("/coach/campaigns"),
      "campaigns"
    );
    assert.equal(
      getClientsLastTabKeyForPathname("/coach/campaigns/abc/edit"),
      "campaigns"
    );
    assert.equal(
      getClientsLastTabKeyForPathname("/admin/conversations"),
      "conversations"
    );
    assert.equal(getClientsLastTabKeyForPathname("/coach/calls"), "calls");
    assert.equal(
      getClientsLastTabKeyForPathname(
        "/coach/prospects/11111111-1111-1111-1111-111111111111"
      ),
      "prospects"
    );
    assert.equal(
      getClientsLastTabKeyForPathname("/admin/linkedin"),
      "content"
    );
    assert.equal(getClientsLastTabKeyForPathname("/coach/share"), "links");
  });

  it("ignores hub satellites and other apps", () => {
    assert.equal(
      getClientsLastTabKeyForPathname("/coach/first-campaign"),
      null
    );
    assert.equal(
      getClientsLastTabKeyForPathname("/coach/community"),
      null
    );
    assert.equal(getClientsLastTabKeyForPathname("/login"), null);
  });
});

describe("session last tab", () => {
  it("falls back to Conversations when nothing is stored", () => {
    const storage = memoryStorage();
    assert.equal(
      readGetClientsLastTabHref("/coach", storage),
      "/coach/conversations"
    );
    assert.equal(getClientsHubHomeHref("/admin"), "/admin/conversations");
  });

  it("remembers the last Get Clients tab for this prefix only", () => {
    const storage = memoryStorage();
    rememberGetClientsLastTab("/coach/campaigns", storage);
    rememberGetClientsLastTab("/admin/calls", storage);
    assert.equal(
      readGetClientsLastTabHref("/coach", storage),
      "/coach/campaigns"
    );
    assert.equal(readGetClientsLastTabHref("/admin", storage), "/admin/calls");
  });

  it("does not overwrite when leaving the hub", () => {
    const storage = memoryStorage();
    rememberGetClientsLastTab("/coach/calls", storage);
    rememberGetClientsLastTab("/coach/community", storage);
    assert.equal(readGetClientsLastTabHref("/coach", storage), "/coach/calls");
  });

  it("ignores garbage stored values", () => {
    const storage = memoryStorage({
      "pc-get-clients-last-tab:/coach": "/https://evil.example/phish",
    });
    assert.equal(
      readGetClientsLastTabHref("/coach", storage),
      "/coach/conversations"
    );
  });
});

describe("getClientsTabItems stay rememberable", () => {
  it("maps every hub tab href to a last-tab key", () => {
    for (const prefix of ["/coach", "/admin"] as const) {
      for (const item of getClientsTabItems(prefix)) {
        const key = getClientsLastTabKeyForPathname(item.href);
        assert.ok(
          key,
          `unmapped Get Clients tab ${item.href} — add it to lastHubTab`
        );
        assert.equal(hrefForGetClientsLastTab(prefix, key), item.href);
        assert.ok(GET_CLIENTS_LAST_TAB_KEYS.includes(key));
      }
    }
  });
});
