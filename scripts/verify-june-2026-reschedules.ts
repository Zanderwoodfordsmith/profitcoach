import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";

loadEnvConfig(process.cwd());

import {
  COMMUNITY_CALENDAR_EVENT_SELECT,
  COMMUNITY_CALENDAR_EXCEPTION_SELECT,
} from "../src/lib/communityCalendarData";
import { expandCommunityCalendar } from "../src/lib/communityCalendarExpand";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const [eventsResult, exceptionsResult] = await Promise.all([
    supabase.from("community_calendar_events").select(COMMUNITY_CALENDAR_EVENT_SELECT),
    supabase
      .from("community_calendar_event_exceptions")
      .select(COMMUNITY_CALENDAR_EXCEPTION_SELECT),
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (exceptionsResult.error) throw exceptionsResult.error;

  const rescheduled = (exceptionsResult.data ?? []).filter(
    (e) => e.rescheduled_starts_at
  );
  console.log(`Reschedule exceptions in DB: ${rescheduled.length}`);
  for (const ex of rescheduled) {
    console.log(
      `  ${ex.event_id.slice(0, 8)}… ${ex.occurrence_start} → ${ex.rescheduled_starts_at}`
    );
  }

  const juneStart = DateTime.fromObject(
    { year: 2026, month: 6, day: 1 },
    { zone: "utc" }
  ).startOf("day");
  const juneEnd = DateTime.fromObject(
    { year: 2026, month: 7, day: 15 },
    { zone: "utc" }
  ).endOf("day");

  const withoutRescheduleCols = (exceptionsResult.data ?? []).map((ex) => ({
    ...ex,
    rescheduled_starts_at: null,
    rescheduled_ends_at: null,
  }));

  const expanded = expandCommunityCalendar(
    eventsResult.data ?? [],
    juneStart,
    juneEnd,
    exceptionsResult.data ?? []
  );
  const without = expandCommunityCalendar(
    eventsResult.data ?? [],
    juneStart,
    juneEnd,
    withoutRescheduleCols
  );

  function juneWedLabels(
    occs: ReturnType<typeof expandCommunityCalendar>
  ): string[] {
    return occs
      .filter((o) => {
        const d = DateTime.fromISO(o.startsAtIso, { zone: "utc" }).setZone(
          o.display_timezone
        );
        return (
          (d.year === 2026 && d.month === 6 && d.weekday === 3) ||
          (d.year === 2026 && d.month === 7 && d.day === 1)
        );
      })
      .map((o) => {
        const d = DateTime.fromISO(o.startsAtIso, { zone: "utc" }).setZone(
          o.display_timezone
        );
        return `${d.toFormat("ccc d MMM")} — ${o.title}`;
      })
      .sort();
  }

  console.log("\nWith reschedule exceptions:");
  juneWedLabels(expanded).forEach((l) => console.log(`  ${l}`));
  console.log("\nWithout (original series):");
  juneWedLabels(without).forEach((l) => console.log(`  ${l}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
