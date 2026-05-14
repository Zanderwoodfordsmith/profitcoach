"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useBossWorkshopChrome } from "@/contexts/BossWorkshopChromeContext";
import { StickyPageHeader } from "@/components/layout";
import { ContactBossWorkshopBody } from "@/components/coach/ContactBossWorkshopBody";

type PickRow = {
  id: string;
  full_name: string;
  business_name: string | null;
  type: string;
  coach_name?: string | null;
};

export default function CoachWorkshopPage() {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const chrome = useBossWorkshopChrome();
  const isMinimalChrome = chrome?.isMinimalWorkshopChrome ?? false;
  const [contacts, setContacts] = useState<PickRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUnscoped, setAdminUnscoped] = useState(false);
  const [draftCoachId, setDraftCoachId] = useState<string | null>(null);
  const [workshopMode, setWorkshopMode] = useState(true);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("contact");
    if (q) setSelectedId(q);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profileError) {
        setError("Unable to load your profile.");
        setDraftCoachId(null);
        setLoading(false);
        return;
      }

      const isAdminUnscoped = profile.role === "admin" && !impersonatingCoachId;
      if (isAdminUnscoped) {
        setAdminUnscoped(true);
        setDraftCoachId(null);
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          router.replace("/login");
          return;
        }
        const res = await fetch("/api/admin/contacts", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          prospects?: Array<{
            id: string;
            full_name: string;
            business_name: string | null;
            type: string;
            coach_name?: string | null;
          }>;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? "Unable to load contacts.");
          setLoading(false);
          return;
        }
        const rows = body.prospects ?? [];
        const mapped = rows.map((r) => ({
          id: r.id,
          full_name: r.full_name,
          business_name: r.business_name ?? null,
          type: r.type,
          coach_name: r.coach_name ?? null,
        }));
        mapped.sort((a, b) => a.full_name.localeCompare(b.full_name));
        setContacts(mapped);
        setLoading(false);
        return;
      }

      setAdminUnscoped(false);
      const effectiveCoachId =
        profile.role === "admin" && impersonatingCoachId
          ? impersonatingCoachId
          : user.id;
      setDraftCoachId(effectiveCoachId);

      const { data: rows, error: listError } = await supabaseClient
        .from("contacts")
        .select("id, full_name, business_name, type")
        .eq("coach_id", effectiveCoachId)
        .order("full_name", { ascending: true });

      if (cancelled) return;

      if (listError) {
        setError("Unable to load contacts.");
        setLoading(false);
        return;
      }

      setContacts((rows ?? []) as PickRow[]);
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId]);

  useEffect(() => {
    if (loading) return;
    if (!selectedId) return;
    if (!contacts.length) return;
    if (!contacts.some((c) => c.id === selectedId)) {
      setSelectedId("");
      const url = new URL(window.location.href);
      url.searchParams.delete("contact");
      window.history.replaceState({}, "", url.toString());
    }
  }, [loading, contacts, selectedId]);

  const selected = contacts.find((c) => c.id === selectedId);

  const handleDraftContactCreated = useCallback((id: string) => {
    const label = `Workshop — ${new Date().toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })}`;
    setContacts((prev) => {
      if (prev.some((c) => c.id === id)) return prev;
      return [
        {
          id,
          full_name: label,
          business_name: null,
          type: "prospect",
          coach_name: null,
        },
        ...prev,
      ];
    });
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("contact", id);
    window.history.replaceState({}, "", url.toString());
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = "BOSS score";
    return () => {
      document.title = prev;
    };
  }, []);

  const clientsHref = adminUnscoped ? "/admin/clients" : "/coach/clients";
  const clientsLabel = adminUnscoped ? "Admin clients" : "Clients";

  const setWorkshopTopRight = chrome?.setWorkshopTopRight;
  const registerMinimalSlot = chrome?.isMinimalWorkshopChrome;

  useEffect(() => {
    if (!setWorkshopTopRight) return;
    if (!registerMinimalSlot) {
      setWorkshopTopRight(null);
      return;
    }
    if (loading) {
      setWorkshopTopRight(
        <p className="text-xs text-slate-600">Loading contacts…</p>
      );
      return () => setWorkshopTopRight(null);
    }
    if (error) {
      setWorkshopTopRight(<p className="text-xs text-rose-600">{error}</p>);
      return () => setWorkshopTopRight(null);
    }

    setWorkshopTopRight(
      <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2 text-left shadow-md backdrop-blur-sm">
        <label
          htmlFor="workshop-contact-top-slot"
          className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500"
        >
          Who are you working with?
        </label>
        <select
          id="workshop-contact-top-slot"
          className="mt-1 w-full min-w-[12rem] max-w-[min(100vw-2.5rem,20rem)] rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
          value={selectedId}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedId(v);
            const url = new URL(window.location.href);
            if (v) url.searchParams.set("contact", v);
            else url.searchParams.delete("contact");
            window.history.replaceState({}, "", url.toString());
          }}
        >
          <option value="">Blank session (save creates a prospect)</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
              {c.business_name ? ` — ${c.business_name}` : ""} ({c.type}
              {c.coach_name ? ` · ${c.coach_name}` : ""})
            </option>
          ))}
        </select>
        {!contacts.length ? (
          <p className="mt-2 max-w-[20rem] text-xs leading-snug text-slate-600">
            No contacts yet. Add people from{" "}
            <a className="font-medium text-sky-700 hover:underline" href={clientsHref}>
              {clientsLabel}
            </a>
            .
          </p>
        ) : null}
      </div>
    );
    return () => setWorkshopTopRight(null);
  }, [
    setWorkshopTopRight,
    registerMinimalSlot,
    loading,
    error,
    contacts,
    selectedId,
    clientsHref,
    clientsLabel,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="BOSS score"
        actions={
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              checked={workshopMode}
              onChange={(e) => setWorkshopMode(e.target.checked)}
            />
            Live scoring session
          </label>
        }
        description={
          <span className="text-base leading-relaxed text-slate-700">
            The growth matrix is always available below. Optionally pick someone from the list, or
            start scoring right away — we create a prospect for your coach account on first save when
            nobody is selected.
          </span>
        }
      />

      {!isMinimalChrome && loading && <p className="text-sm text-slate-600">Loading contacts…</p>}
      {!isMinimalChrome && error && <p className="text-sm text-rose-600">{error}</p>}

      {!isMinimalChrome && !loading && !error && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label
            htmlFor="workshop-contact-select"
            className="mb-3 block text-base font-medium text-slate-800"
          >
            Who are you working with? (optional)
          </label>
          <select
            id="workshop-contact-select"
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
            value={selectedId}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedId(v);
              const url = new URL(window.location.href);
              if (v) url.searchParams.set("contact", v);
              else url.searchParams.delete("contact");
              window.history.replaceState({}, "", url.toString());
            }}
          >
            <option value="">Blank session (save creates a prospect)</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
                {c.business_name ? ` — ${c.business_name}` : ""} ({c.type}
                {c.coach_name ? ` · ${c.coach_name}` : ""})
              </option>
            ))}
          </select>
          {!contacts.length ? (
            <p className="mt-3 text-sm text-slate-600">
              No contacts yet. Add people from{" "}
              <a className="font-medium text-sky-700 hover:underline" href={clientsHref}>
                {clientsLabel}
              </a>
              .
            </p>
          ) : null}
        </div>
      )}

      {!loading && !error && selectedId ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 sm:p-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Session for
          </p>
          <p className="text-base font-semibold text-slate-900">
            {selected?.full_name ?? "Contact"}
            {selected?.business_name ? (
              <span className="font-normal text-slate-600">
                {" "}
                · {selected.business_name}
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      {!loading && !error ? (
        <ContactBossWorkshopBody
          contactId={selectedId || null}
          draftCoachId={draftCoachId}
          onDraftContactCreated={handleDraftContactCreated}
          variant="embedded"
          showPillarNotes={false}
          workshopMode={workshopMode}
          onWorkshopModeChange={setWorkshopMode}
          showLiveScoringCheckbox={false}
        />
      ) : null}
    </div>
  );
}
