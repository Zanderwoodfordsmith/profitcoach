import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { summarizeCallHours } from "@/components/practice/document/SetupPanels";

describe("call hour summary", () => {
  it("groups weekdays that share the same times", () => {
    assert.equal(
      summarizeCallHours([
        { weekday: 1, start_time: "09:00", end_time: "17:00" },
        { weekday: 2, start_time: "09:00", end_time: "17:00" },
        { weekday: 3, start_time: "09:00", end_time: "17:00" },
        { weekday: 4, start_time: "09:00", end_time: "17:00" },
        { weekday: 5, start_time: "09:00", end_time: "17:00" },
      ]),
      "Mon to Fri, 09:00 to 17:00"
    );
  });

  it("keeps a different day on its own", () => {
    assert.equal(
      summarizeCallHours([
        { weekday: 1, start_time: "09:00", end_time: "12:00" },
        { weekday: 3, start_time: "18:00", end_time: "20:00" },
      ]),
      "Mon, 09:00 to 12:00; Wed, 18:00 to 20:00"
    );
  });

  it("lists more than one slot in a day, in time order", () => {
    assert.equal(
      summarizeCallHours([
        { weekday: 2, start_time: "15:00", end_time: "16:00" },
        { weekday: 2, start_time: "09:00", end_time: "11:00" },
        { weekday: 3, start_time: "09:00", end_time: "11:00" },
        { weekday: 3, start_time: "15:00", end_time: "16:00" },
      ]),
      "Tue to Wed, 09:00 to 11:00 and 15:00 to 16:00"
    );
  });
});
