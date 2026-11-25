import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";
import { loadCoachBySlug, loadCoachCalendarBySlug } from "@/lib/booking/bookingService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Who may edit a coach's first-call page (/call/[slug]): the coach, or an admin.
 * The page's words live on the coach's discovery calendar.
 */
export async function callPageEditor(request: Request) {
  const slug = (new URL(request.url).searchParams.get("slug") ?? "").trim().toLowerCase();
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { error: "Sign in to edit this page.", status: 401 } as const;
  const user = await verifyAccessToken(token);
  if (!user) return { error: "Sign in to edit this page.", status: 401 } as const;

  const coach = slug ? await loadCoachBySlug(slug) : null;
  const calendar = coach ? await loadCoachCalendarBySlug(coach.id, "discovery") : null;
  if (!coach || !calendar) return { error: "Page not found.", status: 404 } as const;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (coach.id !== user.id && profile?.role !== "admin") {
    return { error: "You can only edit your own page.", status: 403 } as const;
  }
  return { coach, calendar, actingAsAdmin: coach.id !== user.id } as const;
}
