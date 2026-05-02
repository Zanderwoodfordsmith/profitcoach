"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StickyPageHeader } from "@/components/layout";
import { adminExtraNavLinks } from "@/config/adminExtraNavLinks";
import { supabaseClient } from "@/lib/supabaseClient";

const linkItems = [
  { href: "/login", label: "Login" },
  { href: "/preview/thank-you", label: "Thank you (Completed)" },
];

type TabId = "links" | "settings";

export default function AdminAccountPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("links");
  const [checkingRole, setCheckingRole] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

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
      if (cancelled) return;
      if (!roleRes.ok || !roleBody.role) {
        setError("Unable to load your profile.");
        setCheckingRole(false);
        return;
      }
      if (roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }
      const { data: prof } = await supabaseClient
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setAvatarUrl(prof?.avatar_url ?? null);
      }
      setCheckingRole(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setAvatarError(null);
      setUploadingAvatar(true);
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setAvatarError("Not signed in.");
        setUploadingAvatar(false);
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/coach/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      setUploadingAvatar(false);
      if (res.ok) {
        const body = (await res.json()) as { avatar_url?: string };
        setAvatarUrl(body.avatar_url ?? null);
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setAvatarError(body.error ?? "Upload failed.");
      }
      e.target.value = "";
    },
    []
  );

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  const tabs: { id: TabId; label: string }[] = [
    { id: "links", label: "Links" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Account"
        description="Admin settings, links, and preferences."
      />

      {checkingRole ? (
        <p className="text-sm text-slate-600">Checking access…</p>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : null}

      {!checkingRole && !error && (
        <>
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex gap-6" aria-label="Account tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`border-b-2 px-1 py-3 text-sm font-medium ${
                    activeTab === tab.id
                      ? "border-sky-600 text-sky-700"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {activeTab === "links" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <ul className="divide-y divide-slate-100">
                  {linkItems.map((item) => {
                    const fullUrl = origin ? `${origin}${item.href}` : item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-900 hover:bg-slate-50"
                        >
                          <span className="font-medium">{item.label}</span>
                          <span className="truncate text-xs text-slate-500">
                            {fullUrl}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <h2 className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Landing pages
                </h2>
                <ul className="divide-y divide-slate-100">
                  <li>
                    <Link
                      href="/landing/a?coach=BCA"
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-900 hover:bg-slate-50"
                    >
                      <span className="font-medium">Landing – Variant A (control)</span>
                      <span className="truncate text-xs text-slate-500">
                        {origin ? `${origin}/landing/a?coach=BCA` : "/landing/a?coach=BCA"}
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/landing/b?coach=BCA"
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-900 hover:bg-slate-50"
                    >
                      <span className="font-medium">Landing – Variant B (variation)</span>
                      <span className="truncate text-xs text-slate-500">
                        {origin ? `${origin}/landing/b?coach=BCA` : "/landing/b?coach=BCA"}
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <h2 className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pages outside the sidebar
                </h2>
                <ul className="divide-y divide-slate-100">
                  {adminExtraNavLinks.map((item) => {
                    const fullUrl = origin ? `${origin}${item.href}` : item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className="flex flex-col gap-0.5 px-4 py-3 text-sm text-slate-900 hover:bg-slate-50"
                        >
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{item.label}</span>
                            <span className="truncate text-xs text-slate-500">
                              {fullUrl}
                            </span>
                          </span>
                          {item.hint ? (
                            <span className="text-xs text-slate-500">{item.hint}</span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Profile photo</h2>
              <p className="mt-1 text-sm text-slate-600">
                Used in Community and anywhere your admin profile appears.
              </p>
              <div className="mt-4 flex items-center gap-4">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                    No photo
                  </div>
                )}
                <div>
                  <label className="block">
                    <span className="sr-only">Upload photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarChange}
                      disabled={uploadingAvatar}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:hover:bg-sky-700"
                    />
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    JPEG, PNG or WebP. Max 2MB.
                  </p>
                  {uploadingAvatar ? (
                    <p className="mt-1 text-xs text-slate-600">Uploading…</p>
                  ) : null}
                  {avatarError ? (
                    <p className="mt-1 text-xs text-rose-600">{avatarError}</p>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
