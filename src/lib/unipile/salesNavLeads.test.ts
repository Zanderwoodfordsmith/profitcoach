import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapUnipileSearchItem } from "@/lib/unipile/salesNavLeads";

describe("mapUnipileSearchItem", () => {
  it("maps Unipile summary into about ahead of role description", () => {
    const lead = mapUnipileSearchItem({
      first_name: "Alistair",
      last_name: "Kane",
      name: "Alistair Kane",
      public_profile_url: "https://www.linkedin.com/in/alistair-kane",
      headline: "Director",
      summary:
        "Self employed electrician based in London with 10 years experience.",
      current_positions: [
        {
          role: "Director",
          company: "A Kane Electrical",
          description: "Domestic and commercial electrical work.",
        },
      ],
    });

    assert.ok(lead);
    assert.equal(lead!.headline, "Director");
    assert.equal(
      lead!.about,
      "Self employed electrician based in London with 10 years experience."
    );
    assert.equal(lead!.jobTitle, "Director");
    assert.equal(lead!.company, "A Kane Electrical");
  });

  it("falls back to role description when summary is missing", () => {
    const lead = mapUnipileSearchItem({
      name: "Jane Doe",
      public_identifier: "jane-doe",
      headline: "Owner",
      current_positions: [
        {
          role: "Owner",
          company: "Jane Electric",
          description: "Family-run electrical contractor.",
        },
      ],
    });

    assert.ok(lead);
    assert.equal(lead!.about, "Family-run electrical contractor.");
  });

  it("falls back to headline when no about-like fields exist", () => {
    const lead = mapUnipileSearchItem({
      name: "Pat Lee",
      public_identifier: "pat-lee",
      headline: "Managing Director",
      current_positions: [{ role: "MD", company: "Lee Ltd" }],
    });

    assert.ok(lead);
    assert.equal(lead!.about, "Managing Director");
  });
});
