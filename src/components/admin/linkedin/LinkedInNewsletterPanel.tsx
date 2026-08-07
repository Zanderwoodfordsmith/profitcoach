"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import { LinkedInNewsletterTab } from "./LinkedInNewsletterTab";
import { LINKEDIN_COMPOSE_SEED_KEY, type LinkedInProfilePreview } from "./types";

export function LinkedInNewsletterPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<LinkedInProfilePreview>({
    name: null,
    headline: null,
    photoUrl: null,
    email: null,
    tokenExpiry: null,
    scopes: [],
    websiteLabel: "Visit my website",
    websiteUrl: null,
    quoteHandle: "Profit Coach",
  });
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<"neutral" | "success" | "error">(
    "neutral"
  );

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const token = session?.access_token ?? "";
    if (!token) throw new Error("Please sign in again.");
    return token;
  }, []);

  const onMessage = useCallback(
    (message: string, tone: "success" | "error" | "neutral") => {
      setActionMessage(message);
      setActionTone(tone);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getToken();
        const statusRes = await fetch("/api/linkedin/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const statusBody = (await statusRes.json().catch(() => ({}))) as {
          account?: { name?: string | null; email?: string | null } | null;
          profile?: {
            name?: string | null;
            headline?: string | null;
            photo_url?: string | null;
            website_label?: string | null;
            website_url?: string | null;
            quote_handle?: string | null;
          } | null;
          connection?: {
            scope?: string[];
            token_expires_at?: string | null;
          } | null;
        };
        if (cancelled) return;
        setProfile({
          name: statusBody.profile?.name ?? statusBody.account?.name ?? null,
          headline: statusBody.profile?.headline ?? null,
          photoUrl: statusBody.profile?.photo_url ?? null,
          email: statusBody.account?.email ?? null,
          tokenExpiry: statusBody.connection?.token_expires_at ?? null,
          scopes: statusBody.connection?.scope ?? [],
          websiteLabel: statusBody.profile?.website_label || "Visit my website",
          websiteUrl: statusBody.profile?.website_url ?? null,
          quoteHandle: statusBody.profile?.quote_handle || "Profit Coach",
        });
      } catch {
        if (!cancelled) onMessage("Could not load newsletter workspace.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [getToken, onMessage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading newsletter studio…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actionMessage ? (
        <div
          className={
            actionTone === "success"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
              : actionTone === "error"
                ? "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900"
                : "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          }
        >
          {actionMessage}
        </div>
      ) : null}
      <LinkedInNewsletterTab
        getToken={getToken}
        profile={profile}
        onMessage={onMessage}
        onUsePromoInComposer={(content) => {
          try {
            sessionStorage.setItem(
              LINKEDIN_COMPOSE_SEED_KEY,
              JSON.stringify({
                content,
                category: "newsletter-promo",
              })
            );
          } catch {
            // ignore quota / private mode
          }
          router.push("/admin/linkedin?tab=compose");
        }}
      />
    </div>
  );
}
