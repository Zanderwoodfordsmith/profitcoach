import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isGoogleSearchDirectoryHost,
  limitGoogleSearchResults,
  mapGoogleSearchDatasetItems,
} from "./mapResultsToPool";
import { buildGoogleSearchQueries } from "./searchTerms";

describe("map Google Search dataset", () => {
  it("keeps a business site and the nested person, and drops directories", () => {
    const results = mapGoogleSearchDatasetItems([
      {
        searchQuery: { term: "dentists in Manchester, United Kingdom" },
        organicResults: [
          {
            title: "Kim's Island | Family dentist",
            url: "https://www.kimsdental.co.uk/contact",
            description: "Private dentist in Manchester.",
            position: 1,
            leadsEnrichment: [
              {
                fullName: "Kim Chen",
                jobTitle: "Owner",
                linkedinProfile: "https://www.linkedin.com/in/kim-chen",
                email: "kim@kimsdental.co.uk",
                phoneNumber: "+44 161 496 0000",
              },
            ],
          },
          {
            title: "Top 10 dentists in Manchester - Yelp",
            url: "https://www.yelp.co.uk/search?find_desc=dentists",
            position: 2,
          },
          {
            title: "Dentists near me",
            url: "https://www.google.com/search?q=dentists",
            position: 3,
          },
        ],
      },
    ]);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.company, "Kim's Island");
    assert.equal(results[0]?.host, "kimsdental.co.uk");
    assert.equal(results[0]?.lead?.fullName, "Kim Chen");
    assert.equal(results[0]?.lead?.email, "kim@kimsdental.co.uk");
    assert.equal(
      results[0]?.lead?.linkedinUrl,
      "https://www.linkedin.com/in/kim-chen/"
    );
    assert.equal(results[0]?.query, "dentists in Manchester, United Kingdom");
  });

  it("reads a flattened organic row and skips a second page on the same site", () => {
    const results = limitGoogleSearchResults(
      mapGoogleSearchDatasetItems([
        {
          type: "organic",
          title: "Acme Plumbing",
          url: "https://acmeplumbing.example/services",
          position: 4,
          searchQuery: { term: "plumbers in Leeds" },
        },
        {
          type: "organic",
          title: "Acme Plumbing - About",
          url: "https://www.acmeplumbing.example/about",
          position: 8,
        },
      ]),
      100
    );
    assert.equal(results.length, 1);
    assert.equal(results[0]?.company, "Acme Plumbing");
    assert.equal(isGoogleSearchDirectoryHost("maps.google.com"), true);
    assert.equal(isGoogleSearchDirectoryHost("acmeplumbing.example"), false);
  });
});

describe("Google Search queries", () => {
  it("adds the place once", () => {
    assert.deepEqual(
      buildGoogleSearchQueries(
        ["dentists", "dentists in Manchester, United Kingdom"],
        "Manchester, United Kingdom"
      ),
      ["dentists in Manchester, United Kingdom"]
    );
  });
});
