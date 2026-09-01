"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { InlineEditableText } from "@/components/prospects/InlineEditableText";
import { ProspectActivityFeed } from "@/components/prospects/ProspectActivityFeed";
import { ProspectCrmLinkModal } from "@/components/prospects/ProspectCrmLinkModal";
import { ProspectNextActionCell } from "@/components/prospects/ProspectNextActionCell";
import { ProspectStatusCell } from "@/components/prospects/ProspectStatusCell";
import { ScorecardGlanceModal } from "@/components/scorecard/ScorecardGlanceModal";
import {
  buildPersonalisedAssessmentLink,
  buildPersonalisedAssessmentProLink,
} from "@/lib/assessmentContactParams";
import { formatPhoneDisplay } from "@/lib/formatPhoneDisplay";
import { getProspectCrmContactUrl } from "@/lib/ghlContactWebhook";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";
import {
  formatProspectPersonName,
  normalizeProspectLabel,
  normalizeProspectPersonName,
} from "@/lib/prospectDisplayFormat";
import {
  formatProspectLastAssessed,
  formatProspectNextCallWhen,
  getProspectNextCallName,
  getProspectNextCallStatusLabel,
} from "@/lib/prospectNextCall";
import type { ProspectRow } from "@/lib/prospectRow";
import { resolveProspectSourceLabel } from "@/lib/prospectSourceKind";
import { applyProspectPatch } from "@/lib/prospects/applyProspectPatch";
import type {
  ProspectFieldPatch,
  UpdatedProspectFields,
} from "@/lib/prospects/updateProspectFields";
import { canonicalLinkedInProfileUrl } from "@/lib/salesNavigator/linkedinUrl";
import { splitFullName } from "@/lib/splitFullName";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

type Props = {
  contactId: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function ProspectWorkspace({ contactId }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const { impersonatingCoachId, setImpersonatingCoachId } = useImpersonation();

  const [prospect, setProspect] = useState<ProspectRow | null>(null);
  const [coachSlug, setCoachSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [crmOpen, setCrmOpen] = useState(false);
  const [glanceOpen, setGlanceOpen] = useState(false);

  const backHref = isAdmin ? "/admin/prospects" : "/coach/prospects";
  const pipelineHref = isAdmin ? "/admin/pipeline" : "/coach/pipeline";
  const callsHref = isAdmin ? "/admin/calls" : "/coach/calls";
  const conversationsHref = isAdmin
    ? "/admin/conversations"
    : "/coach/conversations";

  const authHeaders = useCallback(async () => {
    const token = await getValidSupabaseAccessToken();
    if (!token) return null;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (!isAdmin && impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return headers;
  }, [isAdmin, impersonatingCoachId]);

  const contactUrl = isAdmin
    ? `/api/admin/contacts/${encodeURIComponent(contactId)}`
    : `/api/coach/contacts/${encodeURIComponent(contactId)}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        router.replace("/login");
        return;
      }
      const res = await fetch(contactUrl, { headers, cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        prospect?: ProspectRow;
        coachSlug?: string | null;
        error?: string;
      };
      if (!res.ok || !body.prospect) {
        setError(body.error ?? "Prospect not found.");
        setProspect(null);
        return;
      }
      if (isAdmin && body.prospect.coach_id) {
        setImpersonatingCoachId(body.prospect.coach_id);
      }
      setProspect(body.prospect);
      setCoachSlug(body.coachSlug ?? null);
    } catch {
      setError("Unable to load prospect.");
      setProspect(null);
    } finally {
      setLoading(false);
    }
  }, [
    authHeaders,
    contactUrl,
    isAdmin,
    router,
    setImpersonatingCoachId,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpdate(patch: ProspectFieldPatch) {
    if (!prospect) return;
    const headers = await authHeaders();
    if (!headers) throw new Error("Please sign in again.");
    setSaving(true);
    try {
      const res = await fetch(contactUrl, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = (await res.json().catch(() => ({}))) as UpdatedProspectFields & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to update prospect.");
      }
      setProspect((prev) => (prev ? applyProspectPatch(prev, body) : prev));
    } finally {
      setSaving(false);
    }
  }

  const displayName = prospect
    ? formatProspectPersonName(prospect.full_name) || prospect.full_name
    : "Prospect";

  const bossHref = prospect
    ? bossProHubPath(prospect.id, { admin: isAdmin })
    : "#";

  const crmUrl =
    prospect &&
    getProspectCrmContactUrl({
      crm_contact_id: prospect.crm_contact_id,
      crm_location_id: prospect.crm_location_id,
    });

  const nameParts = prospect ? splitFullName(prospect.full_name) : null;
  const scorecardLink =
    coachSlug && prospect
      ? buildPersonalisedAssessmentLink({
          coachSlug,
          firstName: nameParts?.first_name ?? undefined,
          lastName: nameParts?.last_name ?? undefined,
          email: prospect.email ?? undefined,
          phone: prospect.phone ?? undefined,
          businessName: prospect.business_name ?? undefined,
        })
      : null;
  const bossProLink =
    coachSlug && prospect
      ? buildPersonalisedAssessmentProLink({
          coachSlug,
          firstName: nameParts?.first_name ?? undefined,
          lastName: nameParts?.last_name ?? undefined,
          email: prospect.email ?? undefined,
          phone: prospect.phone ?? undefined,
          businessName: prospect.business_name ?? undefined,
        })
      : null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <StickyPageHeader
        title="Get Clients"
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-slate-600 transition hover:text-sky-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Prospects
        </Link>
        {isAdmin ? (
          <>
            <span className="text-slate-300">·</span>
            <Link
              href={pipelineHref}
              className="text-slate-600 transition hover:text-sky-700"
            >
              Pipeline
            </Link>
          </>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : error || !prospect ? (
        <p className="text-sm text-rose-600">{error ?? "Prospect not found."}</p>
      ) : (
        <div className="grid min-h-[calc(100vh-12rem)] w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_300px] md:-mr-6 lg:-mr-10">
          {/* Left: contact */}
          <aside className="flex flex-col gap-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-lg font-semibold text-slate-700 ring-1 ring-slate-200/80">
                  {initials(displayName)}
                </span>
                <div className="mt-3 w-full">
                  <InlineEditableText
                    value={prospect.full_name}
                    placeholder="Add name"
                    saving={saving}
                    valueClassName="text-center"
                    normalize={(raw) =>
                      normalizeProspectPersonName(raw) || null
                    }
                    onSave={async (next) => {
                      const parts = splitFullName(next ?? "");
                      await handleUpdate({
                        first_name: parts.first_name,
                        last_name: parts.last_name,
                      });
                    }}
                    display={(v) => (
                      <span className="text-lg font-semibold tracking-tight text-slate-900">
                        {formatProspectPersonName(v) || v}
                      </span>
                    )}
                  />
                </div>
                <div className="mt-1 w-full">
                  <InlineEditableText
                    value={prospect.job_title}
                    placeholder="Add title"
                    saving={saving}
                    valueClassName="text-center"
                    normalize={(raw) => normalizeProspectLabel(raw)}
                    onSave={async (next) => {
                      await handleUpdate({ job_title: next });
                    }}
                    display={(v) => (
                      <span className="text-xs text-slate-500">{v}</span>
                    )}
                  />
                </div>
              </div>

              <dl className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                <InlineEditableText
                  label="Email"
                  value={prospect.email}
                  placeholder="Add email"
                  type="email"
                  saving={saving}
                  validate={(raw) => {
                    const trimmed = raw.trim();
                    if (!trimmed) return "Email is required.";
                    if (!trimmed.includes("@")) return "Enter a valid email.";
                    return null;
                  }}
                  normalize={(raw) => raw.trim().toLowerCase() || null}
                  onSave={async (next) => {
                    await handleUpdate({ email: next });
                  }}
                />
                <InlineEditableText
                  label="Phone"
                  value={prospect.phone}
                  placeholder="Add phone"
                  type="tel"
                  saving={saving}
                  normalize={(raw) => raw.trim() || null}
                  onSave={async (next) => {
                    await handleUpdate({ phone: next });
                  }}
                  display={(v) => formatPhoneDisplay(v)}
                />
                <InlineEditableText
                  label="Business"
                  value={prospect.business_name}
                  placeholder="Add business"
                  saving={saving}
                  normalize={(raw) => normalizeProspectLabel(raw)}
                  onSave={async (next) => {
                    await handleUpdate({ business_name: next });
                  }}
                />
                <div>
                  <div className="text-[11px] text-slate-400">Website</div>
                  <div className="mt-0.5 flex items-start gap-1.5">
                    <div className="min-w-0 flex-1">
                      <InlineEditableText
                        value={prospect.company_website}
                        placeholder="Add website"
                        type="url"
                        saving={saving}
                        normalize={(raw) => raw.trim() || null}
                        onSave={async (next) => {
                          await handleUpdate({ company_website: next });
                        }}
                        display={(v) => (
                          <span className="break-all text-sm text-slate-800">
                            {v.replace(/^https?:\/\/(www\.)?/i, "")}
                          </span>
                        )}
                      />
                    </div>
                    {prospect.company_website?.trim() ? (
                      <a
                        href={
                          /^https?:\/\//i.test(prospect.company_website.trim())
                            ? prospect.company_website.trim()
                            : `https://${prospect.company_website.trim()}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open website"
                        className="mt-1 shrink-0 rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-sky-700"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">LinkedIn</div>
                  <div className="mt-0.5 flex items-start gap-1.5">
                    <div className="min-w-0 flex-1">
                      <InlineEditableText
                        value={prospect.linkedin_url}
                        placeholder="Add LinkedIn URL"
                        type="url"
                        saving={saving}
                        normalize={(raw) => raw.trim() || null}
                        onSave={async (next) => {
                          await handleUpdate({ linkedin_url: next });
                        }}
                        display={(v) => (
                          <span className="break-all text-sm text-slate-800">
                            {v.replace(/^https?:\/\/(www\.)?/i, "")}
                          </span>
                        )}
                      />
                    </div>
                    {prospect.linkedin_url?.trim() ? (
                      <a
                        href={
                          canonicalLinkedInProfileUrl(prospect.linkedin_url) ??
                          prospect.linkedin_url.trim()
                        }
                        target="_blank"
                        rel="noreferrer"
                        title="Open LinkedIn"
                        className="mt-1 shrink-0 rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-sky-700"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">CRM</div>
                  <div className="mt-0.5">
                    {crmUrl ? (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <a
                          href={crmUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-sky-700 hover:underline"
                        >
                          Open in CRM
                        </a>
                        <button
                          type="button"
                          onClick={() => setCrmOpen(true)}
                          className="text-xs text-slate-500 hover:text-sky-700 hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCrmOpen(true)}
                        className="text-sm text-sky-700 hover:underline"
                      >
                        Link CRM contact
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <dt className="mb-1 text-[11px] text-slate-400">Source</dt>
                  <dd className="text-sm text-slate-800">
                    {resolveProspectSourceLabel(prospect)}
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-[11px] text-slate-400">Status</dt>
                  <dd>
                    <ProspectStatusCell
                      row={prospect}
                      editable
                      saving={saving}
                      onSave={(prospect_status) =>
                        handleUpdate({ prospect_status })
                      }
                    />
                  </dd>
                </div>
              </dl>
            </section>
          </aside>

          {/* Middle: activity + conversations */}
          <section className="min-h-[28rem] min-w-0">
            <ProspectActivityFeed
              contactId={contactId}
              conversationsHref={conversationsHref}
              isAdmin={isAdmin}
              impersonateCoachId={impersonatingCoachId}
            />
          </section>

          {/* Right: assessments, calls, links */}
          <aside className="flex flex-col gap-4 lg:col-span-2 xl:col-span-1">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                Next action
              </h3>
              <div className="mt-3">
                <ProspectNextActionCell
                  nextAction={prospect.next_action}
                  editable
                  saving={saving}
                  onSave={(values) =>
                    handleUpdate({
                      next_action: values,
                    })
                  }
                />
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Calls</h3>
              {prospect.next_call?.start_time ? (
                <div className="mt-3 space-y-1 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">
                    {getProspectNextCallName(prospect.next_call)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatProspectNextCallWhen(prospect.next_call)}
                    {" · "}
                    {getProspectNextCallStatusLabel(
                      prospect.next_call.status_normalized
                    )}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No upcoming call.</p>
              )}
              <Link
                href={callsHref}
                className="mt-3 inline-flex text-xs font-medium text-sky-700 hover:underline"
              >
                Open Calls
              </Link>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                Assessments
              </h3>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="text-[11px] text-slate-400">Boss Score</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">
                    {prospect.boss_score != null
                      ? `${Math.round(prospect.boss_score)}%`
                      : "—"}
                    {prospect.boss_score_at ? (
                      <span className="text-slate-400">
                        {" "}
                        · {formatProspectLastAssessed(prospect.boss_score_at)}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">Boss Pro</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">
                    {prospect.boss_score_premium != null
                      ? Math.round(prospect.boss_score_premium)
                      : "—"}
                    {prospect.boss_score_premium_at ? (
                      <span className="text-slate-400">
                        {" "}
                        ·{" "}
                        {formatProspectLastAssessed(
                          prospect.boss_score_premium_at
                        )}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">Revenue</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">
                    {prospect.revenue || (
                      <span className="text-slate-400">—</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">Team</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">
                    {prospect.team_size || (
                      <span className="text-slate-400">—</span>
                    )}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {prospect.boss_score_report_token ? (
                  <button
                    type="button"
                    onClick={() => setGlanceOpen(true)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-sky-900 hover:border-sky-300 hover:bg-sky-50"
                  >
                    Scorecard glance
                  </button>
                ) : null}
                <Link
                  href={bossHref}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-sky-900 hover:border-sky-300 hover:bg-sky-50"
                >
                  Boss Pro
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Links</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {scorecardLink ? (
                  <li>
                    <a
                      href={scorecardLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-700 hover:underline"
                    >
                      Boss Score invite
                    </a>
                  </li>
                ) : null}
                {bossProLink ? (
                  <li>
                    <a
                      href={bossProLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-700 hover:underline"
                    >
                      Boss Pro invite
                    </a>
                  </li>
                ) : null}
                {crmUrl ? (
                  <li>
                    <a
                      href={crmUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-700 hover:underline"
                    >
                      Open in CRM
                    </a>
                  </li>
                ) : (
                  <li>
                    <button
                      type="button"
                      onClick={() => setCrmOpen(true)}
                      className="text-sky-700 hover:underline"
                    >
                      Link CRM contact
                    </button>
                  </li>
                )}
                {crmUrl ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => setCrmOpen(true)}
                      className="text-slate-600 hover:underline"
                    >
                      Change CRM link
                    </button>
                  </li>
                ) : null}
              </ul>
            </section>
          </aside>
        </div>
      )}

      <ProspectCrmLinkModal
        prospect={crmOpen ? prospect : null}
        saving={saving}
        onClose={() => setCrmOpen(false)}
        onSave={async (crmContactId) => {
          await handleUpdate({ crm_contact_id: crmContactId });
          setCrmOpen(false);
        }}
      />
      <ScorecardGlanceModal
        contactId={glanceOpen && prospect ? prospect.id : null}
        onClose={() => setGlanceOpen(false)}
      />
    </div>
  );
}
