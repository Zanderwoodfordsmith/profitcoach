import { NextResponse } from "next/server";

import { refreshAgentContextOverrides, SKILL_ACCESS_VALUES, type SkillAccess } from "@/lib/agent/agentOverrides";
import { loadAvaCatalog } from "@/lib/agent/avaCatalog";
import { defaultSkillAccess, loadCapabilities } from "@/lib/agent/context";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Who can use one Ava skill. Picking the default removes the setting, so the
 * skill follows its frontmatter again. Ava reads it at the start of each turn.
 */
export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  let body: { skill?: string; access?: string };
  try {
    body = (await request.json()) as { skill?: string; access?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const cap = loadCapabilities().find((c) => c.id === body.skill?.trim());
  if (!cap) return NextResponse.json({ error: "Unknown skill." }, { status: 400 });
  const access = body.access as SkillAccess;
  if (!SKILL_ACCESS_VALUES.includes(access)) {
    return NextResponse.json({ error: "Unknown choice." }, { status: 400 });
  }
  if (!cap.modes.includes("coach") && (access === "everyone" || access === "agent")) {
    return NextResponse.json({ error: "This skill is written for admin mode only." }, { status: 400 });
  }

  const { error } =
    access === defaultSkillAccess(cap)
      ? await supabaseAdmin.from("ava_skill_settings").delete().eq("skill_id", cap.id)
      : await supabaseAdmin.from("ava_skill_settings").upsert({
          skill_id: cap.id,
          access,
          updated_at: new Date().toISOString(),
          updated_by: auth.userId,
        });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await refreshAgentContextOverrides();
  return NextResponse.json({ ok: true, catalog: await loadAvaCatalog() });
}
