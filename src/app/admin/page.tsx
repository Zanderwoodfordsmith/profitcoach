"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type CoachRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
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
  const [sendInvite, setSendInvite] = useState(true);

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

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

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
    } catch (err: any) {
      setCreateError(err?.message ?? "Unable to create coach.");
    } finally {
      setCreatingCoach(false);
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Coach</th>
              <th className="px-4 py-2">Business</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2">Landing link</th>
              <th className="px-4 py-2 text-center min-w-[7rem]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coaches.map((coach) => {
              const link = origin
                ? `${origin}/landing/a?coach=${encodeURIComponent(coach.slug)}`
                : `/landing/a?coach=${encodeURIComponent(coach.slug)}`;
              return (
                <tr
                  key={coach.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-2 text-slate-900">
                    {coach.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {coach.coach_business_name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {coach.slug}
                  </td>
                  <td className="px-4 py-2 text-xs text-sky-700">
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {link}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setImpersonatingCoachId(coach.id);
                        router.push("/coach");
                      }}
                      className="rounded-md bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-200"
                    >
                      View as coach
                    </button>
                  </td>
                </tr>
              );
            })}
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-3 text-sm text-slate-600"
                >
                  Loading coaches…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

