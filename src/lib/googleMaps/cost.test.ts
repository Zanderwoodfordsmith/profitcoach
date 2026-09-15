import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatGoogleMapsApproxDuration,
  formatGoogleMapsSizeOption,
} from "./cost";

describe("Google Maps size labels", () => {
  it("uses one round duration in brackets", () => {
    assert.equal(formatGoogleMapsSizeOption(20), "20 businesses (2 min)");
    assert.equal(formatGoogleMapsSizeOption(100), "100 businesses (10 min)");
    assert.equal(formatGoogleMapsSizeOption(250), "250 businesses (25 min)");
    assert.equal(formatGoogleMapsSizeOption(500), "500 businesses (50 min)");
    assert.equal(formatGoogleMapsSizeOption(1000), "1,000 businesses (1 hr)");
  });

  it("does not show a range", () => {
    assert.equal(formatGoogleMapsApproxDuration(100), "10 min");
    assert.equal(formatGoogleMapsApproxDuration(1000), "1 hr");
  });
});
