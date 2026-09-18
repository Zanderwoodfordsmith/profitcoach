import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { utcToZonedParts } from "@/lib/booking/bookingTime";
import {
  cancelSentInvitation,
  listSentInvitations,
  UNIPILE_SENT_INVITE_PAGE_MAX,
  type UnipileSentInvitation,
} from "@/lib/unipile/client";
import {
  clampWithdrawValue,
  DEFAULT_KEEP_UNDER,
  inviteSentAt,
  isInviteWithdrawMode,
  parseInviteWithdrawPolicy,
  PENDING_LIST_MAX,
  remainingAutoQuota,
  selectInvitesToWithdraw,
  utcDateYmd,
  type InviteWithdrawMode,
  type InviteWithdrawPolicy,
} from "@/lib/unipile/inviteWithdraw";

export type PendingInviteRow = UnipileSentInvitation & {
  campaign_lead_id?: string | null;
  campaign_id?: string | null;
};

type OutreachAccount = {
  id: string;
  unipile_account_id: string;
  status: string;
  timezone?: string | null;
  invite_withdraw_mode?: string | null;
  invite_withdraw_value?: number | null;
  invite_withdraw_ran_on?: string | null;
  invite_withdraw_ran_count?: number | null;
};

const ACCOUNT_SELECT =
  "id, unipile_account_id, status, timezone, invite_withdraw_mode, invite_withdraw_value, invite_withdraw_ran_on, invite_withdraw_ran_count";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** 3–8s jitter between auto-cancels so LinkedIn doesn’t see a burst. */
function withdrawGapMs() {
  return 3000 + Math.floor(Math.random() * 5000);
}

function isWeekendInTimezone(timeZone: string | null | undefined, now = new Date()) {
  try {
    const weekday = utcToZonedParts(now, timeZone?.trim() || "UTC").weekday;
    return weekday === 0 || weekday === 6;
  } catch {
    const day = now.getUTCDay();
    return day === 0 || day === 6;
  }
}

function friendlyInviteListError(error?: string) {
  const raw = (error || "").trim();
  if (!raw) return "Could not list pending invitations.";
  if (raw.length > 160 || raw.includes("{") || raw.includes("schema")) {
    return "Could not list pending invitations.";
  }
  if (/not found/i.test(raw)) {
    return "Could not load pending invitations from LinkedIn. Check the account is still connected.";
  }
  return raw;
}

async function requireAccount(coachId: string, outreachAccountId?: string | null) {
  let q = supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select(ACCOUNT_SELECT)
    .eq("coach_id", coachId)
    .eq("status", "OK");
  if (outreachAccountId) q = q.eq("id", outreachAccountId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.unipile_account_id) {
    throw new Error("No connected LinkedIn account.");
  }
  return data as OutreachAccount;
}

async function matchLeadsByInviteIds(coachId: string, invitationIds: string[]) {
  const leadByInvite = new Map<string, { id: string; campaign_id: string }>();
  for (let i = 0; i < invitationIds.length; i += 100) {
    const chunk = invitationIds.slice(i, i + 100);
    const { data: leads } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id, campaign_id, invitation_id")
      .eq("coach_id", coachId)
      .in("invitation_id", chunk);
    for (const lead of leads ?? []) {
      if (lead.invitation_id) {
        leadByInvite.set(lead.invitation_id as string, {
          id: lead.id as string,
          campaign_id: lead.campaign_id as string,
        });
      }
    }
  }
  return leadByInvite;
}

export async function listPendingInvitesForCoach(
  coachId: string,
  options?: {
    /** How many invite rows to return (lead-matched). Total always pages to PENDING_LIST_MAX. */
    maxItems?: number;
    outreachAccountId?: string;
    /** Stop paging before the platform kills the request with an HTML error page. */
    deadlineAt?: number;
  }
): Promise<{
  account_id: string;
  invitations: PendingInviteRow[];
  total: number;
  has_more: boolean;
  withdraw: InviteWithdrawPolicy;
}> {
  const account = await requireAccount(coachId, options?.outreachAccountId);
  const returnLimit = Math.min(
    PENDING_LIST_MAX,
    Math.max(1, Math.floor(options?.maxItems ?? PENDING_LIST_MAX))
  );

  const items: UnipileSentInvitation[] = [];
  let cursor: string | null | undefined = null;
  let hasMore = false;

  // Always page far enough for an accurate dial total (not capped at 100).
  do {
    if (options?.deadlineAt && Date.now() >= options.deadlineAt) {
      hasMore = true;
      break;
    }
    const pageLimit = Math.min(
      UNIPILE_SENT_INVITE_PAGE_MAX,
      PENDING_LIST_MAX - items.length
    );
    if (pageLimit <= 0) break;
    const listed = await listSentInvitations({
      account_id: account.unipile_account_id,
      limit: pageLimit,
      cursor: cursor ?? undefined,
    });
    if (!listed.ok) {
      throw new Error(friendlyInviteListError(listed.error));
    }
    const page = listed.data?.items ?? [];
    items.push(...page);
    cursor = listed.data?.cursor ?? null;
    if (items.length >= PENDING_LIST_MAX) {
      hasMore = Boolean(cursor);
      break;
    }
    if (!cursor || page.length === 0) break;
  } while (items.length < PENDING_LIST_MAX);

  items.sort(
    (a, b) =>
      inviteSentAt(a.parsed_datetime || a.date) -
      inviteSentAt(b.parsed_datetime || b.date)
  );

  const forReturn = items.slice(0, returnLimit);
  const invitationIds = forReturn.map((i) => i.id).filter(Boolean);
  const leadByInvite = await matchLeadsByInviteIds(coachId, invitationIds);

  const invitations: PendingInviteRow[] = forReturn.map((item) => {
    const match = leadByInvite.get(item.id);
    return {
      ...item,
      campaign_lead_id: match?.id ?? null,
      campaign_id: match?.campaign_id ?? null,
    };
  });

  return {
    account_id: account.id,
    invitations,
    total: items.length,
    has_more: hasMore || items.length > returnLimit,
    withdraw: parseInviteWithdrawPolicy(account),
  };
}

export async function getInviteWithdrawPolicy(
  coachId: string
): Promise<InviteWithdrawPolicy> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select(ACCOUNT_SELECT)
    .eq("coach_id", coachId)
    .eq("status", "OK")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return parseInviteWithdrawPolicy(data);
}

export async function saveInviteWithdrawPolicy(
  coachId: string,
  input: { mode?: unknown; value?: unknown }
): Promise<InviteWithdrawPolicy> {
  const account = await requireAccount(coachId);
  const current = parseInviteWithdrawPolicy(account);
  const mode: InviteWithdrawMode = isInviteWithdrawMode(input.mode)
    ? input.mode
    : current.mode;
  const valueSource =
    input.value === undefined
      ? mode === "cap" || current.mode === "off"
        ? DEFAULT_KEEP_UNDER
        : current.value
      : input.value;
  const clampMode: Exclude<InviteWithdrawMode, "off"> =
    mode === "off"
      ? current.mode === "off"
        ? "cap"
        : current.mode
      : mode;
  const value = clampWithdrawValue(clampMode, valueSource);

  const { data, error } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .update({
      invite_withdraw_mode: mode,
      invite_withdraw_value: value,
    })
    .eq("id", account.id)
    .eq("coach_id", coachId)
    .select(ACCOUNT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return parseInviteWithdrawPolicy(data);
}

async function markLeadInviteWithdrawn(coachId: string, invitationId: string) {
  await supabaseAdmin
    .from("linkedin_campaign_leads")
    .update({
      status: "skipped",
      last_error: "Connection request withdrawn",
      next_action_at: null,
    })
    .eq("coach_id", coachId)
    .eq("invitation_id", invitationId)
    .eq("status", "invited");
}

export async function withdrawInvitation(
  coachId: string,
  invitationId: string
) {
  const account = await requireAccount(coachId);
  const res = await cancelSentInvitation({
    account_id: account.unipile_account_id,
    invitation_id: invitationId,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(res.error || "Could not withdraw invitation.");
  }
  await markLeadInviteWithdrawn(coachId, invitationId);
  return { ok: true };
}

async function withdrawInvitationOnAccount(
  coachId: string,
  unipileAccountId: string,
  invitationId: string
) {
  const res = await cancelSentInvitation({
    account_id: unipileAccountId,
    invitation_id: invitationId,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(res.error || "Could not withdraw invitation.");
  }
  await markLeadInviteWithdrawn(coachId, invitationId);
}

function isRateLimitedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /too many requests|429/i.test(message);
}

async function withdrawListedInvites(
  coachId: string,
  unipileAccountId: string,
  ids: string[]
) {
  let withdrawn = 0;
  const errors: string[] = [];
  for (const id of ids) {
    try {
      await withdrawInvitationOnAccount(coachId, unipileAccountId, id);
      withdrawn += 1;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Failed ${id}`);
      if (isRateLimitedError(err)) break;
    }
  }
  return { withdrawn, attempted: ids.length, errors };
}

/** Withdraw the oldest pending invites (LinkedIn pending-invite hygiene). */
export async function withdrawOldestInvitations(
  coachId: string,
  count: number
) {
  const limit = Math.min(50, Math.max(1, Math.floor(count)));
  const { invitations, account_id } = await listPendingInvitesForCoach(coachId, {
    maxItems: PENDING_LIST_MAX,
  });
  const account = await requireAccount(coachId, account_id);
  const targets = invitations.slice(0, limit).map((invite) => invite.id);
  return withdrawListedInvites(coachId, account.unipile_account_id, targets);
}

async function bumpInviteWithdrawRun(
  accountId: string,
  todayYmd: string,
  ranCount: number
) {
  const { error } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .update({
      invite_withdraw_ran_on: todayYmd,
      invite_withdraw_ran_count: ranCount,
    })
    .eq("id", accountId);
  if (error) throw new Error(error.message);
}

export async function processInviteWithdrawForAccount(account: {
  id: string;
  coach_id: string;
  unipile_account_id: string;
  timezone?: string | null;
  invite_withdraw_mode?: string | null;
  invite_withdraw_value?: number | null;
  invite_withdraw_ran_on?: string | null;
  invite_withdraw_ran_count?: number | null;
}) {
  const policy = parseInviteWithdrawPolicy(account);
  const today = utcDateYmd();
  const weekend = isWeekendInTimezone(account.timezone);
  const quota = remainingAutoQuota(policy, today, weekend);
  if (quota <= 0) {
    return { accountId: account.id, withdrawn: 0, attempted: 0, skipped: true };
  }

  const listed = await listPendingInvitesForCoach(account.coach_id, {
    maxItems: PENDING_LIST_MAX,
    outreachAccountId: account.id,
  });
  const targets = selectInvitesToWithdraw(
    listed.invitations.map((invite) => ({
      id: invite.id,
      sentAt: inviteSentAt(invite.parsed_datetime || invite.date),
    })),
    policy,
    quota
  );
  if (targets.length === 0) {
    if (policy.ranOn !== today) {
      await bumpInviteWithdrawRun(account.id, today, 0);
    }
    return { accountId: account.id, withdrawn: 0, attempted: 0, skipped: false };
  }

  const already = policy.ranOn === today ? policy.ranCount : 0;
  let withdrawn = 0;
  const errors: string[] = [];
  for (const id of targets) {
    if (withdrawn > 0) {
      await sleep(withdrawGapMs());
    }
    try {
      await withdrawInvitationOnAccount(
        account.coach_id,
        account.unipile_account_id,
        id
      );
      withdrawn += 1;
      await bumpInviteWithdrawRun(account.id, today, already + withdrawn);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Failed ${id}`);
      if (withdrawn > 0) {
        await bumpInviteWithdrawRun(account.id, today, already + withdrawn);
      }
      break;
    }
  }

  return {
    accountId: account.id,
    withdrawn,
    attempted: targets.length,
    skipped: false,
    errors,
  };
}

export async function processDueInviteWithdrawals(options?: {
  budgetMs?: number;
}) {
  const budgetMs = options?.budgetMs ?? 50_000;
  const started = Date.now();
  const { data, error } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select(`${ACCOUNT_SELECT}, coach_id`)
    .eq("status", "OK")
    .neq("invite_withdraw_mode", "off");
  if (error) throw new Error(error.message);

  const results = [];
  for (const row of data ?? []) {
    if (Date.now() - started > budgetMs) break;
    const account = row as OutreachAccount & { coach_id: string };
    if (!account.unipile_account_id) continue;
    try {
      results.push(await processInviteWithdrawForAccount(account));
    } catch (err) {
      results.push({
        accountId: account.id,
        withdrawn: 0,
        attempted: 0,
        skipped: false,
        errors: [err instanceof Error ? err.message : "Withdraw failed."],
      });
    }
  }

  return {
    processed: results.length,
    withdrawn: results.reduce((sum, row) => sum + (row.withdrawn ?? 0), 0),
    results,
  };
}
