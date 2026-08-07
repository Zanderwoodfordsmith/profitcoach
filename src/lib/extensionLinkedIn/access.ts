import {
  coachHasFeature,
  resolveCoachAccessForUserId,
  type CoachAccessSnapshot,
} from "@/lib/coachAccess/resolveCoachAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_BETA_EMAILS = ["zander@businesscoachacademy.com"];

/**
 * Soft-launch allowlist for LinkedIn extension APIs.
 * - Env unset → beta default (Zander only).
 * - `*` or `all` or explicit empty → all entitled coaches.
 * - Comma-separated emails → those only.
 */
export function parseExtensionLinkedInAllowedEmails():
  | { mode: "open" }
  | { mode: "allowlist"; emails: string[] } {
  const raw = process.env.EXTENSION_LINKEDIN_ALLOWED_EMAILS;
  if (raw === undefined) {
    return { mode: "allowlist", emails: DEFAULT_BETA_EMAILS };
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "*" || trimmed.toLowerCase() === "all") {
    return { mode: "open" };
  }
  return {
    mode: "allowlist",
    emails: trimmed
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  };
}

export function isExtensionLinkedInAllowedEmail(
  email: string | null | undefined
): boolean {
  const parsed = parseExtensionLinkedInAllowedEmails();
  if (parsed.mode === "open") return true;
  if (!email) return false;
  return parsed.emails.includes(email.trim().toLowerCase());
}

export type ExtensionLinkedInAuthError =
  | "Missing access token."
  | "Invalid access token."
  | "Not authorized."
  | "Pick a coach to act as."
  | "Feature not available for your access tier."
  | "Extension not enabled for this account yet.";

export type ExtensionCoachOption = {
  id: string;
  name: string;
  slug: string | null;
};

export type ExtensionLinkedInAuth =
  | {
      error: ExtensionLinkedInAuthError;
      status: 401 | 403;
      userId: null;
      access: null;
      email: string | null;
      role: "coach" | "admin" | null;
      coaches: ExtensionCoachOption[] | null;
    }
  | {
      error: null;
      status: null;
      userId: string;
      access: CoachAccessSnapshot;
      email: string | null;
      role: "coach" | "admin";
      coaches: ExtensionCoachOption[] | null;
    };

async function loadAdminCoachOptions(): Promise<ExtensionCoachOption[]> {
  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select("id, slug, profiles!inner(full_name, coach_business_name)")
    .order("slug", { ascending: true })
    .limit(500);

  if (error || !data) return [];

  return data.map((row) => {
    const profile = row.profiles as unknown as {
      full_name?: string | null;
      coach_business_name?: string | null;
    } | null;
    const name =
      profile?.full_name?.trim() ||
      profile?.coach_business_name?.trim() ||
      (row.slug as string) ||
      (row.id as string);
    return {
      id: row.id as string,
      name,
      slug: (row.slug as string | null) ?? null,
    };
  });
}

async function coachRowExists(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data?.id);
}

/**
 * Resolve the coach id an admin should act as for extension APIs.
 * Priority: header → EXTENSION_LINKEDIN_DEFAULT_COACH_ID → admin's own coach row.
 */
async function resolveAdminActingCoachId(
  request: Request,
  adminUserId: string
): Promise<string | null> {
  const headerId = request.headers.get("x-impersonate-coach-id")?.trim();
  if (headerId) {
    if (await coachRowExists(headerId)) return headerId;
    return null;
  }

  const envDefault = process.env.EXTENSION_LINKEDIN_DEFAULT_COACH_ID?.trim();
  if (envDefault && (await coachRowExists(envDefault))) {
    return envDefault;
  }

  if (await coachRowExists(adminUserId)) {
    return adminUserId;
  }

  return null;
}

/**
 * Coach or admin-acting-as-coach + nav.marketing + soft-launch allowlist.
 * Admins must act as a coach (header, env default, or their own coach row).
 */
export async function requireExtensionLinkedInAccess(
  request: Request
): Promise<ExtensionLinkedInAuth> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: "Missing access token.",
      status: 401,
      userId: null,
      access: null,
      email: null,
      role: null,
      coaches: null,
    };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return {
      error: "Invalid access token.",
      status: 401,
      userId: null,
      access: null,
      email: null,
      role: null,
      coaches: null,
    };
  }

  const email = user.email?.trim().toLowerCase() ?? null;
  if (!isExtensionLinkedInAllowedEmail(email)) {
    return {
      error: "Extension not enabled for this account yet.",
      status: 403,
      userId: null,
      access: null,
      email: null,
      role: null,
      coaches: null,
    };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role;
  if (role !== "coach" && role !== "admin") {
    return {
      error: "Not authorized.",
      status: 403,
      userId: null,
      access: null,
      email: null,
      role: null,
      coaches: null,
    };
  }

  let coachId = user.id;
  let coaches: ExtensionCoachOption[] | null = null;

  if (role === "admin") {
    coaches = await loadAdminCoachOptions();
    const actingId = await resolveAdminActingCoachId(request, user.id);
    if (!actingId) {
      return {
        error: "Pick a coach to act as.",
        status: 403,
        userId: null,
        access: null,
        email,
        role: null,
        coaches,
      };
    }
    coachId = actingId;
  }

  const access = await resolveCoachAccessForUserId(coachId);
  if (!coachHasFeature(access, "nav.marketing")) {
    return {
      error: "Feature not available for your access tier.",
      status: 403,
      userId: null,
      access: null,
      email,
      role: null,
      coaches,
    };
  }

  return {
    error: null,
    status: null,
    userId: coachId,
    access,
    email,
    role,
    coaches,
  };
}
