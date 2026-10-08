import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { PUBLIC_APP_ORIGIN, getPublicAppBaseUrl } from "./appBaseUrl";

const saved = {
  app: process.env.APP_BASE_URL,
  pub: process.env.PUBLIC_APP_BASE_URL,
};

afterEach(() => {
  process.env.APP_BASE_URL = saved.app;
  process.env.PUBLIC_APP_BASE_URL = saved.pub;
  if (saved.app === undefined) delete process.env.APP_BASE_URL;
  if (saved.pub === undefined) delete process.env.PUBLIC_APP_BASE_URL;
});

describe("getPublicAppBaseUrl", () => {
  it("never returns localhost, even when APP_BASE_URL is local", () => {
    delete process.env.PUBLIC_APP_BASE_URL;
    process.env.APP_BASE_URL = "http://localhost:3002";
    assert.equal(getPublicAppBaseUrl(), PUBLIC_APP_ORIGIN);
    delete process.env.APP_BASE_URL;
    const req = new Request("http://127.0.0.1:3002/api/x");
    assert.equal(getPublicAppBaseUrl(req), PUBLIC_APP_ORIGIN);
  });

  it("keeps a real public origin", () => {
    delete process.env.PUBLIC_APP_BASE_URL;
    process.env.APP_BASE_URL = "https://www.theprofitcoach.com/";
    assert.equal(getPublicAppBaseUrl(), "https://www.theprofitcoach.com");
  });
});
