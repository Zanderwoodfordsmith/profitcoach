import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  expandGoogleMapsLocationAliases,
  resolveGoogleMapsLocation,
} from "./location";

describe("expand Google Maps location aliases", () => {
  it("turns UK into United Kingdom", () => {
    assert.equal(expandGoogleMapsLocationAliases("UK"), "United Kingdom");
    assert.equal(
      expandGoogleMapsLocationAliases("Manchester, UK"),
      "Manchester, United Kingdom"
    );
  });

  it("does not treat UK inside other words", () => {
    assert.equal(expandGoogleMapsLocationAliases("Dukinfield"), "Dukinfield");
  });
});

describe("resolve Google Maps location", () => {
  it("lets city be blank and searches the whole country", () => {
    const resolved = resolveGoogleMapsLocation({ countryCode: "GB" });
    assert.deepEqual(resolved, {
      locationQuery: "United Kingdom",
      countryCode: "GB",
      countryLabel: "United Kingdom",
      stateCode: null,
      stateLabel: null,
    });
  });

  it("appends the full country name to a city", () => {
    const resolved = resolveGoogleMapsLocation({
      countryCode: "GB",
      city: "Manchester",
    });
    assert.deepEqual(resolved, {
      locationQuery: "Manchester, United Kingdom",
      countryCode: "GB",
      countryLabel: "United Kingdom",
      stateCode: null,
      stateLabel: null,
    });
  });

  it("does not duplicate country when the city already has UK", () => {
    const resolved = resolveGoogleMapsLocation({
      countryCode: "GB",
      city: "Manchester, UK",
    });
    assert.deepEqual(resolved, {
      locationQuery: "Manchester, United Kingdom",
      countryCode: "GB",
      countryLabel: "United Kingdom",
      stateCode: null,
      stateLabel: null,
    });
  });

  it("expands a legacy location of UK", () => {
    const resolved = resolveGoogleMapsLocation({ location: "UK" });
    assert.deepEqual(resolved, {
      locationQuery: "United Kingdom",
      countryCode: null,
      countryLabel: null,
      stateCode: null,
      stateLabel: null,
    });
  });

  it("requires a country name when Other is selected", () => {
    const resolved = resolveGoogleMapsLocation({ countryCode: "OTHER" });
    assert.equal("error" in resolved, true);
  });

  it("requires a US state", () => {
    const resolved = resolveGoogleMapsLocation({ countryCode: "US" });
    assert.equal("error" in resolved, true);
  });

  it("searches a whole US state when city is blank", () => {
    const resolved = resolveGoogleMapsLocation({
      countryCode: "US",
      stateCode: "TX",
    });
    assert.deepEqual(resolved, {
      locationQuery: "Texas, United States",
      countryCode: "US",
      countryLabel: "United States",
      stateCode: "TX",
      stateLabel: "Texas",
    });
  });

  it("appends city, state, and country", () => {
    const resolved = resolveGoogleMapsLocation({
      countryCode: "US",
      stateCode: "TX",
      city: "Austin, Texas",
    });
    assert.deepEqual(resolved, {
      locationQuery: "Austin, Texas, United States",
      countryCode: "US",
      countryLabel: "United States",
      stateCode: "TX",
      stateLabel: "Texas",
    });
  });
});
