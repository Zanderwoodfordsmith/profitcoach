import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePastedClients, ukDateToIso } from "./paste";

describe("pasted client rows", () => {
  it("reads a sheet copied as tabs, with UK dates and our header wording", () => {
    const text = "Name\tBusiness\tJoined (dd/mm/yyyy)\tMonthly fee\tTurnover\tHow they found you\tFit 1-5\nTom Smith\tCASS Scaffolding\t03/02/2025\t£2,000\t£1m to £2m\tReferral\t5\n\tNo name Ltd\t\t\t\t\t";
    const out = parsePastedClients(text);
    assert.equal(out.error, null);
    assert.deepEqual(out.rows, [
      { fullName: "Tom Smith", businessName: "CASS Scaffolding", joinedOn: "2025-02-03", feeAmount: "£2,000", revenueBand: "£1m to £2m", source: "Referral", fit: "5" },
    ]);
  });

  it("reads CSV with quotes and reports columns it doesn't know", () => {
    const out = parsePastedClients('name,company,favourite colour\n"Smith, Jo","Acme, Ltd",blue');
    assert.deepEqual(out.rows, [{ fullName: "Smith, Jo", businessName: "Acme, Ltd" }]);
    assert.deepEqual(out.unknownHeaders, ["favourite colour"]);
  });

  it("needs a name column", () => {
    assert.match(parsePastedClients("company\nAcme").error ?? "", /Name/);
    assert.equal(ukDateToIso("2025-02-03"), "2025-02-03");
  });
});
