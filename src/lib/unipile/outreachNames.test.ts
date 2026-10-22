import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  outreachCompanyName,
  outreachFirstName,
  outreachLastName,
} from "./outreachNames";
import { buildMessageBody } from "./campaigns";

describe("outreachFirstName", () => {
  it("keeps only the first name when they typed their full name", () => {
    assert.equal(outreachFirstName("John Smith"), "John");
    assert.equal(outreachFirstName("  Sarah   Chen "), "Sarah");
  });

  it("drops titles", () => {
    assert.equal(outreachFirstName("Mr John Smith"), "John");
    assert.equal(outreachFirstName("Dr. Sarah"), "Sarah");
    assert.equal(outreachFirstName("Mrs. Jane"), "Jane");
  });

  it("drops letters and notes after the name", () => {
    assert.equal(outreachFirstName("John, MBA"), "John");
    assert.equal(outreachFirstName("John Smith MBA FCA"), "John");
    assert.equal(outreachFirstName("Sarah (BSc Hons)"), "Sarah");
    assert.equal(outreachFirstName("Sarah, BA (Hons)"), "Sarah");
    assert.equal(outreachFirstName("Gary | Business Coach"), "Gary");
    assert.equal(outreachFirstName("Gary - Growth Expert"), "Gary");
  });

  it("drops emoji", () => {
    assert.equal(outreachFirstName("John 🚀"), "John");
    assert.equal(outreachFirstName("🌟Sarah"), "Sarah");
  });

  it("fixes all-caps and all-lower names", () => {
    assert.equal(outreachFirstName("JOHN"), "John");
    assert.equal(outreachFirstName("john"), "John");
    assert.equal(outreachFirstName("JEAN-PAUL"), "Jean-Paul");
  });

  it("leaves names that are already written with care", () => {
    assert.equal(outreachFirstName("McKenzie"), "McKenzie");
    assert.equal(outreachFirstName("DeShawn"), "DeShawn");
    assert.equal(outreachFirstName("AJ"), "AJ");
    assert.equal(outreachFirstName("Anne-Marie"), "Anne-Marie");
    assert.equal(outreachFirstName("Zoë"), "Zoë");
  });

  it("returns nothing for nothing", () => {
    assert.equal(outreachFirstName(null), "");
    assert.equal(outreachFirstName("   "), "");
    assert.equal(outreachFirstName("Mr"), "");
  });
});

describe("outreachCompanyName", () => {
  it("drops Ltd, Limited, PLC and friends", () => {
    assert.equal(outreachCompanyName("Acme Plumbing Ltd"), "Acme Plumbing");
    assert.equal(outreachCompanyName("Acme Plumbing Ltd."), "Acme Plumbing");
    assert.equal(outreachCompanyName("Acme Plumbing LTD"), "Acme Plumbing");
    assert.equal(outreachCompanyName("Acme Plumbing Limited"), "Acme Plumbing");
    assert.equal(outreachCompanyName("Westbury Logistics PLC"), "Westbury Logistics");
    assert.equal(outreachCompanyName("Smith & Co LLP"), "Smith & Co");
    assert.equal(outreachCompanyName("Acme, Inc."), "Acme");
  });

  it("keeps the casing they chose", () => {
    assert.equal(outreachCompanyName("KPMG LLP"), "KPMG");
    assert.equal(outreachCompanyName("BrightHR Ltd"), "BrightHR");
  });

  it("leaves names where Ltd is not an ending", () => {
    assert.equal(outreachCompanyName("Limited Edition Prints"), "Limited Edition Prints");
    assert.equal(outreachCompanyName("Ltd"), "Ltd");
  });

  it("drops emoji", () => {
    assert.equal(outreachCompanyName("Acme 🚀 Ltd"), "Acme");
  });

  it("calms all-caps names but keeps short initials", () => {
    assert.equal(
      outreachCompanyName("DATALEC PRECISION INSTALLATIONS LIMITED"),
      "Datalec Precision Installations"
    );
    assert.equal(outreachCompanyName("AJP ELECTRICAL LTD"), "AJP Electrical");
    assert.equal(outreachCompanyName("SMITH AND SONS LTD"), "Smith and Sons");
    assert.equal(outreachCompanyName("24HR ELECTRICAL"), "24hr Electrical");
  });
});

describe("outreachLastName", () => {
  it("drops letters after the surname", () => {
    assert.equal(outreachLastName("Pool B.Eng, MIET, GIFireE, MIFSM, CTSP"), "Pool");
    assert.equal(outreachLastName("Smith MBA FCA"), "Smith");
    assert.equal(outreachLastName("Smith BSc (Hons)"), "Smith");
  });

  it("keeps real surnames", () => {
    assert.equal(outreachLastName("Goodman-King"), "Goodman-King");
    assert.equal(outreachLastName("Van Der Berg"), "Van Der Berg");
    assert.equal(outreachLastName("McDonald"), "McDonald");
    assert.equal(outreachLastName("clarke"), "Clarke");
    assert.equal(outreachLastName("SMITH"), "Smith");
  });
});

describe("buildMessageBody", () => {
  it("sends the tidy names in the message", () => {
    assert.equal(
      buildMessageBody("Hi {{first_name}}, how is {{company}} doing?", {
        first_name: "Mr JOHN Smith, MBA",
        last_name: "Smith",
        company: "Acme Plumbing Ltd",
      }),
      "Hi John, how is Acme Plumbing doing?"
    );
  });
});
