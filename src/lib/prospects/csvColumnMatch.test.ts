import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCsvColumnMap,
  guessCsvColumnMap,
  readCsvForMatching,
} from "./csvColumnMatch";
import { composeImportedPlace } from "@/lib/pool/importedPlace";

describe("csv column match", () => {
  it("guesses email address, town, and website and leaves unknown columns skipped", () => {
    const headers = ["Contact", "Email Address", "Town", "Website", "Notes"];
    assert.deepEqual(guessCsvColumnMap(headers), [
      "skip",
      "email",
      "city",
      "website",
      "skip",
    ]);
  });

  it("prefers the longer header when email address could also look like address", () => {
    assert.deepEqual(guessCsvColumnMap(["Email Address"]), ["email"]);
    assert.deepEqual(guessCsvColumnMap(["Street Address"]), ["address"]);
  });

  it("applies a coach's mapping", () => {
    const text = "Person,Mail,Area\nJane Example,jane@example.com,Leeds\n";
    const preview = readCsvForMatching(text);
    assert.equal(preview.rowCount, 1);
    const rows = applyCsvColumnMap(text, ["name", "email", "city"]);
    assert.equal(rows[0]?.fullName, "Jane Example");
    assert.equal(rows[0]?.email, "jane@example.com");
    assert.equal(rows[0]?.city, "Leeds");
    assert.equal(rows[0]?.linkedinUrl, null);
  });
});

describe("composeImportedPlace", () => {
  it("folds town and postcode into location", () => {
    assert.deepEqual(
      composeImportedPlace({ city: "Leeds", postcode: "LS1 4AP" }),
      { location: "Leeds, LS1 4AP", address: null }
    );
  });
});
