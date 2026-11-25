import {
  CleanBookingPage,
  type BookingPageHidden,
} from "@/components/booking/CleanBookingPage";
import { StartApplyPanelNative } from "@/components/booking/StartApplyPanelNative";
import { BCA_BOOKING_SLUGS } from "@/lib/booking/bookCallQualify";
import {
  loadCoachBySlug,
  loadCoachCalendarBySlug,
} from "@/lib/booking/bookingService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function PublicBookCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; calendarSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { slug, calendarSlug } = await params;
  const forceLive = (await searchParams).view === "live";
  const clean = (slug ?? "").trim().toLowerCase();
  const cal = (calendarSlug ?? "").trim().toLowerCase() || "discovery";
  const isBca = BCA_BOOKING_SLUGS.has(clean);
  const ownerQuestions = cal === "discovery" && !isBca;

  const coach = isBca ? null : await loadCoachBySlug(clean);
  const calendar = coach ? await loadCoachCalendarBySlug(coach.id, cal) : null;

  // A coach's calendar: their own light booking page.
  if (coach && calendar) {
    const [
      { data: profile },
      { data: auth },
      { data: whatsappRows },
      { data: pageRow },
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("avatar_url, directory_summary, phone")
        .eq("id", coach.id)
        .maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(coach.id),
      // The coach's connected WhatsApp; its name is the number.
      supabaseAdmin
        .from("linkedin_outreach_accounts")
        .select("display_name, status")
        .eq("coach_id", coach.id)
        .eq("provider", "WHATSAPP"),
      supabaseAdmin
        .from("coach_calendars")
        .select("page")
        .eq("id", calendar.id)
        .maybeSingle(),
    ]);
    const hidden =
      (pageRow?.page as { hidden?: BookingPageHidden } | null)?.hidden ?? {};
    const whatsappRow =
      (whatsappRows ?? []).find(
        (r) => String(r.status).toUpperCase() === "OK",
      ) ?? (whatsappRows ?? [])[0];
    const whatsappDigits = String(whatsappRow?.display_name ?? "").replace(
      /\D/g,
      "",
    );
    return (
      <CleanBookingPage
        slug={clean}
        calendarSlug={cal}
        intent={ownerQuestions ? "owner" : "discovery"}
        hidden={hidden}
        forceLive={forceLive}
        coach={{
          name: coach.displayName,
          // Web addresses read badly in one line; the page is about the call.
          summary:
            ((profile?.directory_summary as string | null) ?? "")
              .replace(/\s*https?:\/\/\S+/g, "")
              .trim() || null,
          photoUrl: (profile?.avatar_url as string | null) || null,
          phone: (profile?.phone as string | null)?.trim() || null,
          email: auth?.user?.email?.trim() || null,
          whatsapp: whatsappDigits.length >= 8 ? whatsappDigits : null,
        }}
        call={{
          name: calendar.name,
          description: calendar.description,
          minutes: calendar.meeting_duration_minutes,
          location: calendar.location_mode,
        }}
      />
    );
  }

  // BCA's own pages (and unknown links) keep the original panel.
  return (
    <div className="flex min-h-screen items-start justify-center bg-[#061018] px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-[920px]">
        <StartApplyPanelNative
          variant="modal"
          enableLeadCapture
          intent={ownerQuestions ? "owner" : "discovery"}
          slug={clean || "unknown"}
          calendarSlug={cal}
        />
      </div>
    </div>
  );
}
