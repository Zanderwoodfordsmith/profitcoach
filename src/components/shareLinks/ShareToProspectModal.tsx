"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { OutlinedTextArea } from "@/components/settings/OutlinedFormField";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  buildPersonalisedAssessmentLink,
  buildPersonalisedAssessmentProLink,
} from "@/lib/assessmentContactParams";
import {
  appendContactParamsToUrl,
  calendarContactFromFields,
} from "@/lib/calendarContactParams";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import {
  setMessagingComposeDraft,
  type MessagingComposeChannel,
} from "@/lib/messaging/composeDraft";
import {
  shareMessageForAssessment,
  shareMessageForCalendar,
  shareMessageForLink,
  shareMessageForReport,
} from "@/lib/shareLinks/messages";
import type { SocialNetwork } from "@/lib/shareLinks/socials";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseClient } from "@/lib/supabaseClient";

export type ShareTarget =
  | {
      kind: "assessment";
      product: "boss-score" | "boss-pro";
      title: string;
      genericUrl: string;
    }
  | { kind: "generic"; title: string; genericUrl: string }
  | { kind: "calendar"; title: string; genericUrl: string }
  | { kind: "report"; product: "boss-score" | "boss-pro"; title: string }
  | { kind: "social"; network: SocialNetwork; title: string; genericUrl: string };

type ProspectPickerRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  linkedin_url: string | null;
  type: string | null;
  inviteToken: string | null;
};

type Props = {
  open: boolean;
  target: ShareTarget | null;
  coachSlug: string;
  appOrigin: string;
  onClose: () => void;
};

const CHANNELS: { id: MessagingComposeChannel; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
];

function availableChannels(prospect: ProspectPickerRow | null): MessagingComposeChannel[] {
  if (!prospect) return [];
  const next: MessagingComposeChannel[] = [];
  if (prospect.phone?.trim()) {
    next.push("whatsapp");
    next.push("sms");
  }
  if (prospect.linkedin_url?.trim()) next.push("linkedin");
  if (prospect.email?.trim()) next.push("email");
  return next;
}

function defaultMessage(target: ShareTarget, url: string): string {
  if (target.kind === "assessment") {
    return shareMessageForAssessment(target.product, url);
  }
  if (target.kind === "report") {
    return shareMessageForReport(target.product, url);
  }
  if (target.kind === "calendar") {
    return shareMessageForCalendar(target.title, url);
  }
  return shareMessageForLink(target.title, url);
}

export function ShareToProspectModal({
  open,
  target,
  coachSlug,
  appOrigin,
  onClose,
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const { impersonatingCoachId } = useImpersonation();

  const [prospects, setProspects] = useState<ProspectPickerRow[]>([]);
  const [loading, setProspectsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<MessagingComposeChannel>("whatsapp");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const reset = useCallback(() => {
    setSearch("");
    setSelectedId(null);
    setResolvedUrl(null);
    setMessage("");
    setChannel("whatsapp");
    setCopied(false);
    setError(null);
    setSending(false);
    setReportLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
    if (target && target.kind !== "report") {
      setResolvedUrl(target.genericUrl);
      setMessage(defaultMessage(target, target.genericUrl));
    }
  }, [open, target, reset]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadProspects() {
      setProspectsLoading(true);
      setError(null);
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setError("Sign in to load prospects.");
          setProspectsLoading(false);
        }
        return;
      }
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      const effectiveId =
        roleBody.role === "admin" && impersonatingCoachId
          ? impersonatingCoachId
          : user.id;

      const { data, error: loadError } = await selectContactsWithOptionalPhone<{
        id: string;
        full_name: string;
        email: string | null;
        business_name: string | null;
        phone: string | null;
        linkedin_url: string | null;
        type: string | null;
        assessment_invite_token: string | null;
      }>(
        async (columns) =>
          supabaseClient
            .from("contacts")
            .select(columns)
            .eq("coach_id", effectiveId)
            .in("type", ["prospect", "client"])
            .order("created_at", { ascending: false }),
        "id, full_name, email, business_name, type, created_at",
        ["linkedin_url", "assessment_invite_token"]
      );

      if (cancelled) return;
      if (loadError) {
        setError("Could not load prospects.");
        setProspects([]);
      } else {
        setProspects(
          (data ?? []).map((row) => ({
            id: row.id,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            business_name: row.business_name,
            linkedin_url: row.linkedin_url,
            type: row.type,
            inviteToken: row.assessment_invite_token,
          }))
        );
      }
      setProspectsLoading(false);
    }
    void loadProspects();
    return () => {
      cancelled = true;
    };
  }, [open, impersonatingCoachId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prospects;
    return prospects.filter((p) =>
      [p.full_name, p.email, p.business_name, p.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [prospects, search]);

  const selected = useMemo(
    () => prospects.find((p) => p.id === selectedId) ?? null,
    [prospects, selectedId]
  );

  const channels = availableChannels(selected);

  useEffect(() => {
    if (!selected) {
      if (target && target.kind !== "report") {
        setResolvedUrl(target.genericUrl);
        setMessage(defaultMessage(target, target.genericUrl));
      } else if (target?.kind === "report") {
        setResolvedUrl(null);
        setMessage("");
      }
      return;
    }

    const { first_name, last_name } = splitFullName(selected.full_name);
    const contactInput = {
      firstName: first_name ?? "",
      lastName: last_name ?? "",
      email: selected.email ?? "",
      phone: selected.phone ?? "",
      businessName: selected.business_name ?? "",
      inviteToken: selected.inviteToken ?? undefined,
      origin: appOrigin,
      coachSlug,
    };

    if (!target) return;

    if (target.kind === "assessment") {
      const url =
        target.product === "boss-score"
          ? buildPersonalisedAssessmentLink(contactInput)
          : buildPersonalisedAssessmentProLink(contactInput);
      setResolvedUrl(url);
      setMessage(defaultMessage(target, url));
      return;
    }

    if (target.kind === "calendar") {
      const url = appendContactParamsToUrl(
        target.genericUrl,
        calendarContactFromFields({
          firstName: first_name,
          lastName: last_name,
          email: selected.email,
          phone: selected.phone,
        })
      );
      setResolvedUrl(url);
      setMessage(defaultMessage(target, url));
      return;
    }

    if (target.kind === "report") {
      let cancelled = false;
      setReportLoading(true);
      setError(null);
      void (async () => {
        const headers = await getCoachAuthHeaders(impersonatingCoachId);
        if (!headers) {
          if (!cancelled) {
            setReportLoading(false);
            setError("Sign in to load the report link.");
          }
          return;
        }
        const path =
          target.product === "boss-score"
            ? `/api/coach/contacts/${encodeURIComponent(selected.id)}/scorecard-share-link`
            : `/api/coach/contacts/${encodeURIComponent(selected.id)}/dashboard-share-link`;
        const res = await fetch(path, { headers, cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };
        if (cancelled) return;
        setReportLoading(false);
        if (!res.ok || !body.url) {
          setResolvedUrl(null);
          setMessage("");
          setError(body.error ?? "No report yet for this person.");
          return;
        }
        let shareUrl = body.url;
        try {
          const parsed = new URL(body.url);
          shareUrl = `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
        } catch {
          /* keep API url */
        }
        setResolvedUrl(shareUrl);
        setMessage(defaultMessage(target, shareUrl));
      })();
      return () => {
        cancelled = true;
      };
    }

    setResolvedUrl(target.genericUrl);
    setMessage(defaultMessage(target, target.genericUrl));
  }, [appOrigin, coachSlug, impersonatingCoachId, selected, target]);

  useEffect(() => {
    if (channels.length === 0) return;
    if (!channels.includes(channel)) setChannel(channels[0]);
  }, [channel, channels]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function copyLink() {
    const url =
      resolvedUrl ||
      (target && target.kind !== "report" ? target.genericUrl : null);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the link and copy it yourself.");
    }
  }

  async function openConversation() {
    const url =
      resolvedUrl ||
      (target && target.kind !== "report" ? target.genericUrl : null);
    if (!selected || !url || !message.trim()) return;
    setSending(true);
    setError(null);
    const headers = await getCoachAuthHeaders(impersonatingCoachId);
    if (!headers) {
      setSending(false);
      setError("Sign in to open a conversation.");
      return;
    }
    const res = await fetch("/api/messaging/conversations", {
      method: "POST",
      headers,
      body: JSON.stringify({ contact_id: selected.id }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      conversation?: { id?: string };
    };
    if (!res.ok || !body.conversation?.id) {
      setSending(false);
      setError(body.error ?? "Could not open the conversation.");
      return;
    }
    setMessagingComposeDraft({
      conversationId: body.conversation.id,
      body: message.trim(),
      channel: channels.includes(channel) ? channel : undefined,
    });
    router.push(`${prefix}/conversations`);
  }

  if (!open || !target) return null;

  const genericUrl = target.kind === "report" ? null : target.genericUrl;
  const displayUrl = resolvedUrl || genericUrl;
  const needsProspect = target.kind === "report";
  const canCopy = Boolean(displayUrl) && !reportLoading;
  const canSend = Boolean(selected && displayUrl && message.trim()) && !reportLoading;
  const displayHost = displayUrl
    ? displayUrl
        .replace(/^https?:\/\//i, "")
        .replace(/^localhost:\d+/i, "theprofitcoach.com")
        .replace(/^127\.0\.0\.1:\d+/i, "theprofitcoach.com")
    : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-link-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-[22px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="share-link-title"
              className="text-[21px] font-semibold tracking-[-0.02em] text-slate-900"
            >
              Share {target.title}
            </h2>
            <p className="mt-1 text-[13px] leading-snug text-slate-500">
              {needsProspect
                ? "Choose who completed it. Then copy or send."
                : "Copy the link, or send it in a conversation."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 text-[15px] font-medium text-slate-400 transition hover:text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="mt-5">
          <input
            id="share_prospect_search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prospects"
            aria-label="Choose a prospect"
            className="w-full rounded-xl bg-slate-100 px-3.5 py-2.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#0c5290]/25"
          />
          <div className="mt-2 max-h-44 overflow-y-auto">
            {loading ? (
              <p className="px-1 py-6 text-center text-[13px] text-slate-500">
                Loading prospects
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-1 py-6 text-center text-[13px] text-slate-500">
                {prospects.length === 0 ? "No prospects yet." : "No matches."}
              </p>
            ) : (
              <ul>
                {filtered.map((prospect) => {
                  const isSelected = selectedId === prospect.id;
                  const meta =
                    prospect.email?.trim() ||
                    prospect.business_name?.trim() ||
                    "";
                  return (
                    <li key={prospect.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(prospect.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-slate-50 ${
                          isSelected ? "bg-slate-50" : ""
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium text-slate-900">
                            {prospect.full_name}
                          </span>
                          {meta ? (
                            <span className="block truncate text-[13px] text-slate-500">
                              {meta}
                            </span>
                          ) : null}
                        </span>
                        {isSelected ? (
                          <Check
                            className="h-4 w-4 shrink-0 text-[#0c5290]"
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {reportLoading ? (
          <p className="mt-4 flex items-center gap-2 text-[13px] text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading their report
          </p>
        ) : null}

        {displayHost ? (
          <button
            type="button"
            onClick={() => void copyLink()}
            disabled={!canCopy}
            className="mt-4 block w-full truncate text-left text-[13px] text-slate-400 transition hover:text-slate-600 disabled:opacity-50"
            title="Copy link"
          >
            {copied ? "Copied" : displayHost}
          </button>
        ) : null}

        {selected ? (
          <div className="mt-4 space-y-3">
            <OutlinedTextArea
              id="share_message"
              label="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              wrapperClassName="w-full"
            />
            {channels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {CHANNELS.filter((item) => channels.includes(item.id)).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setChannel(item.id)}
                    className={`rounded-full px-3 py-1 text-[13px] font-medium transition ${
                      channel === item.id
                        ? "bg-[#0c5290] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-slate-500">
                Add a phone, LinkedIn, or email on this prospect to send.
              </p>
            )}
          </div>
        ) : null}

        {error ? <p className="mt-3 text-[13px] text-rose-600">{error}</p> : null}

        <div className="mt-6 flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => void copyLink()}
            disabled={!canCopy}
            className="text-[15px] font-medium text-slate-500 transition hover:text-slate-800 disabled:text-slate-300"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => void openConversation()}
            disabled={!canSend || sending}
            className="rounded-full bg-[#0c5290] px-4 py-2 text-[15px] font-medium text-white transition hover:bg-[#051e36] disabled:bg-slate-200 disabled:text-slate-400"
          >
            {sending ? "Opening" : "Send"}
          </button>
        </div>
        {target.kind === "social" ? (
          <p className="mt-3 text-[12px] text-slate-400">
            Same link for everyone. A prospect just prepares the message.
          </p>
        ) : null}
      </div>
    </div>
  );
}
