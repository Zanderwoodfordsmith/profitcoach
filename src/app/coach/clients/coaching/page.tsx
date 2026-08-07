"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ClientCoachingWorkspace } from "@/components/clientCoaching/ClientCoachingWorkspace";
import { CoachClientHubGate } from "@/components/coach/CoachClientHubGate";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  clientWorkspacePath,
  LAST_CLIENT_WORKSPACE_KEY,
} from "@/lib/clientCoaching/defaults";
import { parseClientWorkspaceTab } from "@/lib/clientCoaching/normalize";
import { supabaseClient } from "@/lib/supabaseClient";

type ClientOption = { id: string; fullName: string; businessName: string | null };

function CoachingHubInner() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const tab = parseClientWorkspaceTab(searchParams.get("tab"));
  const contactFromUrl = searchParams.get("contact")?.trim() || null;
  const { impersonatingCoachId } = useImpersonation();
  const isAdminPath = pathname.startsWith("/admin");
  const clientsListHref = isAdminPath ? "/admin/clients" : "/coach/clients";

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(contactFromUrl);

  useEffect(() => {
    setSelectedId(contactFromUrl);
  }, [contactFromUrl]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        router.replace("/login");
        return;
      }
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }
      const res = await fetch("/api/coach/clients", { headers });
      if (cancelled) return;
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Unable to load clients.");
        setLoading(false);
        return;
      }
      const body = (await res.json()) as {
        clients?: {
          id: string;
          full_name: string;
          business_name?: string | null;
        }[];
      };
      const options: ClientOption[] = (body.clients ?? []).map((c) => ({
        id: c.id,
        fullName: c.full_name ?? "Client",
        businessName: c.business_name ?? null,
      }));
      setClients(options);
      setLoading(false);

      if (!contactFromUrl) {
        try {
          const last = window.localStorage.getItem(LAST_CLIENT_WORKSPACE_KEY);
          if (last && options.some((c) => c.id === last)) {
            router.replace(
              clientWorkspacePath(last, tab, { admin: isAdminPath })
            );
          }
        } catch {
          /* ignore */
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [contactFromUrl, impersonatingCoachId, isAdminPath, router, tab]);

  function chooseClient(id: string) {
    setSelectedId(id);
    try {
      window.localStorage.setItem(LAST_CLIENT_WORKSPACE_KEY, id);
    } catch {
      /* ignore */
    }
    router.push(clientWorkspacePath(id, tab, { admin: isAdminPath }));
  }

  if (selectedId || contactFromUrl) {
    const id = selectedId ?? contactFromUrl;
    if (id) {
      return <ClientCoachingWorkspace contactId={id} />;
    }
  }

  return (
    <CoachClientHubGate>
      <div className="flex flex-col gap-4">
        <StickyPageHeader
          title="Coach Clients"
          description="Pick a client to open their coaching workspace."
          below={<CoachToolsHubTabs hub="coach-clients" />}
        />

        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {!loading && !error ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Select a client
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Coaching tools are per client. Choose one to continue
              {tab !== "overview" ? (
                <>
                  {" "}
                  into <span className="font-medium text-slate-800">{tab}</span>
                </>
              ) : null}
              .
            </p>
            {clients.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No clients on this account yet.{" "}
                <Link
                  href={clientsListHref}
                  className="text-sky-700 hover:underline"
                >
                  Add one on the Clients tab
                </Link>
                {isAdminPath
                  ? " — assign it to yourself to demo without impersonating."
                  : null}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {clients.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => chooseClient(c.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-sky-50/60"
                    >
                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          {c.fullName}
                        </span>
                        {c.businessName ? (
                          <span className="block text-xs text-slate-500">
                            {c.businessName}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs font-medium text-sky-700">
                        Open →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </CoachClientHubGate>
  );
}

export default function CoachClientsCoachingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      }
    >
      <CoachingHubInner />
    </Suspense>
  );
}
