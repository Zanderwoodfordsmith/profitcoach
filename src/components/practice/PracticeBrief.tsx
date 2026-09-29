"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Mic, Square, Volume2 } from "lucide-react";

import {
  BRIEF_SECTIONS,
  buildPracticeBrief,
  careerSentenceFor,
  patchFromBriefEdit,
  type BriefEdit,
  type BriefSectionId,
} from "@/lib/practiceKnowledge/brief";
import type {
  CareerResult,
  IntakeAssetRow,
  InterviewTurn,
  PracticeKnowledgePayload,
  PracticeReportPayload,
} from "@/lib/practiceKnowledge/types";
import { sourced } from "@/lib/practiceKnowledge/sourced";

type Props = {
  payload: PracticeKnowledgePayload;
  report: PracticeReportPayload | null;
  turns: InterviewTurn[];
  question: string | null;
  interviewDone: boolean;
  busy: boolean;
  error: string | null;
  ttsOn: boolean;
  assets?: Array<IntakeAssetRow & { signed_url?: string | null }>;
  readOnly?: boolean;
  onPatch: (patch: Partial<PracticeKnowledgePayload>) => void;
  onCommit: () => void;
  onStart: () => void;
  onReply: (text: string) => void;
  onSpeak: (text: string) => void;
  onTranscribe: (blob: Blob) => Promise<string | null>;
  onPullLinkedIn?: () => void;
  onUpload?: (file: File) => void;
  comments?: string;
  onComments?: (value: string) => void;
  showOutline?: boolean;
  title?: string;
  lede?: string;
  hideComposer?: boolean;
  hideHeader?: boolean;
  approvedSections?: Record<string, string>;
  onApproveSection?: (id: string) => void;
};

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] leading-relaxed text-slate-900 outline-none focus:border-[#0c5290] focus:ring-2 focus:ring-[#0c5290]/25";

export function PracticeBrief({
  payload,
  report,
  turns,
  question,
  interviewDone,
  busy,
  error,
  ttsOn,
  assets = [],
  readOnly = false,
  onPatch,
  onCommit,
  onStart,
  onReply,
  onSpeak,
  onTranscribe,
  onPullLinkedIn,
  onUpload,
  comments = "",
  onComments,
  showOutline = true,
  title = "Your Practice Blueprint",
  lede = "One document for the practice. LinkedIn writes what it can. You speak the rest. The other pages read from here.",
  hideComposer = false,
  hideHeader = false,
  approvedSections,
  onApproveSection,
}: Props) {
  const sections = buildPracticeBrief(payload, report);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const replyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (question) replyRef.current?.focus();
  }, [question]);

  function beginEdit(id: string, raw: string) {
    if (readOnly) return;
    setEditing(id);
    setDraft(raw);
  }

  function commitEdit(id: string, value: string) {
    onPatch(patchFromBriefEdit(payload, id, value));
    setEditing(null);
    onCommit();
  }

  async function toggleMic() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const text = await onTranscribe(blob);
      if (text) setReply((prev) => (prev ? `${prev} ${text}` : text));
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  function scrollTo(id: BriefSectionId) {
    document.getElementById(`brief-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className={showOutline ? "grid items-start gap-8 lg:grid-cols-[15rem_minmax(0,42rem)]" : "w-full"}>
      {showOutline ? (
      <nav className="lg:sticky lg:top-24" aria-label="Practice brief">
        <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
          {BRIEF_SECTIONS.map((section) => {
            const filled = sections.find((s) => s.id === section.id)?.filled;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => scrollTo(section.id)}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c5290] lg:w-full lg:shrink lg:whitespace-normal"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      filled ? "bg-[#0c5290]" : "bg-slate-300"
                    }`}
                    aria-hidden
                  />
                  {section.title}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      ) : null}

      <article className="min-w-0">
        {hideHeader ? null : (
          <header className="mb-10">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
              {title}
            </h2>
            <p className="mt-3 max-w-[62ch] text-[15px] leading-7 text-slate-600">
              {lede}
            </p>
          </header>
        )}

        <div className="space-y-10">
          {sections.map((section) => (
            <details
              key={section.id}
              id={`brief-${section.id}`}
              className="scroll-mt-24 border-b border-slate-200 pb-8"
              open={section.filled || section.id === "experience" || section.id === "priorities"}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-[1.375rem] font-semibold leading-snug tracking-[-0.02em] text-[#0f172a]">
                <span>{section.title}</span>
                {onApproveSection ? (
                  <button
                    type="button"
                    aria-pressed={Boolean(approvedSections?.[section.id])}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onApproveSection(section.id);
                    }}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      approvedSections?.[section.id]
                        ? "bg-[#0c5290] text-white"
                        : "bg-white text-slate-800 ring-1 ring-slate-300"
                    }`}
                  >
                    {approvedSections?.[section.id] ? "Approved" : "Approve"}
                  </button>
                ) : null}
              </summary>
              <div className="mt-4 space-y-4">
                {section.blocks.map((block, index) => {
                  if (block.kind === "gap") {
                    return (
                      <p key={`${section.id}-gap-${index}`} className="text-[1.0625rem] leading-[1.55] text-[#475569]">
                        {block.text}
                      </p>
                    );
                  }
                  if (block.kind === "career") {
                    return (
                      <CareerBlock
                        key="career"
                        results={block.results}
                        sourceLabel={block.sourceLabel}
                        readOnly={readOnly}
                        payload={payload}
                        onPatch={onPatch}
                        onCommit={onCommit}
                      />
                    );
                  }
                  const active = editing === block.id;
                  return (
                    <div key={`${block.id}-${index}`}>
                      {active ? (
                        <Editor
                          edit={block.edit}
                          value={draft}
                          onChange={setDraft}
                          onBlur={(value) => commitEdit(block.id, value)}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => beginEdit(block.id, block.raw)}
                          className="block w-full rounded-lg text-left text-[1.0625rem] leading-[1.55] text-[#1e293b] hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c5290] disabled:hover:bg-transparent"
                        >
                          <span className="whitespace-pre-wrap">{block.text}</span>
                        </button>
                      )}
                      {block.sourceLabel ? (
                        <p className="mt-1 text-xs text-slate-500">From {block.sourceLabel}</p>
                      ) : null}
                    </div>
                  );
                })}

                {section.id === "experience" && !readOnly && onPullLinkedIn ? (
                  <button
                    type="button"
                    onClick={onPullLinkedIn}
                    disabled={busy}
                    className="text-sm font-medium text-[#0c5290] hover:text-[#083e6d] disabled:opacity-50"
                  >
                    {busy ? "Pulling LinkedIn…" : "Pull LinkedIn again"}
                  </button>
                ) : null}

                {section.id === "experience" && !readOnly && onUpload ? (
                  <label className="block text-sm text-slate-600">
                    Add a CV, testimonial, or case study
                    <input
                      type="file"
                      className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-800"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : null}
                {section.id === "experience" && assets.length ? (
                  <ul className="space-y-1 text-sm">
                    {assets.map((asset) => (
                      <li key={asset.id}>
                        {asset.signed_url ? (
                          <a className="text-[#0c5290] underline" href={asset.signed_url}>
                            {asset.file_name}
                          </a>
                        ) : (
                          asset.file_name
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {section.id === "priorities" && report ? (
                  <Recommendation
                    report={report}
                    comments={comments}
                    readOnly={readOnly}
                    onComments={onComments}
                    onCommit={onCommit}
                  />
                ) : null}
              </div>
            </details>
          ))}
        </div>

        {readOnly || hideComposer ? null : (
          <div className="sticky bottom-4 mt-12 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_-16px_rgba(5,30,54,0.35)]">
            {interviewDone && !question ? (
              <p className="text-sm leading-6 text-slate-700">
                That is enough to write the brief. Correct any line above, or{" "}
                <Link href="/welcome" className="font-medium text-[#0c5290] underline">
                  book the Decision Call
                </Link>
                .
              </p>
            ) : question ? (
              <p className="text-[15px] leading-7 text-slate-900">{question}</p>
            ) : (
              <p className="text-[15px] leading-7 text-slate-700">
                We already know what LinkedIn shows. The next few minutes fill the open lines.
              </p>
            )}

            {turns.length === 0 ? (
              <button
                type="button"
                onClick={onStart}
                disabled={busy}
                className="mt-3 rounded-lg bg-[#0c5290] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a4478] disabled:opacity-50"
              >
                {busy ? "Starting…" : "Start talking"}
              </button>
            ) : interviewDone ? null : (
              <div className="mt-3 space-y-2">
                <textarea
                  ref={replyRef}
                  className={`${fieldClass} min-h-[72px]`}
                  value={reply}
                  disabled={busy}
                  placeholder="Say it in a sentence, or use the mic."
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && reply.trim()) {
                      const text = reply.trim();
                      setReply("");
                      onReply(text);
                    }
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || !reply.trim()}
                    onClick={() => {
                      const text = reply.trim();
                      setReply("");
                      onReply(text);
                    }}
                    className="rounded-lg bg-[#0c5290] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Writing it in
                      </span>
                    ) : (
                      "Add to the brief"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleMic()}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                      recording
                        ? "border-rose-300 bg-rose-50 text-rose-900"
                        : "border-slate-300 text-slate-800"
                    }`}
                  >
                    {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {recording ? "Stop" : "Talk"}
                  </button>
                  {ttsOn && question ? (
                    <button
                      type="button"
                      onClick={() => onSpeak(question)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800"
                    >
                      <Volume2 className="h-4 w-4" />
                      Read this aloud
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {turns.length > 1 ? (
              <details className="mt-3 text-sm text-slate-600">
                <summary className="cursor-pointer font-medium text-slate-700">
                  Conversation
                </summary>
                <ol className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                  {turns.map((turn, i) => (
                    <li key={`${turn.at}-${i}`}>
                      <span className="font-medium text-slate-500">
                        {turn.role === "assistant" ? "Question" : "You"}:{" "}
                      </span>
                      {turn.content}
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}

            {error ? (
              <p className="mt-2 text-sm text-rose-800" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </article>
    </div>
  );
}

function Editor({
  edit,
  value,
  onChange,
  onBlur,
}: {
  edit: BriefEdit;
  value: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
}) {
  if (edit === "hours" || edit === "model" || edit === "format" || edit === "geo") {
    const options =
      edit === "hours"
        ? [
            ["under_2_hours", "Under 2 hours a week"],
            ["2_5_hours_week", "2 to 5 hours a week"],
            ["5_10_hours_week", "5 to 10 hours a week"],
            ["10_15_hours_week", "10 to 15 hours a week"],
            ["15_plus_hours_week", "15 or more hours a week"],
          ]
        : edit === "model"
          ? [
              ["coaching", "Coaching"],
              ["consulting", "Consulting"],
              ["advisory", "Advisory"],
              ["hybrid", "Hybrid"],
            ]
          : edit === "format"
            ? [
                ["one_to_one", "One-to-one"],
                ["group", "Group"],
                ["hybrid", "One-to-one and group"],
              ]
            : [
                ["local", "Local"],
                ["national", "National"],
                ["international", "International"],
              ];
    return (
      <select
        className={fieldClass}
        value={value}
        autoFocus
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
      >
        {options.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <textarea
      className={`${fieldClass} min-h-[88px]`}
      value={value}
      autoFocus
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onBlur(e.target.value)}
    />
  );
}

function CareerBlock({
  results,
  sourceLabel,
  readOnly,
  payload,
  onPatch,
  onCommit,
}: {
  results: CareerResult[];
  sourceLabel: string | null;
  readOnly: boolean;
  payload: PracticeKnowledgePayload;
  onPatch: (patch: Partial<PracticeKnowledgePayload>) => void;
  onCommit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(results);

  useEffect(() => {
    if (!open) setRows(results);
  }, [results, open]);

  return (
    <div>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => setOpen(true)}
        className="block w-full space-y-3 rounded-lg text-left hover:bg-slate-50 disabled:hover:bg-transparent"
      >
        {results.map((result) => (
          <p key={result.id} className="text-[1.0625rem] leading-[1.55] text-[#1e293b]">
            {careerSentenceFor(result)}
          </p>
        ))}
      </button>
      {sourceLabel ? <p className="mt-1 text-xs text-slate-500">From {sourceLabel}</p> : null}
      {open && !readOnly ? (
        <div className="mt-3 space-y-3">
          {rows.map((row, index) => (
            <div key={row.id} className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["company", "Company"],
                  ["role", "Role"],
                  ["metric_from", "From"],
                  ["metric_to", "To"],
                  ["timeframe", "Timeframe"],
                  ["mechanism", "How"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-xs text-slate-600">
                  {label}
                  <input
                    className={`${fieldClass} mt-1`}
                    value={row[key]}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, [key]: e.target.value } : r))
                      )
                    }
                  />
                </label>
              ))}
            </div>
          ))}
          <button
            type="button"
            className="rounded-lg bg-[#0c5290] px-3 py-1.5 text-sm font-semibold text-white"
            onClick={() => {
              onPatch({
                proof: {
                  ...payload.proof,
                  career_results: sourced(
                    rows.map((r) => ({
                      ...r,
                      precise: Boolean((r.metric_from || r.metric_to) && r.timeframe),
                    })),
                    "coach_edit"
                  ),
                },
              });
              setOpen(false);
              onCommit();
            }}
          >
            Save this result
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Recommendation({
  report,
  comments,
  readOnly,
  onComments,
  onCommit,
}: {
  report: PracticeReportPayload;
  comments: string;
  readOnly: boolean;
  onComments?: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <div className="space-y-6 text-[1.0625rem] leading-[1.55] text-[#1e293b]">
      <p className="whitespace-pre-wrap">{report.experience_summary}</p>
      <div>
        <h4 className="text-base font-semibold text-slate-950">Proof we can use</h4>
        <p className="mt-2 whitespace-pre-wrap">{report.proof_inventory}</p>
      </div>
      <div>
        <h4 className="text-base font-semibold text-slate-950">Market options</h4>
        <ol className="mt-3 space-y-4">
          {report.market_hypotheses.map((item, i) => (
            <li key={`${item.industry}-${i}`}>
              <p className="font-medium text-slate-950">
                {i + 1}. {item.industry}
                {item.buyer ? `, ${item.buyer}` : ""}
              </p>
              <p className="text-slate-700">{item.problem}</p>
              <p className="text-slate-600">{item.score_notes}</p>
            </li>
          ))}
        </ol>
      </div>
      <p>
        <span className="font-semibold text-slate-950">Offer. </span>
        {report.offer_direction}
      </p>
      <p>
        <span className="font-semibold text-slate-950">Position. </span>
        {report.positioning}
      </p>
      <p>
        <span className="font-semibold text-slate-950">Campaign. </span>
        {report.campaign_angle}
      </p>
      {report.decision_questions.length ? (
        <div>
          <h4 className="text-base font-semibold text-slate-950">Decide on the call</h4>
          <ul className="mt-2 list-disc pl-5">
            {report.decision_questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {onComments ? (
        <label className="block">
          <span className="text-base font-semibold text-slate-950">Your notes</span>
          <textarea
            className={`${fieldClass} mt-2 min-h-[88px]`}
            value={comments}
            disabled={readOnly}
            onChange={(e) => onComments(e.target.value)}
            onBlur={onCommit}
            placeholder="Flag a market, or say what still feels off."
          />
        </label>
      ) : comments ? (
        <p className="whitespace-pre-wrap">{comments}</p>
      ) : null}
    </div>
  );
}
