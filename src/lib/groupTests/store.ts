import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fillArm,
  validateFills,
  validateTest,
  type ArmStats,
  type GroupTest,
  type GroupTestArm,
  type GroupTestSlot,
} from "@/lib/groupTests/core";

const TEST_SELECT = "id, name, hypothesis, step_type, arms, slots, status, target_per_arm, started_at, ended_at, created_at";

function mapTest(row: Record<string, unknown>): GroupTest & { started_at: string | null; ended_at: string | null } {
  return {
    id: row.id as string,
    name: row.name as string,
    hypothesis: (row.hypothesis as string | null) ?? null,
    step_type: row.step_type === "invite" ? "invite" : "message",
    arms: Array.isArray(row.arms) ? (row.arms as GroupTestArm[]) : [],
    slots: Array.isArray(row.slots) ? (row.slots as GroupTestSlot[]) : [],
    status: (row.status as GroupTest["status"]) ?? "draft",
    target_per_arm: Number(row.target_per_arm ?? 1500),
    started_at: (row.started_at as string | null) ?? null,
    ended_at: (row.ended_at as string | null) ?? null,
  };
}

export async function listGroupTests(opts?: { liveOnly?: boolean }) {
  let q = supabaseAdmin.from("group_tests").select(TEST_SELECT).order("created_at", { ascending: false });
  if (opts?.liveOnly) q = q.eq("status", "live");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapTest(r as Record<string, unknown>));
}

export async function getGroupTest(id: string) {
  const { data } = await supabaseAdmin.from("group_tests").select(TEST_SELECT).eq("id", id).maybeSingle();
  return data ? mapTest(data as Record<string, unknown>) : null;
}

export async function saveGroupTest(input: {
  id?: string | null;
  name: string;
  hypothesis?: string | null;
  step_type: "invite" | "message";
  arms: GroupTestArm[];
  slots: GroupTestSlot[];
  target_per_arm?: number;
  createdBy: string;
}) {
  const problem = validateTest(input);
  if (problem) throw new Error(problem);
  const row = {
    name: input.name.trim().slice(0, 120),
    hypothesis: input.hypothesis?.trim().slice(0, 600) || null,
    step_type: input.step_type,
    arms: input.arms.map((a) => ({ key: a.key, label: a.label.trim().slice(0, 60) || a.key, body: a.body.trim().slice(0, 2000) })),
    slots: input.slots.map((s) => ({
      key: s.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""),
      label: s.label.trim().slice(0, 80),
      hint: s.hint?.trim().slice(0, 160) || undefined,
      max: s.max ?? 120,
    })),
    target_per_arm: Math.max(100, Math.min(20000, Math.round(input.target_per_arm ?? 1500))),
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const existing = await getGroupTest(input.id);
    if (!existing) throw new Error("Test not found.");
    if (existing.status !== "draft") throw new Error("Live tests can't change their wording. End it and start a new one.");
    const { error } = await supabaseAdmin.from("group_tests").update(row).eq("id", input.id);
    if (error) throw new Error(error.message);
    return input.id;
  }
  const { data, error } = await supabaseAdmin
    .from("group_tests")
    .insert({ ...row, created_by: input.createdBy })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save the test.");
  return data.id as string;
}

export async function setGroupTestStatus(id: string, status: "live" | "ended" | "draft") {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "live") patch.started_at = new Date().toISOString();
  if (status === "ended") patch.ended_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from("group_tests").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** The step a test replaces: the connection request, or the first message. */
async function targetStep(campaignId: string, stepType: "invite" | "message") {
  const { data } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("id, position, step_type, config")
    .eq("campaign_id", campaignId)
    .eq("step_type", stepType)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function joinGroupTest(input: { coachId: string; campaignId: string; testId: string; fills: Record<string, unknown> }) {
  const test = await getGroupTest(input.testId);
  if (!test || test.status !== "live") throw new Error("That test isn't running.");
  const { data: campaign } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id, channel")
    .eq("id", input.campaignId)
    .eq("coach_id", input.coachId)
    .maybeSingle();
  if (!campaign) throw new Error("Campaign not found.");
  if ((campaign.channel as string | null) && campaign.channel !== "linkedin") throw new Error("Group tests run on LinkedIn campaigns.");
  const { fills, error } = validateFills(test.slots, input.fills);
  if (error) throw new Error(error);
  const step = await targetStep(input.campaignId, test.step_type);
  if (!step) {
    throw new Error(test.step_type === "invite" ? "Add a connection request step first." : "Add a first message step first.");
  }
  const variants = test.arms.map((arm) => ({ key: arm.key, label: arm.label, body: fillArm(arm.body, fills) }));
  const config = {
    ...((step.config as Record<string, unknown> | null) ?? {}),
    group_test_id: test.id,
    group_test_name: test.name,
    locked: true,
  };
  const { error: stepError } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .update({ variants, body: variants[0]?.body ?? "", config, updated_at: new Date().toISOString() })
    .eq("id", step.id);
  if (stepError) throw new Error(stepError.message);
  const { error: enrolError } = await supabaseAdmin.from("group_test_enrolments").upsert(
    {
      group_test_id: test.id,
      coach_id: input.coachId,
      campaign_id: input.campaignId,
      step_id: step.id,
      fills,
      left_at: null,
    },
    { onConflict: "step_id" }
  );
  if (enrolError) throw new Error(enrolError.message);
  return { stepId: step.id as string };
}

/** Leave: unlock the step and keep version A as the coach's own wording. */
export async function leaveGroupTest(input: { coachId: string; campaignId: string }) {
  const { data: enrol } = await supabaseAdmin
    .from("group_test_enrolments")
    .select("id, step_id")
    .eq("campaign_id", input.campaignId)
    .eq("coach_id", input.coachId)
    .is("left_at", null)
    .maybeSingle();
  if (!enrol) return;
  const { data: step } = await supabaseAdmin.from("linkedin_campaign_steps").select("body, config").eq("id", enrol.step_id).maybeSingle();
  const config = { ...((step?.config as Record<string, unknown> | null) ?? {}) };
  delete config.group_test_id;
  delete config.group_test_name;
  delete config.locked;
  await supabaseAdmin
    .from("linkedin_campaign_steps")
    .update({ variants: [], body: step?.body ?? "", config, updated_at: new Date().toISOString() })
    .eq("id", enrol.step_id);
  await supabaseAdmin.from("group_test_enrolments").update({ left_at: new Date().toISOString() }).eq("id", enrol.id);
}

const ACCEPTED = new Set(["connected", "in_sequence", "replied", "interested", "assessment_sent", "assessment_done", "call_offered", "completed"]);
const REPLIED = new Set(["replied", "interested", "assessment_sent", "assessment_done", "call_offered"]);
const INTERESTED = new Set(["interested", "assessment_sent", "assessment_done", "call_offered"]);

/** Pool every enrolled campaign's results by version. */
export async function groupTestResults(testId: string): Promise<{ arms: ArmStats[]; coaches: number; campaigns: number }> {
  const test = await getGroupTest(testId);
  if (!test) throw new Error("Test not found.");
  const { data: enrols } = await supabaseAdmin
    .from("group_test_enrolments")
    .select("coach_id, campaign_id, step_id")
    .eq("group_test_id", testId);
  const stats = new Map<string, ArmStats & { coachSet: Set<string> }>();
  for (const arm of test.arms) {
    stats.set(arm.key, { key: arm.key, label: arm.label, people: 0, accepted: 0, replied: 0, interested: 0, coaches: 0, coachSet: new Set() });
  }
  for (const e of enrols ?? []) {
    for (let from = 0; ; from += 1000) {
      const { data: leads } = await supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("status, interest_outcome, ab_assignments")
        .eq("campaign_id", e.campaign_id)
        .not("ab_assignments", "is", null)
        .range(from, from + 999);
      for (const lead of leads ?? []) {
        const key = ((lead.ab_assignments ?? {}) as Record<string, string>)[e.step_id as string];
        const row = key ? stats.get(key) : undefined;
        if (!row) continue;
        const st = String(lead.status);
        row.people += 1;
        row.coachSet.add(e.coach_id as string);
        if (ACCEPTED.has(st)) row.accepted += 1;
        if (REPLIED.has(st)) row.replied += 1;
        if (INTERESTED.has(st) || lead.interest_outcome === "positive") row.interested += 1;
      }
      if (!leads || leads.length < 1000) break;
    }
  }
  return {
    arms: [...stats.values()].map(({ coachSet, ...rest }) => ({ ...rest, coaches: coachSet.size })),
    coaches: new Set((enrols ?? []).map((e) => e.coach_id)).size,
    campaigns: (enrols ?? []).length,
  };
}

/** Steps that belong to a group test keep their wording, whatever the editor sends. Keyed by step id. */
export async function lockedStepsById(campaignId: string): Promise<Map<string, { body: string | null; variants: unknown; config: Record<string, unknown> }>> {
  const { data } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("id, body, variants, config")
    .eq("campaign_id", campaignId);
  const out = new Map<string, { body: string | null; variants: unknown; config: Record<string, unknown> }>();
  for (const s of data ?? []) {
    const cfg = (s.config ?? {}) as Record<string, unknown>;
    if (cfg.group_test_id && cfg.locked) out.set(s.id as string, { body: (s.body as string | null) ?? null, variants: s.variants, config: cfg });
  }
  return out;
}
