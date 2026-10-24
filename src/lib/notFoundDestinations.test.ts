import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bestGuessDestination, destinationsForRole } from "./notFoundDestinations";

describe("bestGuessDestination", () => {
  const coach = destinationsForRole("coach");

  it("matches the most specific word in the path", () => {
    assert.equal(bestGuessDestination("/coach/clients/scripts", coach)?.label, "Get Clients");
    assert.equal(bestGuessDestination("/coach/blueprint/old-page", coach)?.label, "My Blueprint");
  });

  it("can suggest places that are not in the list", () => {
    assert.equal(bestGuessDestination("/coach/settings/billing-v2", coach)?.label, "Settings");
  });

  it("returns null when nothing matches", () => {
    assert.equal(bestGuessDestination("/xyz/qwerty", coach), null);
  });

  it("keeps clients inside the client portal", () => {
    const guess = bestGuessDestination("/coach/playbooks", destinationsForRole("client"));
    assert.equal(guess?.href, "/client/playbooks");
  });

  it("sends admins to admin pages", () => {
    const guess = bestGuessDestination("/admin/roadmap-old", destinationsForRole("admin"));
    assert.equal(guess?.href, "/admin/roadmap");
  });
});
