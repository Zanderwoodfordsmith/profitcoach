import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPoolPeopleInput } from "./mapPoolPeopleInput";

describe("mapPoolPeopleInput", () => {
  it("keeps people keyed on email when there is no LinkedIn URL", () => {
    const people = mapPoolPeopleInput(
      [
        {
          full_name: "Ada Lovelace",
          company: "Analytical Engines",
          email: "Ada@Engine.COM",
        },
        { full_name: "No Identity" },
        { linkedin_url: "https://linkedin.com/in/ada", email: "other@x.com" },
      ],
      "manual"
    );
    assert.equal(people.length, 3);
    assert.equal(people[0]?.email, "Ada@Engine.COM");
    assert.equal(people[0]?.first_name, "Ada");
    assert.equal(people[1]?.full_name, "No Identity");
    assert.equal(people[2]?.linkedin_url, "https://linkedin.com/in/ada");
  });

  it("drops duplicate identity keys in the same payload", () => {
    const people = mapPoolPeopleInput(
      [
        { email: "owner@shop.com", full_name: "Pat" },
        { email: "OWNER@shop.com", full_name: "Patricia" },
      ],
      "manual"
    );
    assert.equal(people.length, 1);
    assert.equal(people[0]?.full_name, "Pat");
  });
});
