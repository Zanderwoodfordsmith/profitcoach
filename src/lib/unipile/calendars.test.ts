import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calendarBusyDisplayTitle,
  isOwnedUnipileCalendar,
  pickDefaultUnipileCalendar,
  type UnipileCalendar,
} from "./calendars";

function cal(partial: Partial<UnipileCalendar> & { id: string }): UnipileCalendar {
  return {
    name: partial.name ?? partial.id,
    is_read_only: false,
    is_owned_by_user: true,
    ...partial,
  };
}

describe("unipile calendar isolation", () => {
  it("never defaults to a shared calendar even if it is first", () => {
    const picked = pickDefaultUnipileCalendar([
      cal({
        id: "hillary-shared",
        name: "Hillary McNair",
        is_owned_by_user: false,
        access_role: "writer",
      }),
      cal({
        id: "mine",
        name: "My calendar",
        is_owned_by_user: true,
        is_primary: true,
        access_role: "owner",
      }),
    ]);
    assert.equal(picked?.id, "mine");
  });

  it("falls back to the account primary when ownership flags are missing", () => {
    const picked = pickDefaultUnipileCalendar([
      cal({
        id: "shared",
        name: "Hilary McNair",
        is_owned_by_user: false,
        access_role: "writer",
      }),
      cal({
        id: "primary",
        name: "Primary",
        is_owned_by_user: false,
        is_primary: true,
        access_role: "writer",
      }),
    ]);
    assert.equal(picked?.id, "primary");
  });

  it("returns null when only other people's calendars are present", () => {
    const picked = pickDefaultUnipileCalendar([
      cal({
        id: "someone-else",
        is_owned_by_user: false,
        access_role: "reader",
        is_read_only: true,
      }),
    ]);
    assert.equal(picked, null);
  });

  it("treats explicit non-owned calendars as not owned", () => {
    assert.equal(
      isOwnedUnipileCalendar(
        cal({
          id: "shared",
          is_owned_by_user: false,
          is_primary: false,
          access_role: "writer",
        })
      ),
      false
    );
  });

  it("redacts titles from calendars this user does not own", () => {
    assert.equal(
      calendarBusyDisplayTitle("30 minutes with Hillary McNair", false),
      "Busy"
    );
    assert.equal(
      calendarBusyDisplayTitle("30 minutes with Hillary McNair", true),
      "30 minutes with Hillary McNair"
    );
  });
});
