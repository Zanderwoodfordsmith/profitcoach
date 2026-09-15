import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hostedAuthMailCalendarScopes,
  UNIPILE_GOOGLE_MAIL_AND_CALENDAR_SCOPES,
  UNIPILE_MICROSOFT_MAIL_AND_CALENDAR_SCOPES,
} from "./hostedAuthScopes";

describe("hostedAuthMailCalendarScopes", () => {
  it("requests Gmail and Calendar together for Google", () => {
    const scopes = hostedAuthMailCalendarScopes("GOOGLE");
    assert.equal(scopes.google_scopes, UNIPILE_GOOGLE_MAIL_AND_CALENDAR_SCOPES);
    assert.equal(scopes.microsoft_scopes, undefined);
    assert.match(
      scopes.google_scopes ?? "",
      /https:\/\/www\.googleapis\.com\/auth\/gmail\.send/
    );
    assert.match(
      scopes.google_scopes ?? "",
      /https:\/\/www\.googleapis\.com\/auth\/calendar\.events/
    );
  });

  it("requests Outlook mail and Calendar together", () => {
    const scopes = hostedAuthMailCalendarScopes("OUTLOOK");
    assert.equal(
      scopes.microsoft_scopes,
      UNIPILE_MICROSOFT_MAIL_AND_CALENDAR_SCOPES
    );
    assert.equal(scopes.google_scopes, undefined);
    assert.match(scopes.microsoft_scopes ?? "", /Calendars\.ReadWrite/);
  });

  it("does not attach mail/calendar scopes to LinkedIn", () => {
    assert.deepEqual(hostedAuthMailCalendarScopes("LINKEDIN"), {});
  });
});
