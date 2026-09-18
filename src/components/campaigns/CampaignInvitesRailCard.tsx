"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { PendingInvitesSpeedDial } from "@/components/campaigns/PendingInvitesSpeedDial";
import { DEMO_PREVIEW_INVITE_TOTAL } from "@/lib/campaigns/demoPreview";
import {
  AUTO_DAILY_MAX,
  DEFAULT_KEEP_UNDER,
  type InviteWithdrawPolicy,
} from "@/lib/unipile/inviteWithdraw";

const LINKEDIN_SENT_INVITES =
  "https://www.linkedin.com/mynetwork/invitation-manager/sent/";

type Snapshot = {
  total: number;
  hasMore: boolean;
  policy: InviteWithdrawPolicy;
};

type InvitesResponse = {
  error?: string;
  total?: number;
  has_more?: boolean;
  withdraw?: InviteWithdrawPolicy;
};

async function readInvitesJson(res: Response): Promise<InvitesResponse | null> {
  const body = (await res.json().catch(() => null)) as InvitesResponse | null;
  return body && typeof body === "object" ? body : null;
}

function AutoCleanInfo() {
  const panelId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(event: MouseEvent) {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="-m-0.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 aria-expanded:bg-slate-100 aria-expanded:text-slate-600"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="Auto-clean info"
      >
        <CircleHelp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
      {open ? (
        <span
          id={panelId}
          role="tooltip"
          className="absolute left-0 bottom-full z-40 mb-1.5 w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-relaxed text-slate-600 shadow-lg"
        >
          Withdraws the oldest unanswered invites until you’re under{" "}
          {DEFAULT_KEEP_UNDER} — up to {AUTO_DAILY_MAX}/day on weekdays. Under
          that, we leave them alone.
          <a
            href={LINKEDIN_SENT_INVITES}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block font-medium text-[#0c5290] hover:underline"
          >
            View on LinkedIn
          </a>
        </span>
      ) : null}
    </span>
  );
}

export function CampaignInvitesRailCard({
  preview = false,
  linkedInConnected,
}: {
  preview?: boolean;
  /** `undefined` while accounts are still loading. */
  linkedInConnected?: boolean;
}) {
  const disconnected = !preview && linkedInConnected === false;
  const [snap, setSnap] = useState<Snapshot | null>(
    preview
      ? {
          total: DEMO_PREVIEW_INVITE_TOTAL,
          hasMore: false,
          policy: {
            mode: "cap",
            value: DEFAULT_KEEP_UNDER,
            ranOn: null,
            ranCount: 0,
          },
        }
      : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (preview || linkedInConnected !== true) return;
    try {
      const headers = await getCoachAuthHeaders();
      if (!headers) return;
      const res = await fetch("/api/coach/linkedin-outreach/invitations", {
        headers,
      });
      const body = await readInvitesJson(res);
      if (!body) throw new Error("Could not load invites.");
      if (!res.ok) throw new Error(body.error || "Could not load invites.");
      setSnap({
        total: Number(body.total ?? 0),
        hasMore: Boolean(body.has_more),
        policy: body.withdraw ?? {
          mode: "cap",
          value: DEFAULT_KEEP_UNDER,
          ranOn: null,
          ranCount: 0,
        },
      });
      setError(typeof body.error === "string" && body.error ? body.error : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load.");
    }
  }, [preview, linkedInConnected]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveAuto(on: boolean) {
    if (disconnected) return;
    if (preview) {
      setSnap((current) =>
        current
          ? {
              ...current,
              policy: {
                ...current.policy,
                mode: on ? "cap" : "off",
                value: DEFAULT_KEEP_UNDER,
              },
            }
          : current
      );
      return;
    }
    setSaving(true);
    setError(null);
    setSnap((current) =>
      current
        ? {
            ...current,
            policy: {
              ...current.policy,
              mode: on ? "cap" : "off",
              value: DEFAULT_KEEP_UNDER,
            },
          }
        : current
    );
    try {
      const headers = await getCoachAuthHeaders();
      if (!headers) throw new Error("Not signed in.");
      const res = await fetch("/api/coach/linkedin-outreach/invitations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "save_policy",
          mode: on ? "cap" : "off",
          value: DEFAULT_KEEP_UNDER,
        }),
      });
      const body = await readInvitesJson(res);
      if (!body) throw new Error("Could not save.");
      if (!res.ok) throw new Error(body.error || "Could not save.");
      if (body.withdraw) {
        setSnap((current) =>
          current ? { ...current, policy: body.withdraw! } : current
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  const total = snap?.total ?? 0;
  const autoOn = snap?.policy.mode !== "off" && snap != null;

  return (
    <section className="relative z-20 shrink-0 overflow-visible rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40">
      <div className="flex items-center gap-4 py-3 pl-4 pr-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Pending invites
          </h2>
          {disconnected ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Connect LinkedIn to load this
            </p>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                Auto-clean
                <AutoCleanInfo />
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={autoOn}
                aria-label="Auto-clean pending invites"
                disabled={saving || snap == null}
                onClick={() => void saveAuto(!autoOn)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800/40 focus-visible:ring-offset-2 disabled:opacity-40 ${
                  autoOn ? "bg-emerald-800" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                    autoOn ? "translate-x-4" : ""
                  }`}
                />
              </button>
            </div>
          )}
          {error ? (
            <p className="mt-2 text-[11px] text-rose-900">{error}</p>
          ) : null}
        </div>

        <PendingInvitesSpeedDial
          count={disconnected || snap == null ? null : total}
          loading={!disconnected && snap == null && !error}
          compact
        />
      </div>
    </section>
  );
}
