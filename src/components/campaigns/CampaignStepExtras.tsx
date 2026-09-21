"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { MessageSquare, Mic, Upload, Video, X } from "lucide-react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  formatWaitDuration,
  inferWaitDuration,
  WAIT_UNIT_MAX,
  WAIT_UNITS,
  waitToHours,
  type WaitUnit,
} from "@/lib/unipile/waitDuration";
import {
  MAX_CAMPAIGN_STEP_MEDIA_BYTES,
  MAX_CAMPAIGN_STEP_MEDIA_MB,
} from "@/lib/unipile/campaignStepMediaLimits";
import {
  inviteNoConnectFrom,
  type CampaignStepMedia,
  type CampaignStepMediaKind,
} from "@/lib/unipile/campaignStepTypes";

type SequenceCampaignOptionLocal = {
  id: string;
  name: string;
};

export function InviteNoConnectBranch({
  config,
  campaigns,
  onChange,
  onCommit,
  libraryMode = false,
}: {
  config: Record<string, unknown> | null | undefined;
  campaigns: SequenceCampaignOptionLocal[];
  onChange: (patch: { config: Record<string, unknown> }) => void;
  onCommit: () => void;
  libraryMode?: boolean;
}) {
  const branch = inviteNoConnectFrom(config);
  const group = useId();
  const inferred = inferWaitDuration(branch.no_connect_wait_hours ?? 24 * 7);
  const selected = branch.on_no_connect === "other_campaign";

  function patch(next: Record<string, unknown>) {
    onChange({ config: { ...(config ?? {}), ...next } });
    onCommit();
  }

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2.5">
      <p className="text-xs font-semibold text-rose-800">If they don&apos;t connect</p>
      <div className="mt-2 space-y-1.5">
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input
            type="radio"
            name={group}
            checked={libraryMode || !selected}
            onChange={() =>
              patch({
                on_no_connect: "none",
                no_connect_wait_hours: null,
                no_connect_campaign_id: null,
              })
            }
            className="mt-0.5"
          />
          <span>Do nothing — leave the invite pending</span>
        </label>
        {libraryMode ? null : (
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input
            type="radio"
            name={group}
            checked={selected}
            onChange={() =>
              patch({
                on_no_connect: "other_campaign",
                no_connect_wait_hours: branch.no_connect_wait_hours ?? 24 * 7,
                no_connect_campaign_id: branch.no_connect_campaign_id,
              })
            }
            className="mt-0.5"
          />
          <span>Send them to another campaign</span>
        </label>
        )}
      </div>
      {selected && !libraryMode ? (
        <div className="mt-2 space-y-2">
          {campaigns.length === 0 ? (
            <p className="text-[11px] text-rose-800">Create another campaign first.</p>
          ) : (
            <label className="block text-[11px] font-medium text-slate-600">
              Campaign
              <select
                value={branch.no_connect_campaign_id ?? ""}
                onChange={(e) =>
                  patch({
                    on_no_connect: "other_campaign",
                    no_connect_campaign_id: e.target.value || null,
                    no_connect_wait_hours: branch.no_connect_wait_hours ?? 24 * 7,
                  })
                }
                className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-sm font-normal text-slate-800"
              >
                <option value="">Choose a campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-600">Wait</span>
            <input
              type="number"
              min={1}
              max={WAIT_UNIT_MAX[inferred.unit]}
              value={inferred.amount}
              onChange={(e) => {
                const amount = Math.min(
                  WAIT_UNIT_MAX[inferred.unit],
                  Math.max(1, Number(e.target.value || 1))
                );
                patch({
                  on_no_connect: "other_campaign",
                  no_connect_wait_hours: waitToHours(amount, inferred.unit),
                  no_connect_campaign_id: branch.no_connect_campaign_id,
                });
              }}
              className="w-14 rounded-md border border-rose-200 bg-white px-2 py-1 text-sm tabular-nums"
            />
            <select
              value={inferred.unit}
              onChange={(e) => {
                const unit = e.target.value as WaitUnit;
                const amount = Math.min(WAIT_UNIT_MAX[unit], inferred.amount);
                patch({
                  on_no_connect: "other_campaign",
                  no_connect_wait_hours: waitToHours(amount, unit),
                  no_connect_campaign_id: branch.no_connect_campaign_id,
                });
              }}
              className="rounded-md border border-rose-200 bg-white px-2 py-1 text-sm"
            >
              {WAIT_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500">
              ({formatWaitDuration(branch.no_connect_wait_hours)})
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MessageStepMedia({
  campaignId,
  mediaKind,
  media,
  onChange,
  onCommit,
  uploadUrl,
  trailing,
}: {
  campaignId: string;
  mediaKind: CampaignStepMediaKind | null;
  media: CampaignStepMedia | null;
  onChange: (patch: {
    media_kind: CampaignStepMediaKind | null;
    media: CampaignStepMedia | null;
  }) => void;
  onCommit: () => void;
  uploadUrl?: string;
  trailing?: ReactNode;
}) {
  const { impersonatingCoachId } = useImpersonation();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected: CampaignStepMediaKind | "message" = mediaKind ?? "message";
  const signedUrl =
    media &&
    typeof (media as CampaignStepMedia & { signedUrl?: string }).signedUrl ===
      "string"
      ? (media as CampaignStepMedia & { signedUrl?: string }).signedUrl
      : media &&
          typeof (media as CampaignStepMedia & { signed_url?: string })
            .signed_url === "string"
        ? (media as CampaignStepMedia & { signed_url?: string }).signed_url
        : null;

  function patch(next: {
    media_kind: CampaignStepMediaKind | null;
    media: CampaignStepMedia | null;
  }) {
    onChange(next);
    onCommit();
  }

  async function onFile(file: File, nextKind: CampaignStepMediaKind) {
    setBusy(true);
    setError(null);
    try {
      if (file.size > MAX_CAMPAIGN_STEP_MEDIA_BYTES) {
        throw new Error(`Each file must be under ${MAX_CAMPAIGN_STEP_MEDIA_MB}MB.`);
      }
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) throw new Error("Sign in required.");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", nextKind);
      const res = await fetch(
        uploadUrl ??
          `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}/step-media`,
        {
          method: "POST",
          headers: { Authorization: headers.Authorization },
          body: fd,
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        media?: CampaignStepMedia & { signedUrl?: string | null };
      };
      if (!res.ok || !body.media) {
        throw new Error(body.error || "Upload failed.");
      }
      patch({
        media_kind: nextKind,
        media: body.media,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  const accept =
    selected === "voice"
      ? "audio/mp4,audio/m4a,audio/mpeg,audio/webm,audio/ogg,.m4a,.mp3,.webm,.ogg"
      : "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";
  const uploadHint =
    selected === "voice"
      ? `M4A or MP3, under ${MAX_CAMPAIGN_STEP_MEDIA_MB} MB — up to about 5 minutes.`
      : `MP4 or MOV, under ${MAX_CAMPAIGN_STEP_MEDIA_MB} MB — up to about 5 minutes.`;

  function selectKind(next: CampaignStepMediaKind | "message") {
    if (next === selected) return;
    if (next === "message") {
      patch({ media_kind: null, media: null });
      return;
    }
    patch({
      media_kind: next,
      media: mediaKind === next ? media : null,
    });
  }

  return (
    <div>
      <div className="flex w-full items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Message type"
          className="inline-grid grid-cols-3 rounded-full bg-slate-100 p-0.5"
        >
          {(
            [
              { id: "message", label: "Message", icon: MessageSquare },
              { id: "voice", label: "Voice", icon: Mic },
              { id: "video", label: "Video", icon: Video },
            ] as const
          ).map((option) => {
            const on = selected === option.id;
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={on}
                onClick={() => selectKind(option.id)}
                className={`inline-flex items-center justify-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-semibold leading-tight transition duration-150 ${
                  on
                    ? "bg-[#1a8fd4] text-white"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
        {trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
      </div>
      {selected !== "message" && !media ? (
        <div className="mt-2.5 flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            aria-describedby={hintId}
            onClick={() => inputRef.current?.click()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0c5290] px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-[#0c5290]/20 hover:bg-[#0a4478] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8fd4] focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" aria-hidden />
            {busy ? "Uploading…" : "Upload"}
          </button>
          <p
            id={hintId}
            className="min-w-0 flex-1 text-xs leading-snug text-slate-600"
          >
            {uploadHint}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file && (selected === "voice" || selected === "video")) {
                void onFile(file, selected);
              }
            }}
          />
        </div>
      ) : null}
      {media ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
          {media.kind === "voice" ? (
            <Mic className="h-4 w-4 text-slate-500" aria-hidden />
          ) : (
            <Video className="h-4 w-4 text-slate-500" aria-hidden />
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
            {media.filename}
          </span>
          {signedUrl ? (
            media.kind === "voice" ? (
              <audio controls src={signedUrl} className="h-8 max-w-[10rem]" />
            ) : (
              <a
                href={signedUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-[#0c5290] hover:underline"
              >
                Preview
              </a>
            )
          ) : null}
          <button
            type="button"
            aria-label="Remove file"
            onClick={() =>
              patch({
                media: null,
                media_kind: mediaKind,
              })
            }
            className="rounded-full p-0.5 text-slate-400 hover:text-rose-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-[11px] text-rose-700">{error}</p> : null}
    </div>
  );
}
