import { ensureCoachRowForUser } from "@/lib/booking/bookingService";
import {
  isSupportCallHostSlug,
  type SupportCallHostSlug,
} from "@/lib/support/supportCallHosts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CoachAuthUser = {
  userId: string;
  role: string;
};

/**
 * Resolve which coach's calendars / Google connection to load/save.
 * - Default: signed-in coach (or admin acting as self).
 * - Admin + x-impersonate-coach-id: that coach (view-as).
 * - Admin + forSlug: support-call host (zander / pam).
 */
export async function resolveCoachTarget(input: {
  auth: CoachAuthUser;
  forSlug: string | null | undefined;
  impersonateCoachId?: string | null;
}): Promise<
  | { ok: true; coach: { id: string; slug: string }; isSelf: boolean }
  | { ok: false; error: string; status: number }
> {
  const signedIn = await ensureCoachRowForUser(input.auth.userId);
  const impersonateId = (input.impersonateCoachId ?? "").trim();

  // View-as takes precedence over forSlug when both are present.
  if (input.auth.role === "admin" && impersonateId) {
    const { data: coach } = await supabaseAdmin
      .from("coaches")
      .select("id, slug")
      .eq("id", impersonateId)
      .maybeSingle();

    if (!coach?.id || !(coach.slug as string | null)?.trim()) {
      return { ok: false, error: "Coach not found.", status: 404 };
    }

    return {
      ok: true,
      coach: {
        id: coach.id as string,
        slug: (coach.slug as string).trim(),
      },
      // OAuth connect/disconnect only for the signed-in user's own row.
      isSelf: coach.id === signedIn.id,
    };
  }

  const raw = (input.forSlug ?? "").trim().toLowerCase();

  if (!raw || raw === signedIn.slug.toLowerCase()) {
    return { ok: true, coach: signedIn, isSelf: true };
  }

  if (input.auth.role !== "admin") {
    return { ok: false, error: "Not authorized.", status: 403 };
  }

  if (!isSupportCallHostSlug(raw)) {
    return {
      ok: false,
      error: "Only support-call hosts can be managed here.",
      status: 400,
    };
  }

  const { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("id, slug")
    .eq("slug", raw as SupportCallHostSlug)
    .maybeSingle();

  if (!coach?.id || !(coach.slug as string | null)?.trim()) {
    return { ok: false, error: "Host not found.", status: 404 };
  }

  return {
    ok: true,
    coach: {
      id: coach.id as string,
      slug: (coach.slug as string).trim(),
    },
    isSelf: coach.id === signedIn.id,
  };
}

export async function requireCoachOrAdmin(request: Request): Promise<
  | { error: string; userId: null; role: null; impersonateCoachId: null }
  | {
      error: null;
      userId: string;
      role: string;
      impersonateCoachId: string | null;
    }
> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!token) {
    return {
      error: "Missing access token.",
      userId: null,
      role: null,
      impersonateCoachId: null,
    };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return {
      error: "Invalid access token.",
      userId: null,
      role: null,
      impersonateCoachId: null,
    };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return {
      error: "Not authorized.",
      userId: null,
      role: null,
      impersonateCoachId: null,
    };
  }

  const impersonateCoachId =
    profile.role === "admin"
      ? request.headers.get("x-impersonate-coach-id")?.trim() || null
      : null;

  return {
    error: null,
    userId: user.id as string,
    role: profile.role as string,
    impersonateCoachId,
  };
}
