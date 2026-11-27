import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanBusiness, joinBusinessLine, placeFromLocation } from "./theirBusiness";

describe("business type and location", () => {
  it("reads the town from LinkedIn's location shapes", () => {
    assert.deepEqual(placeFromLocation("York, England, United Kingdom"), { place: "York", uk: true });
    assert.deepEqual(placeFromLocation("Greater London, England, United Kingdom"), { place: "London", uk: true });
    assert.deepEqual(placeFromLocation("London Area, United Kingdom"), { place: "London", uk: true });
    assert.deepEqual(placeFromLocation("Greater Leeds Area"), { place: "Leeds", uk: false });
    assert.deepEqual(placeFromLocation("Belfast Metropolitan Area"), { place: "Belfast", uk: false });
    assert.deepEqual(placeFromLocation("City Of Peterborough, England, United Kingdom"), { place: "Peterborough", uk: true });
    assert.deepEqual(placeFromLocation("Newcastle Upon Tyne, England, United Kingdom"), { place: "Newcastle upon Tyne", uk: true });
    assert.deepEqual(placeFromLocation("West Midlands, England, United Kingdom"), { place: "the West Midlands", uk: true });
    assert.deepEqual(placeFromLocation("leeds, england"), { place: "Leeds", uk: true });
  });

  it("knows the country but not the town", () => {
    assert.deepEqual(placeFromLocation("United Kingdom"), { place: null, uk: true });
    assert.deepEqual(placeFromLocation("England, United Kingdom"), { place: null, uk: true });
    assert.deepEqual(placeFromLocation("United States"), { place: null, uk: false });
    assert.deepEqual(placeFromLocation(null), { place: null, uk: false });
    assert.deepEqual(placeFromLocation(null, "Bath"), { place: "Bath", uk: false });
  });

  it("steps down the ladder: town, then UK, then nothing", () => {
    assert.equal(joinBusinessLine("an Italian restaurant", { place: "Leeds", uk: true }), "an Italian restaurant in Leeds");
    assert.equal(joinBusinessLine("an Italian restaurant", { place: null, uk: true }), "an Italian restaurant in the UK");
    assert.equal(joinBusinessLine("an Italian restaurant", { place: null, uk: false }), "an Italian restaurant");
    assert.equal(joinBusinessLine("a hospitality business", { place: "Bath", uk: true }), "a hospitality business in Bath");
  });

  it("keeps only answers that fit 'I see you run ___'", () => {
    assert.equal(cleanBusiness("A Korean restaurant."), "a Korean restaurant");
    assert.equal(cleanBusiness("two Italian restaurants"), "two Italian restaurants");
    assert.equal(cleanBusiness("a café–bar"), "a cafe-bar");
    assert.equal(cleanBusiness("a bakery and Café"), "a bakery and cafe");
    assert.equal(cleanBusiness("Red Devil Korean Restaurant"), "");
    assert.equal(cleanBusiness("a restaurant in London"), "");
    assert.equal(cleanBusiness("a restaurant with 3 sites"), "");
    assert.equal(cleanBusiness("a {{company}}"), "");
    assert.equal(cleanBusiness("a really very long description of a business that goes on"), "");
  });
});
