"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type LinkedInScheduledItem = {
  id: string;
  content: string;
  scheduled_for: string;
  status: "scheduled" | "published" | "failed" | "cancelled";
  attempts: number;
  last_error: string | null;
};

export function LinkedInSchedulerPanel() {
  const searchParams = useSearchParams();
  const [linkedinConnected, setLinkedinConnected] = useState<boolean | null>(null);
  const [linkedinScopes, setLinkedinScopes] = useState<string[]>([]);
  const [linkedinTokenExpiry, setLinkedinTokenExpiry] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<"neutral" | "success" | "error">("neutral");
  const [connectingLinkedIn, setConnectingLinkedIn] = useState(false);
  const [postingNow, setPostingNow] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [publishingDue, setPublishingDue] = useState(false);
  const [scheduledItems, setScheduledItems] = useState<LinkedInScheduledItem[]>([]);
  const linkedinStatus = searchParams.get("linkedin");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [accountFirstName, setAccountFirstName] = useState<string | null>(null);
  const [accountLastName, setAccountLastName] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  async function getAdminBearerToken() {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const token = session?.access_token ?? "";
    if (!token) throw new Error("Please sign in again.");
    return token;
  }

  async function loadPanel() {
    try {
      const token = await getAdminBearerToken();
      const [statusRes, scheduledRes] = await Promise.all([
        fetch("/api/linkedin/status", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/linkedin/scheduled", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const statusBody = (await statusRes.json().catch(() => ({}))) as {
        connected?: boolean;
        connection?: {
          linkedin_sub?: string | null;
          scope?: string[];
          token_expires_at?: string | null;
        } | null;
        account?: {
          name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
        } | null;
      };
      const scheduledBody = (await scheduledRes.json().catch(() => ({}))) as {
        items?: LinkedInScheduledItem[];
      };

      setLinkedinConnected(!!statusBody.connected);
      setLinkedinScopes(statusBody.connection?.scope ?? []);
      setLinkedinTokenExpiry(statusBody.connection?.token_expires_at ?? null);
      setScheduledItems(scheduledBody.items ?? []);
      setAccountName(statusBody.account?.name ?? null);
      setAccountFirstName(statusBody.account?.first_name ?? null);
      setAccountLastName(statusBody.account?.last_name ?? null);
      setAccountEmail(statusBody.account?.email ?? null);
    } catch {
      setActionMessage("Could not load LinkedIn scheduler data.");
      setActionTone("error");
    }
  }

  useEffect(() => {
    void loadPanel();
  }, []);

  async function handleConnectLinkedIn() {
    if (connectingLinkedIn) return;
    setConnectingLinkedIn(true);
    try {
      const token = await getAdminBearerToken();
      const res = await fetch("/api/linkedin/connect", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error || "Could not start LinkedIn connect.");
      window.location.assign(body.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start LinkedIn connect.";
      window.alert(message);
      setConnectingLinkedIn(false);
    }
  }

  async function handlePostNow() {
    if (postingNow) return;
    const content = composerText.trim();
    if (!content) return setActionMessage("Write some post text first.");
    setPostingNow(true);
    setActionMessage(null);
    try {
      const token = await getAdminBearerToken();
      const res = await fetch("/api/linkedin/post-now", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      const raw = await res.text().catch(() => "");
      let body: { ok?: boolean; error?: string } = {};
      try {
        body = raw ? (JSON.parse(raw) as { ok?: boolean; error?: string }) : {};
      } catch {
        body = {};
      }
      if (!res.ok || !body.ok) {
        throw new Error(body.error || raw || `Could not publish post (HTTP ${res.status}).`);
      }
      setActionMessage("Posted to LinkedIn successfully.");
      setActionTone("success");
      setComposerText("");
      await loadPanel();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Could not publish post.");
      setActionTone("error");
    } finally {
      setPostingNow(false);
    }
  }

  async function handleSchedule() {
    if (scheduling) return;
    const content = composerText.trim();
    if (!content) return setActionMessage("Write some post text first.");
    if (!scheduledAtLocal) return setActionMessage("Choose a schedule date/time.");
    setScheduling(true);
    setActionMessage(null);
    try {
      const token = await getAdminBearerToken();
      const res = await fetch("/api/linkedin/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content,
          scheduled_for: new Date(scheduledAtLocal).toISOString(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "Could not schedule post.");
      setActionMessage("Post scheduled.");
      setActionTone("success");
      setScheduledAtLocal("");
      setComposerText("");
      await loadPanel();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Could not schedule post.");
      setActionTone("error");
    } finally {
      setScheduling(false);
    }
  }

  async function handlePublishDueNow() {
    if (publishingDue) return;
    setPublishingDue(true);
    setActionMessage(null);
    try {
      const token = await getAdminBearerToken();
      const res = await fetch("/api/linkedin/publish-due", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { processed?: number; error?: string };
      if (!res.ok) throw new Error(body.error || "Could not publish due posts.");
      setActionMessage(`Processed ${body.processed ?? 0} due post(s).`);
      setActionTone("success");
      await loadPanel();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Could not publish due posts.");
      setActionTone("error");
    } finally {
      setPublishingDue(false);
    }
  }

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">LinkedIn publishing</p>
          <p className="mt-1 text-xs text-slate-600">
            Connect your LinkedIn profile, post instantly, or schedule posts.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Status:{" "}
            {linkedinConnected == null
              ? "Loading…"
              : linkedinConnected
                ? "Connected"
                : "Not connected"}
          </p>
          {linkedinScopes.length ? (
            <p className="text-[11px] text-slate-500">Scopes: {linkedinScopes.join(", ")}</p>
          ) : null}
          {linkedinConnected ? (
            <div className="mt-1 text-[11px] text-slate-500">
              <p>
                Connected account name:{" "}
                {accountFirstName || accountLastName
                  ? `${accountFirstName ?? ""} ${accountLastName ?? ""}`.trim()
                  : accountName ?? "Unavailable"}
              </p>
              {!accountFirstName && !accountLastName && !accountName ? (
                <p>
                  LinkedIn did not return profile names for this token. Posting can still work.
                </p>
              ) : null}
              {accountEmail ? <p>Connected account email: {accountEmail}</p> : null}
            </div>
          ) : null}
          {linkedinTokenExpiry ? (
            <p className="text-[11px] text-slate-500">
              Token expires: {new Date(linkedinTokenExpiry).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadPanel()}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleConnectLinkedIn}
            disabled={connectingLinkedIn}
            className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {connectingLinkedIn ? "Redirecting…" : "Connect LinkedIn"}
          </button>
        </div>
      </div>

      <div className="mt-3">
        <label className="text-xs font-semibold text-slate-700">Post text</label>
        <textarea
          value={composerText}
          onChange={(e) => setComposerText(e.target.value)}
          placeholder="Write a short LinkedIn post..."
          className="mt-1 h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        />
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            type="datetime-local"
            value={scheduledAtLocal}
            onChange={(e) => setScheduledAtLocal(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-700"
          />
          <button
            type="button"
            onClick={handleSchedule}
            disabled={scheduling || !linkedinConnected}
            className="rounded-md border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {scheduling ? "Scheduling…" : "Schedule"}
          </button>
          <button
            type="button"
            onClick={handlePostNow}
            disabled={postingNow || !linkedinConnected}
            className="rounded-md bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {postingNow ? "Posting…" : "Post now"}
          </button>
          <button
            type="button"
            onClick={handlePublishDueNow}
            disabled={publishingDue || !linkedinConnected}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishingDue ? "Running…" : "Run due now"}
          </button>
        </div>
      </div>

      {actionMessage ? (
        <p
          className={`mt-2 text-xs ${
            actionTone === "success"
              ? "text-emerald-700"
              : actionTone === "error"
                ? "text-rose-700"
                : "text-slate-700"
          }`}
        >
          {actionMessage}
        </p>
      ) : null}
      {linkedinStatus ? (
        <p
          className={`mt-2 text-xs ${
            linkedinStatus === "connected" ? "text-emerald-700" : "text-amber-700"
          }`}
        >
          {linkedinStatus === "connected"
            ? "LinkedIn connected successfully."
            : `LinkedIn status: ${linkedinStatus.replaceAll("_", " ")}`}
        </p>
      ) : null}

      {scheduledItems.length ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-white">
          <p className="border-b border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Queue
          </p>
          <ul className="max-h-56 overflow-auto">
            {scheduledItems.map((item) => (
              <li
                key={item.id}
                className="border-b border-slate-100 px-3 py-2 text-xs text-slate-700 last:border-b-0"
              >
                <p className="line-clamp-2">{item.content}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {item.status} • {new Date(item.scheduled_for).toLocaleString()} • attempts:{" "}
                  {item.attempts}
                </p>
                {item.last_error ? (
                  <p className="mt-1 text-[11px] text-amber-700">{item.last_error}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
