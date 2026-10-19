import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conversationPersonName,
  looksLikePersonName,
  personNameFromDisplayName,
} from "./conversationDisplay";

const NOTED =
  "Farah Zahid (fixing meeting after your chat with Mohsin on LinkedIn)";

describe("conversationPersonName", () => {
  it("shows the person in front of a parenthetical note, not the email", () => {
    assert.equal(looksLikePersonName(NOTED), false);
    assert.equal(
      conversationPersonName({
        prospectFullName: NOTED,
        prospectEmail: "farah@ampverve.com",
      }),
      "Farah Zahid"
    );
  });
});

describe("personNameFromDisplayName", () => {
  const cases: Array<[string, string | null]> = [
    ["Mervyn Pilley CMgr FRSA FAIA FSAM MFB ACIAT HonFIConstM", "Mervyn Pilley"],
    ["Christopher Breiner, MSc BA Hons RICS Tech Partner", "Christopher Breiner"],
    ["Hamid reza Abootalebi Jahromi MSc MCIOB MAPM", "Hamid reza Abootalebi Jahromi"],
    ["Sethu Madhavan Wariyar MD DCH DNB MRCP FRCPCH", "Sethu Madhavan Wariyar"],
    [
      "Spencer Lee Kelly LJMU School of Built Environment BAHons ARCH, MCIAT FHEA PGCertHE",
      "Spencer Lee Kelly",
    ],
    ["Prof Elvis Otobo, PhD, CA, MCIPR, MSET, ANIPR, arpa.", "Prof Elvis Otobo"],
    ["Muhammad Sohaib Sulemani [ M.IPSA, CSHM ]", "Muhammad Sohaib Sulemani"],
    ["Myranda Love -  Fractional COO for Coaches", "Myranda Love"],
    ["Daya Naef, Attorney and Chief AI Officer", "Daya Naef"],
    ["(13) Zander Woodford-smith", "Zander Woodford-smith"],
    ["Olivia (Liv) Parkes", "Olivia Parkes"],
    ["Olly Emson -Dry Lining and Suspended Ceiling Expert", "Olly Emson"],
    ["Mary Smith-Jones Founder Coach Speaker Author Mentor", null],
    ["Andreas, Jason, Karl L E, Henrik, Alastair", "Andreas, Jason, Karl L E +2"],
    ["John McDonald", "John McDonald"],
    ["Unknown contact", null],
    ["farah@ampverve.com", null],
  ];
  for (const [raw, expected] of cases) {
    it(`reads ${JSON.stringify(raw)}`, () => {
      assert.equal(personNameFromDisplayName(raw), expected);
    });
  }

  it("shows the person, not Unknown contact, in the inbox list", () => {
    assert.equal(
      conversationPersonName({
        prospectName: "Mervyn Pilley CMgr FRSA FAIA FSAM MFB ACIAT HonFIConstM",
        channel: "linkedin",
      }),
      "Mervyn Pilley"
    );
  });
});
