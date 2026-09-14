import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatGoogleMapsSearchLabel,
  formatGoogleMapsSplitHint,
  googleMapsPlacesPerSearch,
  joinGoogleMapsSearchTerms,
  parseGoogleMapsSearchTerms,
} from "./searchTerms";

describe("parse Google Maps search terms", () => {
  it("keeps a single business type", () => {
    assert.deepEqual(parseGoogleMapsSearchTerms("dentists"), ["dentists"]);
  });

  it("splits commas and extra rows, drops short and duplicate terms", () => {
    assert.deepEqual(
      parseGoogleMapsSearchTerms(["dentists,  smile", "Dentists", "orthodontist", "x"]),
      ["dentists", "smile", "orthodontist"]
    );
  });

  it("caps at five distinct terms", () => {
    assert.deepEqual(
      parseGoogleMapsSearchTerms("dentists, clinics, gyms, plumbers, cafes, bars"),
      ["dentists", "clinics", "gyms", "plumbers", "cafes"]
    );
  });

  it("joins terms for storage", () => {
    assert.equal(
      joinGoogleMapsSearchTerms(["dentists", "orthodontist"]),
      "dentists, orthodontist"
    );
  });

  it("labels longer lists without dumping every term", () => {
    assert.equal(
      formatGoogleMapsSearchLabel(["dentists", "orthodontist", "dental clinic"]),
      "dentists · orthodontist +1"
    );
  });
});

describe("Google Maps place split", () => {
  it("gives the full cap to one search", () => {
    assert.equal(googleMapsPlacesPerSearch(100, 1), 100);
  });

  it("splits the cap so the first search cannot take it all", () => {
    assert.equal(googleMapsPlacesPerSearch(100, 2), 50);
    assert.equal(googleMapsPlacesPerSearch(100, 3), 34);
  });

  it("explains the split for the import form", () => {
    assert.equal(
      formatGoogleMapsSplitHint(100, 2),
      "Up to 100 businesses total, split across 2 searches (about 50 each). Same listing is only added once."
    );
    assert.equal(formatGoogleMapsSplitHint(100, 1), null);
  });
});
