import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  audienceItemSourceLabel,
  displayListPersonName,
  listItemCapForKind,
  mapAudiencePeopleInput,
  MAX_POOL_ITEMS_TOTAL,
  parsePastedAudienceLines,
  planNamedListMembership,
  sortAudienceLists,
  splitPersonName,
  uniqueAudienceListCopyName,
  type AudienceListSummary,
} from "./audienceLists";

describe("audience lists", () => {
  it("parses pasted LinkedIn URLs and skips junk", () => {
    const people = parsePastedAudienceLines(
      [
        "https://www.linkedin.com/in/jane-doe/",
        "linkedin.com/in/jane-doe/",
        "not-a-url",
        "https://www.linkedin.com/in/sam-smith,Sam,Smith,Acme,Owner",
      ].join("\n")
    );
    assert.equal(people.length, 2);
    assert.equal(people[0]?.linkedin_url, "https://www.linkedin.com/in/jane-doe/");
    assert.equal(people[1]?.first_name, "Sam");
    assert.equal(people[1]?.company, "Acme");
  });

  it("maps people payloads and drops duplicates", () => {
    const people = mapAudiencePeopleInput(
      [
        {
          linkedin_url: "https://linkedin.com/in/ada",
          full_name: "Ada Lovelace",
          company: "Analytical Engines",
        },
        { linkedin_url: "https://www.linkedin.com/in/ada" },
        { linkedin_url: "https://example.com/nope" },
      ],
      "search"
    );
    assert.equal(people.length, 1);
    assert.equal(people[0]?.first_name, "Ada");
    assert.equal(people[0]?.last_name, "Lovelace");
    assert.equal(people[0]?.source, "search");
  });

  it("sorts blacklist above other lists", () => {
    const lists: AudienceListSummary[] = [
      {
        id: "a",
        name: "Owners",
        kind: "audience",
        source: "manual",
        item_count: 2,
        updated_at: "2026-01-02T00:00:00.000Z",
        created_at: null,
        from_pool_import: false,
      },
      {
        id: "b",
        name: "Blacklist",
        kind: "blacklist",
        source: "manual",
        item_count: 1,
        updated_at: "2026-01-01T00:00:00.000Z",
        created_at: null,
        from_pool_import: false,
      },
    ];
    assert.equal(sortAudienceLists(lists)[0]?.kind, "blacklist");
  });

  it("names duplicated lists with copy, then a number", () => {
    assert.equal(uniqueAudienceListCopyName("Sales Nav · 14 Sep", []), "Sales Nav · 14 Sep copy");
    assert.equal(
      uniqueAudienceListCopyName("Sales Nav · 14 Sep", [
        "Sales Nav · 14 Sep",
        "Sales Nav · 14 Sep copy",
      ]),
      "Sales Nav · 14 Sep copy 2"
    );
  });

  it("lets named lists grow as large as the pool", () => {
    assert.equal(listItemCapForKind("audience"), MAX_POOL_ITEMS_TOTAL);
    assert.equal(listItemCapForKind("blacklist"), MAX_POOL_ITEMS_TOTAL);
    assert.equal(listItemCapForKind("pool"), MAX_POOL_ITEMS_TOTAL);
  });

  it("puts people already in the pool onto a new list instead of skipping them", () => {
    const ada = { linkedin_url: "https://www.linkedin.com/in/ada/" };
    const grace = { linkedin_url: "https://www.linkedin.com/in/grace/" };
    const alreadyOnList = { linkedin_url: "https://www.linkedin.com/in/on-list/" };
    const blocked = { linkedin_url: "https://www.linkedin.com/in/blocked/" };
    const plan = planNamedListMembership({
      people: [ada, alreadyOnList, grace, blocked],
      urlsOnTarget: new Set([alreadyOnList.linkedin_url]),
      urlsInPool: new Set([ada.linkedin_url, alreadyOnList.linkedin_url]),
      blacklistedUrls: new Set([blocked.linkedin_url]),
      room: 10,
    });
    assert.deepEqual(plan.copyUrls, [ada.linkedin_url]);
    assert.deepEqual(plan.insertPeople, [grace]);
    assert.equal(plan.skipped, 1);
    assert.equal(plan.blacklisted, 1);
  });

  it("does not skip pool people when the new list still has room", () => {
    const ada = { linkedin_url: "https://www.linkedin.com/in/ada/" };
    const plan = planNamedListMembership({
      people: [ada],
      urlsOnTarget: new Set(),
      urlsInPool: new Set([ada.linkedin_url]),
      blacklistedUrls: new Set(),
      room: 1,
    });
    assert.deepEqual(plan.copyUrls, [ada.linkedin_url]);
    assert.equal(plan.insertPeople.length, 0);
    assert.equal(plan.skipped, 0);
  });

  it("labels sources and names for the table", () => {
    assert.equal(audienceItemSourceLabel("google_maps"), "Google Maps");
    assert.equal(
      displayListPersonName({ first_name: "Pat", last_name: "Lee" }),
      "Pat Lee"
    );
    assert.deepEqual(splitPersonName("Ada Lovelace Byron"), {
      first_name: "Ada",
      last_name: "Lovelace Byron",
    });
  });
});
