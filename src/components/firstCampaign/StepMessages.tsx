"use client";

import { useEffect, useRef, useState } from "react";
import {
  AiNote,
  Card,
  Chip,
  ErrorNote,
  PrimaryButton,
  SecondaryButton,
} from "@/components/firstCampaign/firstCampaignUi";
import {
  CampaignSetupProgress,
  useCampaignProgressRunner,
} from "@/components/firstCampaign/CampaignSetupProgress";
import type { CampaignMessageDraft } from "@/lib/firstCampaign/types";
import {
  apiPatch,
  apiPost,
  type AvatarState,
  type ChosenIcp,
  type MessagesState,
} from "@/lib/firstCampaign/wizardApi";

type GenerateResponse = { drafts?: CampaignMessageDraft[]; error?: string };
type ApproveResponse = { messages?: MessagesState; error?: string };

function draftKey(draft: CampaignMessageDraft, idx: number): string {
  return draft.variantLabel || `draft-${idx}`;
}

export function StepMessages({
  icp,
  avatar,
  messages,
  onSaved,
  onContinue,
}: {
  icp: ChosenIcp | null;
  avatar: AvatarState | null;
  messages: MessagesState | null;
  onSaved: (messages: MessagesState) => void;
  onContinue: () => void;
}) {
  const [drafts, setDrafts] = useState<CampaignMessageDraft[]>(messages?.drafts ?? []);
  const [approved, setApproved] = useState<Set<string>>(
    new Set(messages?.approvedVariants ?? [])
  );
  const [phase, setPhase] = useState<"progress" | "review" | "approving">(
    messages?.drafts?.length ? "review" : "progress"
  );
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);
  const progress = useCampaignProgressRunner();

  async function runGenerateSequence(opts?: { regenerate?: boolean }) {
    if (!icp) {
      setError("Choose an ICP first.");
      setPhase("review");
      return;
    }
    setError(null);
    setPhase("progress");

    const holder: { drafts: CampaignMessageDraft[] } = { drafts: [] };

    const generateWork = (async () => {
      const result = await apiPost<
        GenerateResponse & { messages?: CampaignMessageDraft[] }
      >("/api/coach/campaign-setup/messages", { icp });
      const draftsOut =
        result.data?.drafts?.length
          ? result.data.drafts
          : result.data?.messages?.length
            ? result.data.messages
            : null;
      if (!result.ok || !draftsOut?.length) {
        throw new Error(
          result.error ?? result.data?.error ?? "Couldn't generate drafts."
        );
      }
      holder.drafts = draftsOut;
    })();
    void generateWork.catch(() => undefined);

    try {
      await progress.runFlat([
        {
          id: "playbook",
          label: "Loading your outreach playbook",
          minMs: 900,
        },
        {
          id: "voice",
          label: "Matching tone to your avatar",
          minMs: 1100,
        },
        {
          id: "connectors",
          label: "Drafting connector openers",
          minMs: 1400,
          work: () => generateWork,
        },
        {
          id: "followups",
          label: "Writing follow-up variants",
          minMs: 1100,
        },
        {
          id: "ready",
          label: opts?.regenerate
            ? "Refreshing your message set"
            : "Preparing your message set",
          minMs: 700,
        },
      ]);

      setDrafts(holder.drafts);
      setApproved(new Set(holder.drafts.map((d, idx) => draftKey(d, idx))));
      await new Promise((r) => setTimeout(r, 350));
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate drafts.");
      setPhase(drafts.length ? "review" : "progress");
    }
  }

  useEffect(() => {
    if (autoStarted.current) return;
    if (drafts.length > 0) return;
    if (!icp) return;
    autoStarted.current = true;
    void runGenerateSequence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icp, drafts.length]);

  function updateBody(key: string, body: string) {
    setDrafts((prev) =>
      prev.map((d, idx) => (draftKey(d, idx) === key ? { ...d, body } : d))
    );
  }

  function toggleApproved(key: string) {
    setApproved((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleApprove() {
    setError(null);
    setPhase("approving");

    const ids = Array.from(approved);
    const edits: Record<string, string> = {};
    drafts.forEach((d, idx) => {
      edits[draftKey(d, idx)] = d.body;
    });

    const savedHolder: { messages: MessagesState | null } = { messages: null };

    try {
      await progress.runFlat([
        {
          id: "approve",
          label: "Approving selected messages",
          minMs: 1000,
          work: async () => {
            const result = await apiPatch<ApproveResponse>(
              "/api/coach/campaign-setup/messages",
              {
                ids,
                edits,
                drafts,
                approve: true,
                markStep4Complete: true,
              }
            );
            if (!result.ok) {
              throw new Error(result.error ?? "Couldn't approve messages.");
            }
            savedHolder.messages =
              result.data?.messages ?? {
                drafts,
                approvedAt: new Date().toISOString(),
                approvedVariants: ids,
              };
          },
        },
        {
          id: "pack",
          label: "Packaging your campaign assets",
          minMs: 1000,
        },
        {
          id: "leads",
          label: "Opening starter list builder",
          minMs: 800,
        },
      ]);

      if (!savedHolder.messages) throw new Error("Couldn't approve messages.");
      onSaved(savedHolder.messages);
      await new Promise((r) => setTimeout(r, 400));
      onContinue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't approve messages.");
      setPhase("review");
    }
  }

  if (phase === "progress" || phase === "approving") {
    return (
      <div className="flex flex-col gap-5">
        <CampaignSetupProgress
          title={
            phase === "approving"
              ? "Locking in your messages"
              : "Drafting your outreach"
          }
          subtitle={
            phase === "approving"
              ? "Then we’ll build your starter list."
              : icp
                ? `Personalised to “${icp.label}”${avatar?.approvedAt ? " and your confirmed avatar." : "."}`
                : "This usually takes under a minute."
          }
          stages={progress.stages}
        />
        {error ? (
          <div className="flex flex-col gap-3">
            <ErrorNote>{error}</ErrorNote>
            <PrimaryButton onClick={() => void runGenerateSequence()}>
              Try again
            </PrimaryButton>
          </div>
        ) : null}
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <AiNote>
          We&apos;ll draft connector openers and follow-ups shaped by your ICP
          and avatar.
        </AiNote>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <PrimaryButton onClick={() => void runGenerateSequence()} disabled={!icp}>
          Generate drafts
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AiNote>
        Edit any draft to match your voice, then approve the ones you want to
        use. We&apos;ll take you straight to the starter list.
      </AiNote>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {drafts.map((draft, idx) => {
          const key = draftKey(draft, idx);
          const isApproved = approved.has(key);
          return (
            <Card
              key={key}
              title={draft.variantLabel}
              actions={
                <Chip tone={draft.messageType === "connector" ? "sky" : "slate"}>
                  {draft.messageType === "connector" ? "Connector" : "Follow-up"}
                </Chip>
              }
            >
              <textarea
                value={draft.body}
                onChange={(e) => updateBody(key, e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={isApproved}
                  onChange={() => toggleApproved(key)}
                  className="rounded border-slate-300"
                />
                Include in approved set
              </label>
            </Card>
          );
        })}
      </div>

      <Card
        title="Approve messages"
        actions={
          <SecondaryButton
            onClick={() => void runGenerateSequence({ regenerate: true })}
          >
            Regenerate all
          </SecondaryButton>
        }
      >
        <div className="flex items-center justify-between gap-3">
          {messages?.approvedAt ? (
            <span className="text-xs text-emerald-700">
              Approved {new Date(messages.approvedAt).toLocaleDateString()}
            </span>
          ) : (
            <span className="text-xs text-slate-500">
              {approved.size} of {drafts.length} selected
            </span>
          )}
          <PrimaryButton
            onClick={() => void handleApprove()}
            disabled={approved.size === 0}
          >
            Approve &amp; continue
          </PrimaryButton>
        </div>
      </Card>
    </div>
  );
}
