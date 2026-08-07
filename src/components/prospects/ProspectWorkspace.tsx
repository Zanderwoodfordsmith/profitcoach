"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ProspectContactEditModal } from "@/components/prospects/ProspectContactEditModal";
import { ProspectCrmLinkModal } from "@/components/prospects/ProspectCrmLinkModal";
import { ProspectNextActionCell } from "@/components/prospects/ProspectNextActionCell";
import { ProspectStatusCell } from "@/components/prospects/ProspectStatusCell";
import { ScorecardGlanceModal } from "@/components/scorecard/ScorecardGlanceModal";
import {
  buildPersonalisedAssessmentLink,
  buildPersonalisedAssessmentProLink,
} from "@/lib/assessmentContactParams";
import { formatPhoneDisplay, phoneToTelHref } from "@/lib/formatPhoneDisplay";
import { getProspectCrmContactUrl } from "@/lib/ghlContactWebhook";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";
import { formatProspectPersonName } from "@/lib/prospectDisplayFormat";
import {
  formatProspectLastAssessed,
  formatProspectNextCallWhen,
  getProspectNextCallName,
  getProspectNextCallStatusLabel,
} from "@/lib/prospectNextCall";
import type { ProspectRow } from "@/lib/prospectRow";
import { applyProspectPatch } from "@/lib/prospects/applyProspectPatch";
import type {
  ProspectFieldPatch,
  UpdatedProspectFields,
} from "@/lib/prospects/updateProspectFields";
import { splitFullName } from "@/lib/splitFullName";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

type Props = {
  contactId: string;
};

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
  const [editOpen, setEditOpen] = useState(false);
  const [crmOpen, setCrmOpen] = useState(false);
  const [glanceOpen, setGlanceOpen] = useState(false);

  const backHref = isAdmin ? "/admin/prospects" : "/coach/prospects";
  const pipelineHref = isAdmin ? "/admin/pipeline" : "/coach/pipeline";
  const callsHref = isAdmin ? "/admin/calls" : "/coach/calls";

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
    <div className="flex flex-col gap-4">
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
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Prospect
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                  {displayName}
                </h2>
                {prospect.job_title?.trim() ? (
                  <p className="mt-1 text-sm text-slate-600">
                    {prospect.job_title.trim()}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/50"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit
              </button>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Business
                </dt>
                <dd className="mt-0.5 text-sm text-slate-800">
                  {prospect.business_name?.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Email
                </dt>
                <dd className="mt-0.5 text-sm text-slate-800">
                  {prospect.email?.trim() ? (
                    <a
                      href={`mailto:${prospect.email.trim()}`}
                      className="text-sky-700 hover:underline"
                    >
                      {prospect.email.trim()}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Phone
                </dt>
                <dd className="mt-0.5 text-sm text-slate-800">
                  {prospect.phone?.trim() ? (
                    <a
                      href={phoneToTelHref(prospect.phone) ?? undefined}
                      className="text-sky-700 hover:underline"
                    >
                      {formatPhoneDisplay(prospect.phone)}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  LinkedIn
                </dt>
                <dd className="mt-0.5 text-sm text-slate-800">
                  {prospect.linkedin_url?.trim() ? (
                    <a
                      href={prospect.linkedin_url.trim()}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                    >
                      View profile
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </dt>
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

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Next action</h3>
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

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Calls</h3>
            {prospect.next_call?.start_time ? (
              <div className="mt-3 space-y-1 text-sm text-slate-700">
                <p className="font-medium text-slate-900">
                  {getProspectNextCallName(prospect.next_call)}
                </p>
                <p>
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
              className="mt-4 inline-flex text-sm font-medium text-sky-700 hover:underline"
            >
              Open Calls
            </Link>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              Assessments
            </h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Boss Score
                </dt>
                <dd className="mt-0.5 text-sm text-slate-800">
                  {prospect.boss_score != null
                    ? `${Math.round(prospect.boss_score)}%`
                    : "—"}
                  {prospect.boss_score_at ? (
                    <span className="text-slate-500">
                      {" "}
                      · {formatProspectLastAssessed(prospect.boss_score_at)}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Boss Pro
                </dt>
                <dd className="mt-0.5 text-sm text-slate-800">
                  {prospect.boss_score_premium != null
                    ? Math.round(prospect.boss_score_premium)
                    : "—"}
                  {prospect.boss_score_premium_at ? (
                    <span className="text-slate-500">
                      {" "}
                      ·{" "}
                      {formatProspectLastAssessed(
                        prospect.boss_score_premium_at
                      )}
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
            {(prospect.revenue ||
              prospect.team_size ||
              prospect.outcome) && (
              <dl className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                {prospect.revenue ? (
                  <div>
                    <dt className="text-xs text-slate-500">Revenue</dt>
                    <dd className="text-slate-800">{prospect.revenue}</dd>
                  </div>
                ) : null}
                {prospect.team_size ? (
                  <div>
                    <dt className="text-xs text-slate-500">Team</dt>
                    <dd className="text-slate-800">{prospect.team_size}</dd>
                  </div>
                ) : null}
                {prospect.outcome ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Outcome</dt>
                    <dd className="text-slate-800">{prospect.outcome}</dd>
                  </div>
                ) : null}
              </dl>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {prospect.boss_score_report_token ? (
                <button
                  type="button"
                  onClick={() => setGlanceOpen(true)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50/40"
                >
                  Scorecard glance
                </button>
              ) : null}
              <Link
                href={bossHref}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50/40"
              >
                Open Boss Pro
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                    Boss Score invite link
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
                    Boss Pro assessment link
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
        </div>
      )}

      <ProspectContactEditModal
        prospect={editOpen ? prospect : null}
        saving={saving}
        onClose={() => setEditOpen(false)}
        onSave={handleUpdate}
      />
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
