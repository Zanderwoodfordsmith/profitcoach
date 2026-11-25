import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CallPage } from "@/components/callPage/CallPage";
import { loadCoachBySlug, loadCoachCalendarBySlug } from "@/lib/booking/bookingService";
import { parseCallPage } from "@/lib/callPage/content";
import { callPagesLive } from "@/lib/callPage/live";
import { supabaseAdmin } from "@/lib/supabaseAdmin";


type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ view?: string }> };

async function load(slugParam: string) {
  const slug = (slugParam ?? "").trim().toLowerCase();
  const coach = slug ? await loadCoachBySlug(slug) : null;
  if (!coach) return null;
  const calendar = await loadCoachCalendarBySlug(coach.id, "discovery");
  if (!calendar || !calendar.is_enabled || !calendar.is_public) return null;
  const [{ data: profile }, { data: pageRow }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, first_name, avatar_url, directory_summary")
      .eq("id", coach.id)
      .maybeSingle(),
    supabaseAdmin.from("coach_calendars").select("page").eq("id", calendar.id).maybeSingle(),
  ]);
  const fullName = (profile?.full_name as string | null)?.trim() || coach.displayName;
  const firstName = (profile?.first_name as string | null)?.trim() || fullName.split(/\s+/)[0];
  const sales = (pageRow?.page as { sales?: unknown } | null)?.sales;
  const facts = { firstName, callName: calendar.name, minutes: calendar.meeting_duration_minutes };
  return { coach, calendar, profile, fullName, firstName, sales, facts };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!callPagesLive()) return {};
  const loaded = await load((await params).slug);
  if (!loaded) return {};
  const content = parseCallPage(loaded.sales, loaded.facts);
  return {
    title: `The ${loaded.calendar.name} | ${loaded.coach.displayName}`,
    description: content.hero.lede.slice(0, 160),
    robots: { index: false },
  };
}

export default async function CoachCallPage({ params, searchParams }: Params) {
  if (!callPagesLive()) notFound();
  const loaded = await load((await params).slug);
  if (!loaded) notFound();
  const forceLive = (await searchParams).view === "live";
  const { coach, calendar, profile, firstName, sales, facts } = loaded;

  return (
    <CallPage
      coach={{
        slug: coach.slug,
        name: coach.displayName,
        firstName,
        photoUrl: (profile?.avatar_url as string | null) || null,
        summary:
          ((profile?.directory_summary as string | null) ?? "")
            .replace(/\s*https?:\/\/\S+/g, "")
            .trim() || null,
      }}
      call={{ slug: calendar.slug, name: calendar.name, minutes: calendar.meeting_duration_minutes }}
      initial={parseCallPage(sales, facts)}
      hasSaved={Boolean(sales)}
      forceLive={forceLive}
    />
  );
}
