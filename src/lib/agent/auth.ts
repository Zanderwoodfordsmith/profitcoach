import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { AgentMode } from "./types";

/**
 * Who is talking to the agent, and in which mode. Admins always get admin
 * mode (any coach). Coaches get coach mode on their own account, only when
 * an admin has switched the agent on for them.
 */

export type AgentActor = {
  actorUserId: string;
  isAdmin: boolean;
  mode: AgentMode;
  /** Admin viewing as a coach: the default active coach for a new chat. */
  impersonatedCoachId: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveAgentActor(
  request: Request
): Promise<
  | { ok: true; actor: AgentActor }
  | { ok: false; status: 401 | 403; error: string; signedIn?: boolean }
> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token) return { ok: false, status: 401, error: "Missing access token." };

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401, error: "Invalid access token." };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") {
    const impersonate = request.headers.get("x-impersonate-coach-id")?.trim() ?? "";
    return {
      ok: true,
      actor: {
        actorUserId: user.id,
        isAdmin: true,
        mode: "admin",
        impersonatedCoachId: UUID_RE.test(impersonate) ? impersonate : null,
      },
    };
  }

  if (profile?.role === "coach") {
    const { data: coach } = await supabaseAdmin
      .from("coaches")
      .select("ai_agent_enabled")
      .eq("id", user.id)
      .maybeSingle();
    if (coach?.ai_agent_enabled === true) {
      return {
        ok: true,
        actor: { actorUserId: user.id, isAdmin: false, mode: "coach", impersonatedCoachId: null },
      };
    }
    return {
      ok: false,
      status: 403,
      error: "The agent is not switched on for your account yet.",
      signedIn: true,
    };
  }

  return { ok: false, status: 403, error: "Not authorized.", signedIn: true };
}

/** Coach mode may only touch the actor's own account. */
export function actorMayActOn(actor: AgentActor, coachId: string): boolean {
  return actor.isAdmin || coachId === actor.actorUserId;
}
