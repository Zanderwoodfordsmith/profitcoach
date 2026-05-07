"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { ExternalLink } from "lucide-react";

import { LADDER_LEVELS, ladderAdminSelectLabel } from "@/lib/ladder";

const CRM_LOCATION_BASE_URL = "https://app.procoachplatform.com/v2/location";

function ladderLevelShortName(id: string | null | undefined): string | null {
  if (!id?.trim()) return null;
  return LADDER_LEVELS.find((l) => l.id === id)?.name ?? id;
}

function formatGoalDateDisplay(iso: string): string {
  const t = Date.parse(`${iso}T12:00:00`);
  if (Number.isNaN(t)) return iso;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(t);
}

function ReadonlyLadderLevelCell({
  levelId,
}: {
  levelId: string | null | undefined;
}) {
  const short = ladderLevelShortName(levelId);
  if (!short) {
    return <span className="text-xs text-slate-400">Not set</span>;
  }
  const lvl = LADDER_LEVELS.find((l) => l.id === levelId);
  return (
    <span
      className="block truncate text-xs text-slate-800"
      title={lvl ? ladderAdminSelectLabel(lvl) : short}
    >
      {short}
    </span>
  );
}

type CoachRow = {
  id: string;
  slug: string;
  full_name: string | null;
  avatar_url: string | null;
  coach_business_name: string | null;
  directory_listed: boolean;
  directory_level: string | null;
  /** Admin-only: outbound webhook fired with prospect contact info + score. */
  lead_webhook_url: string | null;
  /** Human-readable CRM account/profile label (e.g. AMF Consulting). */
  crm_profile_name: string | null;
  /** CRM location id appended to Pro Coach Platform location URL. */
  crm_location_id: string | null;
  ladder_level: string | null;
  ladder_goal_level: string | null;
  ladder_goal_target_date: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const { setImpersonatingCoachId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [checkingRole, setCheckingRole] = useState(true);
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [creatingCoach, setCreatingCoach] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [newFullName, setNewFullName] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [coachSearchTerm, setCoachSearchTerm] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [directorySavingId, setDirectorySavingId] = useState<string | null>(
    null
  );
  const [deletingCoachId, setDeletingCoachId] = useState<string | null>(null);
  const [webhookEditCoachId, setWebhookEditCoachId] = useState<string | null>(
    null
  );
  const [crmProfileNameValue, setCrmProfileNameValue] = useState("");
  const [crmLocationIdValue, setCrmLocationIdValue] = useState("");
  const [webhookEditValue, setWebhookEditValue] = useState("");
  const [webhookEditError, setWebhookEditError] = useState<string | null>(null);
  const [webhookEditSaving, setWebhookEditSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setCheckingRole(true);
      setError(null);

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
        error?: string;
      };
      if (!roleRes.ok || !roleBody.role) {
        setError("Unable to load your profile.");
        setCheckingRole(false);
        return;
      }
      if (roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }

      setCheckingRole(false);
      setLoading(true);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setError("Unable to load coaches.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/admin/coaches", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const body = (await res.json().catch(() => ({}))) as {
        coaches?: CoachRow[];
        error?: string;
      };

      if (cancelled) return;

      if (!res.ok) {
        setError(body?.error ?? "Unable to load coaches.");
        setLoading(false);
        return;
      }

      setCoaches(body.coaches ?? []);
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function patchCoachRow(
    coachId: string,
    body: {
      directory_listed?: boolean;
      directory_level?: string | null;
      ladder_level?: string | null;
      ladder_goal_level?: string | null;
      ladder_goal_target_date?: string | null;
      lead_webhook_url?: string | null;
      crm_profile_name?: string | null;
      crm_location_id?: string | null;
    }
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      return { ok: false, error: "Not signed in." };
    }
    setDirectorySavingId(coachId);
    try {
      const res = await fetch(`/api/admin/coaches/${coachId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errBody.error ?? "Update failed.");
      }
      setCoaches((prev) =>
        prev.map((c) =>
          c.id === coachId
            ? {
                ...c,
                ...(body.directory_listed !== undefined
                  ? { directory_listed: body.directory_listed }
                  : {}),
                ...(body.directory_level !== undefined
                  ? { directory_level: body.directory_level }
                  : {}),
                ...(body.ladder_level !== undefined
                  ? { ladder_level: body.ladder_level }
                  : {}),
                ...(body.ladder_goal_level !== undefined
                  ? { ladder_goal_level: body.ladder_goal_level }
                  : {}),
                ...(body.ladder_goal_target_date !== undefined
                  ? { ladder_goal_target_date: body.ladder_goal_target_date }
                  : {}),
                ...(body.lead_webhook_url !== undefined
                  ? { lead_webhook_url: body.lead_webhook_url }
                  : {}),
                ...(body.crm_profile_name !== undefined
                  ? { crm_profile_name: body.crm_profile_name }
                  : {}),
                ...(body.crm_location_id !== undefined
                  ? { crm_location_id: body.crm_location_id }
                  : {}),
              }
            : c
        )
      );
      return { ok: true };
    } catch (e) {
      console.error(e);
      const msg = (e as Error)?.message ?? "Could not update coach.";
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setDirectorySavingId(null);
    }
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const normalizedCoachSearchTerm = coachSearchTerm.trim().toLowerCase();
  const filteredCoaches = normalizedCoachSearchTerm
    ? coaches.filter((coach) =>
        (coach.full_name ?? "").toLowerCase().includes(normalizedCoachSearchTerm)
      )
    : coaches;

  async function handleCreateCoach(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreatingCoach(true);

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You must be signed in to create a coach.");
      }

      const res = await fetch("/api/admin/coaches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fullName: newFullName,
          businessName: newBusinessName,
          email: newEmail,
          slug: newSlug,
          invite: sendInvite,
          password: sendInvite ? undefined : newPassword,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body?.error ?? "Unable to create coach.");
      }

      setCreateSuccess(
        sendInvite
          ? "Coach created and invite email requested."
          : "Coach created successfully."
      );
      setNewFullName("");
      setNewBusinessName("");
      setNewEmail("");
      setNewSlug("");
      setNewPassword("");

      // Reload coaches list
      const listRes = await fetch("/api/admin/coaches", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const listBody = (await listRes.json().catch(() => ({}))) as {
        coaches?: CoachRow[];
      };
      if (listRes.ok && listBody.coaches) {
        setCoaches(listBody.coaches);
      }
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error ? err.message : "Unable to create coach."
      );
    } finally {
      setCreatingCoach(false);
    }
  }

  async function handleDeleteCoach(coach: CoachRow) {
    const label = coach.full_name?.trim() || coach.slug;
    if (
      !window.confirm(
        `Delete coach profile for "${label}"? This removes their account and related coach data. This cannot be undone.`
      )
    ) {
      return;
    }

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setError("You must be signed in to delete a coach.");
      return;
    }

    setDeletingCoachId(coach.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coaches/${coach.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to delete coach.");
      }
      setCoaches((prev) => prev.filter((c) => c.id !== coach.id));
    } catch (e) {
      setError((e as Error)?.message ?? "Unable to delete coach.");
    } finally {
      setDeletingCoachId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Coaches"
        tabs={<CoachesHubTabs />}
        actions={
          <button
            type="button"
            onClick={() => {
              setShowAddCoach(true);
              setCreateError(null);
              setCreateSuccess(null);
            }}
            className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
          >
            + Add coach
          </button>
        }
      />

      {checkingRole ? (
        <p className="text-sm text-slate-600">Checking access…</p>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : null}

      {!checkingRole && !loading && coaches.length === 0 && !error ? (
        <p className="text-sm text-slate-600">
          No coaches found yet. Use the{" "}
          <span className="font-semibold">Add coach</span> button above
          to invite or create your first coach.
        </p>
      ) : null}

      {showAddCoach && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Add coach
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Create a coach account and either send them an invite
                email to set their own password, or set a password
                manually.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAddCoach(false);
                setCreateError(null);
                setCreateSuccess(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>

          <form
            onSubmit={handleCreateCoach}
            className="mt-4 grid gap-3 md:grid-cols-2"
          >
            <div className="space-y-1">
              <label
                htmlFor="coachFullName"
                className="block text-xs font-medium text-slate-700"
              >
                Full name
              </label>
              <input
                id="coachFullName"
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="coachBusinessName"
                className="block text-xs font-medium text-slate-700"
              >
                Coaching business name
              </label>
              <input
                id="coachBusinessName"
                type="text"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="coachEmail"
                className="block text-xs font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="coachEmail"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="coachSlug"
                className="block text-xs font-medium text-slate-700"
              >
                Coach link slug
              </label>
              <input
                id="coachSlug"
                type="text"
                required
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                placeholder="e.g. alex-smith"
              />
              <p className="text-[0.7rem] text-slate-500">
                Their landing link will be e.g.{" "}
                <code>/landing/a?coach=alex-smith</code>. Use only lowercase
                letters, numbers, and hyphens.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={sendInvite}
                    onChange={(e) => setSendInvite(e.target.checked)}
                  />
                  <span>Send invite email so the coach sets their own password</span>
                </label>
              </div>
              {!sendInvite && (
                <div className="space-y-1 md:max-w-xs">
                  <label
                    htmlFor="coachPassword"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Temporary password
                  </label>
                  <input
                    id="coachPassword"
                    type="password"
                    required={!sendInvite}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <p className="text-[0.7rem] text-slate-500">
                    Share this password with the coach out of band. They
                    can change it later.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-2 md:col-span-2 md:flex-row md:items-center md:justify-between">
              <div className="space-x-2">
                <button
                  type="submit"
                  disabled={creatingCoach}
                  className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:cursor-wait disabled:opacity-70"
                >
                  {creatingCoach ? "Creating coach…" : "Create coach"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCoach(false);
                    setCreateError(null);
                    setCreateSuccess(null);
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
              <div className="text-xs">
                {createError && (
                  <p className="text-rose-600" role="alert">
                    {createError}
                  </p>
                )}
                {createSuccess && (
                  <p className="text-emerald-600" role="status">
                    {createSuccess}
                  </p>
                )}
              </div>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <label
            htmlFor="coach-search"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Search coaches
          </label>
          <input
            id="coach-search"
            type="search"
            value={coachSearchTerm}
            onChange={(e) => setCoachSearchTerm(e.target.value)}
            placeholder="Search by coach name"
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="sticky top-0 z-10 w-14 bg-slate-50 px-2 py-2 text-center" aria-label="Avatar" />
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-2">Coach</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2">Slug</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2 text-center">Dir.</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2">Cert.</th>
              <th className="sticky top-0 z-10 w-24 max-w-[6.5rem] bg-slate-50 px-2 py-2">Current</th>
              <th className="sticky top-0 z-10 w-24 max-w-[6.5rem] bg-slate-50 px-2 py-2">Ideal</th>
              <th className="sticky top-0 z-10 w-28 bg-slate-50 px-2 py-2">Goal by</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2">CRM</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2">Lead webhook</th>
              <th className="sticky top-0 z-10 w-10 bg-slate-50 px-1 py-2 text-center" aria-label="Landing" />
              <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2 text-center">View as</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2 text-center">Delete</th>
            </tr>
          </thead>
          <tbody>
            {filteredCoaches.map((coach) => {
              const link = origin
                ? `${origin}/landing/a?coach=${encodeURIComponent(coach.slug)}`
                : `/landing/a?coach=${encodeURIComponent(coach.slug)}`;
              const crmLink = coach.crm_location_id?.trim()
                ? `${CRM_LOCATION_BASE_URL}/${encodeURIComponent(
                    coach.crm_location_id
                  )}`
                : null;
              return (
                <tr
                  key={coach.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-2 py-2 align-middle">
                    {coach.avatar_url ? (
                      <img
                        src={coach.avatar_url}
                        alt=""
                        className="mx-auto h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div
                        className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium text-slate-400 ring-1 ring-slate-200"
                        aria-hidden
                      >
                        —
                      </div>
                    )}
                  </td>
                  <td className="w-max whitespace-nowrap px-4 py-2 font-medium text-slate-900">
                    {coach.full_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    {coach.slug}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      title="Listed in public directory"
                      checked={coach.directory_listed}
                      disabled={directorySavingId === coach.id}
                      onChange={(e) =>
                        void patchCoachRow(coach.id, {
                          directory_listed: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <select
                      title="Certification level (admin only)"
                      value={coach.directory_level ?? ""}
                      disabled={directorySavingId === coach.id}
                      onChange={(e) => {
                        const v = e.target.value;
                        void patchCoachRow(coach.id, {
                          directory_level: v === "" ? null : v,
                        });
                      }}
                      className="max-w-full cursor-pointer border-0 border-b border-dotted border-slate-300 bg-transparent py-0.5 pl-0 pr-1 text-xs text-slate-800 shadow-none ring-0 hover:border-slate-500 focus:border-solid focus:border-sky-500 focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Not set</option>
                      <option value="certified">Certified</option>
                      <option value="professional">Professional</option>
                      <option value="elite">Elite</option>
                    </select>
                  </td>
                  <td className="max-w-[6.5rem] px-2 py-2 align-middle">
                    <ReadonlyLadderLevelCell levelId={coach.ladder_level} />
                  </td>
                  <td className="max-w-[6.5rem] px-2 py-2 align-middle">
                    <ReadonlyLadderLevelCell levelId={coach.ladder_goal_level} />
                  </td>
                  <td className="px-2 py-2 align-middle text-xs text-slate-700">
                    {coach.ladder_goal_target_date ? (
                      formatGoalDateDisplay(coach.ladder_goal_target_date)
                    ) : (
                      <span className="text-slate-400">Not set</span>
                    )}
                  </td>
                  <td className="max-w-[16rem] px-2 py-2 align-middle">
                    <button
                      type="button"
                      onClick={() => {
                        setWebhookEditCoachId(coach.id);
                        setCrmProfileNameValue(coach.crm_profile_name ?? "");
                        setCrmLocationIdValue(coach.crm_location_id ?? "");
                        setWebhookEditValue(coach.lead_webhook_url ?? "");
                        setWebhookEditError(null);
                      }}
                      className="block w-full rounded px-1 py-0.5 text-left hover:bg-slate-100"
                      title="Edit CRM details"
                    >
                      {coach.crm_profile_name?.trim() ? (
                        <span className="block truncate text-xs font-medium text-slate-700">
                          {coach.crm_profile_name}
                        </span>
                      ) : (
                        <span className="block text-xs text-slate-400">
                          Not set
                        </span>
                      )}
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {coach.crm_location_id?.trim() || "No location ID"}
                      </span>
                    </button>
                    {crmLink ? (
                      <a
                        href={crmLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate px-1 text-[11px] text-sky-700 hover:underline"
                        title={crmLink}
                      >
                        <span className="truncate">Open CRM</span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                      </a>
                    ) : null}
                  </td>
                  <td className="max-w-[14rem] px-2 py-2 align-middle">
                    <button
                      type="button"
                      onClick={() => {
                        setWebhookEditCoachId(coach.id);
                        setCrmProfileNameValue(coach.crm_profile_name ?? "");
                        setCrmLocationIdValue(coach.crm_location_id ?? "");
                        setWebhookEditValue(coach.lead_webhook_url ?? "");
                        setWebhookEditError(null);
                      }}
                      className="block w-full max-w-[14rem] truncate rounded px-1 py-0.5 text-left text-xs underline-offset-2 hover:bg-slate-100 hover:underline"
                      title={
                        coach.lead_webhook_url
                          ? `Edit lead webhook (${coach.lead_webhook_url})`
                          : "Set lead webhook URL"
                      }
                    >
                      {coach.lead_webhook_url ? (
                        <span className="text-slate-700">
                          {coach.lead_webhook_url}
                        </span>
                      ) : (
                        <span className="text-slate-400">Not set</span>
                      )}
                    </button>
                  </td>
                  <td className="px-1 py-2 text-center align-middle">
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-sky-700"
                      title="Open landing page"
                      aria-label={`Landing page for ${coach.slug}`}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </a>
                  </td>
                  <td className="px-2 py-2 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => {
                        setImpersonatingCoachId(coach.id);
                        router.push("/coach");
                      }}
                      className="rounded px-2 py-1 text-xs text-slate-500 underline-offset-2 hover:bg-slate-100 hover:text-slate-800 hover:underline"
                    >
                      View as coach
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => void handleDeleteCoach(coach)}
                      disabled={deletingCoachId === coach.id}
                      className="rounded px-2 py-1 text-xs text-rose-600 underline-offset-2 hover:bg-rose-50 hover:text-rose-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingCoachId === coach.id ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {loading && (
              <tr>
                <td
                  colSpan={13}
                  className="px-4 py-3 text-sm text-slate-600"
                >
                  Loading coaches…
                </td>
              </tr>
            )}
            {!loading && !error && filteredCoaches.length === 0 ? (
              <tr>
                <td
                  colSpan={13}
                  className="px-4 py-3 text-sm text-slate-600"
                >
                  No coaches match that name.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      </section>

      {webhookEditCoachId && (
        <div
          role="dialog"
          aria-modal
          aria-label="Edit CRM and lead webhook"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !webhookEditSaving) {
              setWebhookEditCoachId(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">
              CRM + lead webhook
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Admin only. The coach does not see this field. Profit Coach POSTs
              prospect contact info here as soon as we have an email, and again
              with the BOSS score when the assessment finishes.
            </p>
            <label
              htmlFor="crm-profile-name"
              className="mt-4 block text-xs font-medium text-slate-700"
            >
              CRM profile name
            </label>
            <input
              id="crm-profile-name"
              type="text"
              value={crmProfileNameValue}
              onChange={(e) => setCrmProfileNameValue(e.target.value)}
              placeholder="AMF Consulting"
              disabled={webhookEditSaving}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
            />
            <label
              htmlFor="crm-location-id"
              className="mt-3 block text-xs font-medium text-slate-700"
            >
              CRM location ID
            </label>
            <input
              id="crm-location-id"
              type="text"
              value={crmLocationIdValue}
              onChange={(e) => setCrmLocationIdValue(e.target.value)}
              placeholder="BsRxKtV0lVHcvvZ6qHtu"
              disabled={webhookEditSaving}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
            />
            <p className="mt-2 text-[0.7rem] text-slate-500">
              Coach CRM link is built as{" "}
              <code>{CRM_LOCATION_BASE_URL}/&lt;location-id&gt;</code>.
            </p>
            <label
              htmlFor="lead-webhook-url"
              className="mt-4 block text-xs font-medium text-slate-700"
            >
              Lead webhook URL
            </label>
            <input
              id="lead-webhook-url"
              type="url"
              autoFocus
              value={webhookEditValue}
              onChange={(e) => setWebhookEditValue(e.target.value)}
              placeholder="https://hooks.example.com/coach-leads"
              disabled={webhookEditSaving}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
            />
            <p className="mt-2 text-[0.7rem] text-slate-500">
              Leave blank to disable. Must start with <code>http://</code> or{" "}
              <code>https://</code>.
            </p>
            {webhookEditError ? (
              <p className="mt-2 text-xs text-rose-600" role="alert">
                {webhookEditError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!webhookEditSaving) setWebhookEditCoachId(null);
                }}
                disabled={webhookEditSaving}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!webhookEditCoachId) return;
                  const trimmed = webhookEditValue.trim();
                  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
                    setWebhookEditError(
                      "URL must start with http:// or https://."
                    );
                    return;
                  }
                  setWebhookEditError(null);
                  setWebhookEditSaving(true);
                  const trimmedProfileName = crmProfileNameValue.trim();
                  const trimmedLocationId = crmLocationIdValue.trim();
                  const result = await patchCoachRow(webhookEditCoachId, {
                    crm_profile_name:
                      trimmedProfileName === "" ? null : trimmedProfileName,
                    crm_location_id:
                      trimmedLocationId === "" ? null : trimmedLocationId,
                    lead_webhook_url: trimmed === "" ? null : trimmed,
                  });
                  setWebhookEditSaving(false);
                  if (result.ok) {
                    setWebhookEditCoachId(null);
                  } else {
                    setWebhookEditError(result.error);
                  }
                }}
                disabled={webhookEditSaving}
                className="inline-flex items-center rounded-full bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 disabled:cursor-wait disabled:opacity-60"
              >
                {webhookEditSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

