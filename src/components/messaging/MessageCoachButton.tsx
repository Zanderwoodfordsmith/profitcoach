"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";

import { buttonClass } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { fetchCachedProfileRole } from "@/lib/getClients/cachedProfileRole";
import { getSessionUser } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Admin viewing a coach's conversation (16 Nov, job 224): start a Support chat
 * with the coach about it, to coach them on a reply. The coach can answer back
 * in Support, and the chat's button opens this conversation.
 */
export function MessageCoachButton({ conversationId }: { conversationId: string }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [coachName, setCoachName] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ coachId: string; emailed: string | null; emailError: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getSessionUser();
      if (!user) return;
      const role = await fetchCachedProfileRole(user.id).catch(() => null);
      if (!cancelled) setIsAdmin(role?.role === "admin");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function authHeaders(): Promise<Record<string, string> | null> {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null;
  }

  async function start() {
    setOpen(true);
    setSent(null);
    setError(null);
    setText("");
    setLoading(true);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in again, then retry.");
      const res = await fetch(
        `/api/admin/support/coach-chat?conversation_id=${encodeURIComponent(conversationId)}`,
        { headers }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        coach_first_name?: string;
        prospect_name?: string | null;
        latest_reply?: string | null;
      };
      if (!res.ok) throw new Error(body.error || "Could not load this conversation.");
      setCoachName(body.coach_first_name ?? null);
      if (body.latest_reply) {
        const who = body.prospect_name?.trim().split(/\s+/)[0] || "They";
        setText(`${who} replied: "${body.latest_reply}"\n\n`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this conversation.");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in again, then retry.");
      const res = await fetch("/api/admin/support/coach-chat", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, message: text }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        coach_id?: string;
        emailed?: string | null;
        email_error?: string | null;
      };
      if (!res.ok || !body.coach_id) throw new Error(body.error || "Could not start the chat.");
      setSent({ coachId: body.coach_id, emailed: body.emailed ?? null, emailError: body.email_error ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the chat.");
    } finally {
      setSending(false);
    }
  }

  if (!isAdmin) return null;

  const name = coachName || "the coach";

  return (
    <>
      <button
        type="button"
        onClick={() => void start()}
        title="Start a Support chat with the coach about this conversation"
        className={buttonClass("quiet", "small", "gap-1.5")}
      >
        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
        Message coach
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        busy={sending}
        glass
        title={sent ? `Sent to ${name}` : `Message ${name} about this`}
        titleId="message-coach-title"
        subtitle={
          sent
            ? null
            : `This starts a Support chat with ${name}. They get an email, can reply in Support, and the chat has a button back to this conversation.`
        }
        maxWidthClassName="max-w-2xl"
      >
        <div className="space-y-5 px-10 pb-9 pt-5">
          {sent ? (
            <p className="text-base text-slate-700">
              {sent.emailError
                ? `The chat is in Support, but the email didn't go: ${sent.emailError}`
                : sent.emailed
                  ? `The chat is in Support, and ${name} has been emailed at ${sent.emailed}.`
                  : `The chat is in Support.`}
            </p>
          ) : (
            <div className="space-y-2">
              <label htmlFor="message-coach-text" className="sr-only">
                Message
              </label>
              <textarea
                id="message-coach-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={9}
                disabled={loading}
                placeholder={loading ? "Loading…" : `What should ${name} do next time?`}
                className={fieldClass("textarea", "normal", "w-full")}
                autoFocus
              />
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            </div>
          )}
          <div className="flex justify-end gap-2">
            {sent ? (
              <>
                <button type="button" onClick={() => setOpen(false)} className={buttonClass("second", "normal")}>
                  Close
                </button>
                <Link
                  href={`/admin/support?channel=${encodeURIComponent(sent.coachId)}`}
                  className={buttonClass("main", "normal")}
                >
                  Open in Support
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={sending}
                  className={buttonClass("second", "normal")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={sending || loading || !text.trim()}
                  className={buttonClass("main", "normal")}
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
