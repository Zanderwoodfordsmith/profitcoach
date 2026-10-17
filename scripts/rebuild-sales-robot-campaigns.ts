/**
 * Rebuild Sales Robot (Connector) campaign exports as archived campaigns.
 *
 * Reads a Campaign-Prospects CSV, infers steps / wait times / message copy,
 * then creates archived campaigns with the people in place. Never starts them.
 *
 *   npx tsx scripts/rebuild-sales-robot-campaigns.ts --dry-run \
 *     --csv "/path/to/Campaign-Prospects.csv" --coach-slug fasihi-advisors
 *   npx tsx scripts/rebuild-sales-robot-campaigns.ts \
 *     --csv "/path/to/Campaign-Prospects.csv" --coach-slug fasihi-advisors
 */

import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const COACH_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CsvRow = Record<string, string>;

type InferredStep =
  | { kind: "invite"; body: string }
  | { kind: "wait"; hours: number }
  | { kind: "message"; body: string };

type InferredCampaign = {
  name: string;
  uuid: string;
  people: number;
  replied: number;
  connected: number;
  invited: number;
  steps: InferredStep[];
  leads: Array<{
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    title: string | null;
    linkedin_url: string | null;
    status:
      | "queued"
      | "invited"
      | "connected"
      | "in_sequence"
      | "completed"
      | "replied"
      | "interested";
    interest_outcome: "positive" | "soft" | "negative" | null;
    current_step_position: number;
  }>;
};

function argValue(flag: string): string | null {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  if (i < 0) return null;
  return argv[i + 1] ?? null;
}

function parseDt(raw: string | undefined): Date | null {
  const s = (raw || "").trim();
  if (!s) return null;
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function median(values: number[]): number | null {
  const sorted = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function roundWaitHours(hours: number | null, fallback = 48): number {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return fallback;
  const days = Math.max(1, Math.round(hours / 24));
  return days * 24;
}

function cleanText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function templateCopy(
  raw: string,
  row: CsvRow
): string {
  let text = cleanText(raw);
  const first = (row.firstName || "").trim();
  const last = (row.lastName || "").trim();
  const full = (row.fullName || "").trim();
  const company = (row.companyName || "").trim();
  if (full) text = text.split(full).join("{{full_name}}");
  if (first) {
    text = text.split(first).join("{{first_name}}");
    text = text.replace(
      new RegExp(`Hey\\s*\\{\\{first_name\\}\\}`, "g"),
      "Hey {{first_name}}"
    );
  }
  if (last) text = text.split(last).join("{{last_name}}");
  if (company) text = text.split(company).join("{{company}}");
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function mostCommon(counts: Map<string, number>): string {
  let best = "";
  let n = -1;
  for (const [text, count] of counts) {
    if (count > n || (count === n && text.length > best.length)) {
      best = text;
      n = count;
    }
  }
  return best;
}

function stepFields(row: CsvRow, index: number) {
  return {
    type: (row[`Step ${index} - Type`] || "").trim(),
    status: (row[`Step ${index} - Status`] || "").trim(),
    sentAt: row[`Step ${index} - Sent At`] || "",
    message: (row[`Step ${index} - Message Sent`] || "").trim(),
  };
}

function inferSequence(rows: CsvRow[]): {
  types: string[];
  inviteBody: string;
  messageBodies: string[];
  waitAfterConnect: number;
  waitsBetweenMessages: number[];
} {
  const typeVotes = new Map<string, number>();
  for (const row of rows) {
    const types: string[] = [];
    for (let i = 1; i <= 16; i += 1) {
      const type = stepFields(row, i).type;
      if (!type) break;
      types.push(type);
    }
    if (!types.includes("SEND_MESSAGE")) continue;
    const key = types.join(">");
    typeVotes.set(key, (typeVotes.get(key) || 0) + 1);
  }
  const types = (
    mostCommon(typeVotes) || "SEND_CONNECTION_REQUEST"
  ).split(">");
  const messageIndexes = types
    .map((type, i) => (type === "SEND_MESSAGE" ? i + 1 : 0))
    .filter(Boolean);

  const inviteCounts = new Map<string, number>();
  const messageCounts = messageIndexes.map(() => new Map<string, number>());
  const afterConnect: number[] = [];
  const between: number[][] = messageIndexes.map(() => []);

  for (const row of rows) {
    const invite = stepFields(row, 1);
    if (invite.type === "SEND_CONNECTION_REQUEST" && invite.message) {
      const templated = templateCopy(invite.message, row);
      if (templated) {
        inviteCounts.set(templated, (inviteCounts.get(templated) || 0) + 1);
      }
    }

    const accepted = parseDt(row["Connection Accepted At"]);
    let prevMessageAt: Date | null = null;
    messageIndexes.forEach((csvIndex, messageI) => {
      const step = stepFields(row, csvIndex);
      if (step.message) {
        const templated = templateCopy(step.message, row);
        if (templated) {
          const counts = messageCounts[messageI];
          counts.set(templated, (counts.get(templated) || 0) + 1);
        }
      }
      if (step.status !== "SENT") return;
      const sent = parseDt(step.sentAt);
      if (!sent) return;
      if (messageI === 0 && accepted) {
        afterConnect.push((sent.getTime() - accepted.getTime()) / 36e5);
      } else if (prevMessageAt) {
        between[messageI].push((sent.getTime() - prevMessageAt.getTime()) / 36e5);
      }
      prevMessageAt = sent;
    });
  }

  return {
    types,
    inviteBody: mostCommon(inviteCounts),
    messageBodies: messageCounts.map((counts) => mostCommon(counts)),
    waitAfterConnect: roundWaitHours(median(afterConnect), 48),
    waitsBetweenMessages: between.map((hours, i) =>
      roundWaitHours(median(hours), i === between.length - 1 ? 168 : 72)
    ),
  };
}

function csvInterest(row: CsvRow): {
  status: "interested" | null;
  interest_outcome: "positive" | "soft" | "negative" | null;
} {
  const tags = (row.tagList || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const interested =
    row.hasInterestedTag === "true" ||
    row.hasMeetingRequestTag === "true" ||
    tags.some((t) =>
      [
        "interested",
        "meeting request",
        "discovery call booked",
        "roadmap call booked",
        "booked a call",
      ].includes(t)
    );
  const notInterested = tags.some((t) =>
    [
      "not interested",
      "wrong person",
      "do not contact",
      "bad fit",
      "too small",
      "not a prospect",
      "disconnected",
    ].includes(t)
  );
  if (interested && !notInterested) {
    return { status: "interested", interest_outcome: "positive" };
  }
  if (notInterested) {
    return { status: null, interest_outcome: "negative" };
  }
  if (
    tags.some((t) =>
      [
        "check in",
        "information request",
        "not now",
        "not sure",
        "not clear",
        "potential interest",
        "nurture",
      ].includes(t)
    )
  ) {
    return { status: null, interest_outcome: "soft" };
  }
  return { status: null, interest_outcome: null };
}

function leadStatus(row: CsvRow, messageCount: number): {
  status: InferredCampaign["leads"][number]["status"];
  interest_outcome: InferredCampaign["leads"][number]["interest_outcome"];
  current_step_position: number;
} {
  const activity = (row["Last Activity"] || "").trim();
  const connected =
    row.isConnected === "true" || Boolean(row["Connection Accepted At"]);
  const inviteSent = Boolean(row["Connection Request Sent At"]);
  const sentMessages = Array.from({ length: 16 }, (_, i) => stepFields(row, i + 1)).filter(
    (step) => step.type === "SEND_MESSAGE" && step.status === "SENT"
  ).length;

  const lastMessagePosition =
    sentMessages === 0 ? 0 : 2 + (sentMessages - 1) * 2;

  if (activity === "REPLIED" || row.isReplied === "true") {
    const interest = csvInterest(row);
    return {
      status: interest.status ?? "replied",
      interest_outcome: interest.interest_outcome,
      current_step_position: lastMessagePosition,
    };
  }
  if (connected) {
    if (sentMessages >= messageCount && messageCount > 0) {
      return {
        status: "completed",
        interest_outcome: null,
        current_step_position: lastMessagePosition,
      };
    }
    return {
      status: sentMessages > 0 ? "in_sequence" : "connected",
      interest_outcome: null,
      current_step_position: lastMessagePosition || 0,
    };
  }
  if (inviteSent) {
    return { status: "invited", interest_outcome: null, current_step_position: 0 };
  }
  return { status: "queued", interest_outcome: null, current_step_position: 0 };
}

function buildCampaigns(rows: CsvRow[]): InferredCampaign[] {
  const byName = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const name =
      (row.campaignName || "").trim() ||
      ((row.campaignUuid || "").trim()
        ? `Unnamed campaign (${row.campaignUuid.slice(0, 8)})`
        : "");
    if (!name) continue;
    const list = byName.get(name) ?? [];
    list.push(row);
    byName.set(name, list);
  }

  const campaigns: InferredCampaign[] = [];
  for (const [name, campRows] of byName) {
    const inferred = inferSequence(campRows);
    const messageCount = inferred.messageBodies.filter(Boolean).length;
    const steps: InferredStep[] = [
      { kind: "invite", body: inferred.inviteBody },
      { kind: "wait", hours: inferred.waitAfterConnect },
    ];
    inferred.messageBodies.forEach((body, i) => {
      if (!body) return;
      steps.push({ kind: "message", body });
      if (i < inferred.messageBodies.length - 1) {
        steps.push({
          kind: "wait",
          hours: inferred.waitsBetweenMessages[i + 1] ?? 72,
        });
      }
    });

    const leads = campRows.map((row) => {
      const mapped = leadStatus(row, messageCount);
      return {
        first_name: row.firstName?.trim() || null,
        last_name: row.lastName?.trim() || null,
        company: row.companyName?.trim() || null,
        title: row.jobTitle?.trim() || null,
        linkedin_url:
          row.profileUrl?.trim() ||
          row.linkedinUrl?.trim() ||
          row.uniqueLinkedinId?.trim() ||
          null,
        ...mapped,
      };
    });

    campaigns.push({
      name,
      uuid: campRows[0]?.campaignUuid || "",
      people: campRows.length,
      replied: leads.filter((l) =>
        ["replied", "interested"].includes(l.status)
      ).length,
      connected: leads.filter((l) =>
        ["connected", "in_sequence", "completed", "replied", "interested"].includes(
          l.status
        )
      ).length,
      invited: leads.filter((l) => l.status === "invited").length,
      steps,
      leads,
    });
  }
  return campaigns.sort((a, b) => b.people - a.people);
}

function printCampaign(campaign: InferredCampaign) {
  console.log(`\n${campaign.name}`);
  const positive = campaign.leads.filter((l) => l.interest_outcome === "positive").length;
  const deselect = campaign.leads.filter((l) => l.interest_outcome === "negative").length;
  console.log(
    `  ${campaign.people} people · ${campaign.replied} replied · ${campaign.connected} accepted · ${campaign.invited} pending invites · ${positive} positive · ${deselect} deselect`
  );
  campaign.steps.forEach((step, i) => {
    if (step.kind === "wait") {
      console.log(`  ${i + 1}. wait ${step.hours}h`);
      return;
    }
    const preview = step.body.replace(/\n/g, " / ").slice(0, 140);
    console.log(`  ${i + 1}. ${step.kind}: ${preview}${step.body.length > 140 ? "…" : ""}`);
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const statusesOnly = process.argv.includes("--statuses-only");
  const csvPath = argValue("--csv");
  const coachSlug = argValue("--coach-slug");
  if (!csvPath || !coachSlug) {
    console.error(
      "Usage: npx tsx scripts/rebuild-sales-robot-campaigns.ts [--dry-run] [--statuses-only] --csv <file> --coach-slug <slug>"
    );
    process.exit(1);
  }

  const raw = readFileSync(csvPath, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as CsvRow[];
  const campaigns = buildCampaigns(rows);
  if (!campaigns.length) {
    console.error("No campaigns found in CSV.");
    process.exit(1);
  }

  console.log(`Parsed ${rows.length} rows → ${campaigns.length} campaigns`);
  for (const campaign of campaigns) printCampaign(campaign);
  if (dryRun) {
    console.log("\nDry run — nothing written.");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const { createCampaign, replaceCampaignSteps, addCampaignLeads, setCampaignStatus } =
    await import("../src/lib/unipile/campaigns");
  const addAllLeads = async (
    coachId: string,
    campaignId: string,
    rows: Array<{
      first_name: string | null;
      last_name: string | null;
      company: string | null;
      title: string | null;
      linkedin_url: string | null;
    }>
  ) => {
    let added = 0;
    let skipped = 0;
    for (let i = 0; i < rows.length; i += 2500) {
      const chunk = rows.slice(i, i + 2500);
      const result = await addCampaignLeads(coachId, campaignId, chunk);
      added += result.added;
      skipped += result.skipped;
    }
    return { added, skipped };
  };
  const { normalizeLinkedInProfileUrl } = await import(
    "../src/lib/unipile/linkedinUrl"
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const sb = createClient(url, key);

  const { data: coach, error: coachError } = await sb
    .from("coaches")
    .select("id, slug")
    .eq("slug", coachSlug)
    .maybeSingle();
  if (coachError || !coach?.id || !COACH_ID_RE.test(coach.id)) {
    console.error("Coach not found:", coachSlug, coachError?.message);
    process.exit(1);
  }

  const { data: account } = await sb
    .from("linkedin_outreach_accounts")
    .select("id")
    .eq("coach_id", coach.id)
    .eq("provider", "LINKEDIN")
    .eq("status", "OK")
    .maybeSingle();

  const { fetchAllSupabasePages } = await import(
    "../src/lib/contactsSchemaSafeSelect"
  );
  const urlKey = (raw: string | null | undefined) => {
    const normalized = normalizeLinkedInProfileUrl(raw || "");
    if (!normalized) return null;
    const slug = normalized.replace(/\/+$/, "").split("/").pop();
    return (slug || normalized).toLowerCase();
  };

  const applyStatuses = async (campaignId: string, campaign: InferredCampaign) => {
    const savedPage = await fetchAllSupabasePages<{
      id: string;
      linkedin_url: string | null;
    }>(async (from, to) =>
      sb
        .from("linkedin_campaign_leads")
        .select("id, linkedin_url")
        .eq("campaign_id", campaignId)
        .range(from, to)
    );
    const byUrl = new Map<string, string>();
    for (const lead of savedPage.data ?? []) {
      const key = urlKey(lead.linkedin_url);
      if (key) byUrl.set(key, lead.id);
    }

    const patches = new Map<
      string,
      {
        ids: string[];
        current_step_position: number;
        interest_outcome: "positive" | "soft" | "negative" | null;
      }
    >();
    let matched = 0;
    for (const lead of campaign.leads) {
      const id = urlKey(lead.linkedin_url)
        ? byUrl.get(urlKey(lead.linkedin_url) as string)
        : null;
      if (!id) continue;
      matched += 1;
      const key = `${lead.status}:${lead.current_step_position}:${lead.interest_outcome ?? ""}`;
      const bucket = patches.get(key) ?? {
        ids: [],
        current_step_position: lead.current_step_position,
        interest_outcome: lead.interest_outcome,
      };
      bucket.ids.push(id);
      patches.set(key, bucket);
    }
    for (const [key, bucket] of patches) {
      const status = key.split(":")[0];
      for (let i = 0; i < bucket.ids.length; i += 200) {
        const chunk = bucket.ids.slice(i, i + 200);
        const { error } = await sb
          .from("linkedin_campaign_leads")
          .update({
            status,
            current_step_position: bucket.current_step_position,
            interest_outcome: bucket.interest_outcome,
            next_action_at: null,
          })
          .eq("campaign_id", campaignId)
          .in("id", chunk);
        if (error) throw new Error(error.message);
      }
    }
    return { matched, stored: savedPage.data.length };
  };

  const { data: existing } = await sb
    .from("linkedin_campaigns")
    .select("id, name, status")
    .eq("coach_id", coach.id);

  for (const campaign of campaigns) {
    const already = (existing ?? []).find((row) => row.name === campaign.name);
    if (already) {
      if (!statusesOnly) {
        const missing = campaign.leads.filter((lead) => lead.linkedin_url);
        const added = await addAllLeads(
          coach.id,
          already.id,
          missing.map((lead) => ({
            first_name: lead.first_name,
            last_name: lead.last_name,
            company: lead.company,
            title: lead.title,
            linkedin_url: lead.linkedin_url,
          }))
        );
        console.log(
          `  leads added ${added.added}, skipped ${added.skipped}`
        );
      }
      const patched = await applyStatuses(already.id, campaign);
      if (!statusesOnly && already.status !== "archived") {
        await setCampaignStatus(coach.id, already.id, "archived");
      }
      console.log(
        `\nUpdated ${campaign.name} (${already.id}) — statuses ${patched.matched}/${patched.stored}`
      );
      continue;
    }
    if (statusesOnly) {
      console.log(`\nSkip ${campaign.name} — campaign not imported yet`);
      continue;
    }

    const created = await createCampaign(coach.id, {
      name: campaign.name,
      outreach_account_id: account?.id ?? null,
    });
    const steps = campaign.steps.map((step, position) =>
      step.kind === "wait"
        ? { position, step_type: "wait" as const, wait_hours: step.hours }
        : {
            position,
            step_type: step.kind,
            body: step.body,
          }
    );
    await replaceCampaignSteps(created.id, steps);

    const importRows = campaign.leads.map((lead) => ({
      first_name: lead.first_name,
      last_name: lead.last_name,
      company: lead.company,
      title: lead.title,
      linkedin_url: lead.linkedin_url,
    }));
    const added = await addAllLeads(coach.id, created.id, importRows);
    const patched = await applyStatuses(created.id, campaign);
    await setCampaignStatus(coach.id, created.id, "archived");
    console.log(
      `\nArchived ${campaign.name} (${created.id}) — added ${added.added}, skipped ${added.skipped}, statuses ${patched.matched}/${patched.stored}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
