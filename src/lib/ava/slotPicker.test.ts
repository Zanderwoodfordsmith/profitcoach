import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatSlotLabel, pickOfferSlots, scoreSlot } from "./slotPicker";

const TZ = "Europe/London";

// Every half hour, 8:00 to 18:00 UK time, for 8 days from a given date.
function grid(startYmd: string): { startsAt: string }[] {
  const out: { startsAt: string }[] = [];
  const base = new Date(`${startYmd}T00:00:00Z`);
  for (let day = 0; day < 8; day += 1) {
    for (let h = 8; h < 18; h += 0.5) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + day);
      // October 2026 is BST (UTC+1) until the 25th.
      d.setUTCHours(Math.floor(h) - 1, (h % 1) * 60, 0, 0);
      out.push({ startsAt: d.toISOString() });
    }
  }
  return out;
}

describe("call time offers", () => {
  it("never offers Monday mornings, Friday afternoons, weekends, lunch or under 3 hours away", () => {
    const now = new Date("2026-10-16T09:00:00Z"); // Friday 10:00 UK
    assert.equal(scoreSlot(new Date("2026-10-19T08:00:00Z"), now, TZ), null); // Mon 9:00
    assert.equal(scoreSlot(new Date("2026-10-16T13:00:00Z"), now, TZ), null); // Fri 14:00
    assert.equal(scoreSlot(new Date("2026-10-17T09:00:00Z"), now, TZ), null); // Sat
    assert.equal(scoreSlot(new Date("2026-10-20T11:45:00Z"), now, TZ), null); // Tue 12:45 lunch
    assert.equal(scoreSlot(new Date("2026-10-16T10:00:00Z"), now, TZ), null); // Fri 11:00, only 1h away
    assert.ok((scoreSlot(new Date("2026-10-20T09:30:00Z"), now, TZ) ?? 0) > 0); // Tue 10:30
  });

  it("offers two times on different days, one morning and one afternoon, mid-week", () => {
    const now = new Date("2026-10-16T09:00:00Z"); // Friday morning
    const offer = pickOfferSlots({ slots: grid("2026-10-16"), timeZone: TZ, now });
    assert.equal(offer.length, 2);
    assert.notEqual(offer[0]!.dayKey, offer[1]!.dayKey);
    assert.notEqual(offer[0]!.half, offer[1]!.half);
    for (const o of offer) {
      const wd = new Date(o.startsAt).getUTCDay();
      assert.ok(wd >= 1 && wd <= 4, `weekday ${wd}`);
    }
  });

  it("only uses times that are actually free", () => {
    const now = new Date("2026-10-19T08:00:00Z"); // Monday 9:00 UK
    const free = [{ startsAt: "2026-10-21T13:00:00Z" }]; // Wed 14:00 only
    const offer = pickOfferSlots({ slots: free, timeZone: TZ, now });
    assert.deepEqual(offer.map((o) => o.startsAt), ["2026-10-21T13:00:00.000Z"]);
    assert.equal(pickOfferSlots({ slots: [], timeZone: TZ, now }).length, 0);
  });

  it("writes times the way people say them", () => {
    const now = new Date("2026-10-19T08:00:00Z"); // Monday
    assert.equal(formatSlotLabel(new Date("2026-10-20T09:30:00Z"), TZ, now), "tomorrow at 10:30am");
    assert.equal(formatSlotLabel(new Date("2026-10-21T13:00:00Z"), TZ, now), "Wednesday at 2pm");
  });
});
