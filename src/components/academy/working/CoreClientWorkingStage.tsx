"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import {
  WorkingLessonChat,
  type WorkingChatMessage,
} from "@/components/academy/working/WorkingLessonChat";

type Criterion = {
  id: string;
  label: string;
  value: string;
};

const INITIAL_CRITERIA: Criterion[] = [
  {
    id: "value",
    label: "Most value",
    value:
      "UK manufacturing owners. You ran Hale Precision. You know the language and you can prove it.",
  },
  {
    id: "pain",
    label: "Pain",
    value:
      "They are still the bottleneck. Every decision routes through them. The week is reactive.",
  },
  {
    id: "growing",
    label: "Growing",
    value:
      "Owner-led manufacturing in the £2–10M band is a large UK middle, not a shrinking niche.",
  },
  {
    id: "find",
    label: "Easy to find",
    value:
      "Sales Navigator: Owner, MD, Managing Director. Manufacturing. 11–50 people. United Kingdom.",
  },
  {
    id: "pay",
    label: "Purchasing power",
    value: "£2–10M revenue. They can pay £3k+/mo without breaking cashflow.",
  },
];

const OPENING: WorkingChatMessage = {
  role: "ai",
  content:
    "I pulled this from your LinkedIn. Fourteen years as MD of Hale Precision in the Midlands. The strongest core client is the person you used to be: a UK manufacturing owner at £2–10M who is still in every decision.\n\nI scored that against the five criteria. What feels right, and what is off?",
};

function replyTo(text: string, locked: boolean): {
  message: string;
  criteria?: Criterion[];
  summary?: string;
  readyToLock?: boolean;
} {
  const lower = text.toLowerCase();

  if (locked) {
    return {
      message:
        "This core client is locked. Come back here if you want to change it. Downstream lessons will use this market.",
    };
  }

  if (
    lower.includes("looks right") ||
    lower.includes("that's right") ||
    lower.includes("thats right") ||
    lower === "yes" ||
    lower === "lock it"
  ) {
    return {
      message:
        "Good. Lock it and we stop second-guessing. You can change this later, but give it six months before you do.",
      readyToLock: true,
    };
  }

  if (lower.includes("too narrow") || lower.includes("narrow")) {
    return {
      message:
        "We can keep manufacturing as the centre and include adjacent engineering firms: precision, fabrication, industrial machinery. Same pains. Same titles. Still easy to find. I widened Easy to find. Still feel tight?",
      criteria: INITIAL_CRITERIA.map((row) =>
        row.id === "find"
          ? {
              ...row,
              value:
                "Sales Navigator: Owner, MD. Manufacturing and industrial machinery. 11–50 people. United Kingdom.",
            }
          : row.id === "value"
            ? {
                ...row,
                value:
                  "UK manufacturing and adjacent engineering owners. Your plant MD years still prove the value.",
              }
            : row,
      ),
      summary:
        "UK manufacturing and engineering owners, £2–10M, 11–50 people.",
    };
  }

  if (
    lower.includes("industry") ||
    lower.includes("wrong") ||
    lower.includes("off")
  ) {
    return {
      message:
        "If manufacturing is not the one, the next strongest fits from a typical BCA background are UK trades (plumbing, electrical, HVAC) or professional services firms at the same size. Which of those do you have more proof in?",
    };
  }

  if (lower.includes("trade") || lower.includes("plumb") || lower.includes("hvac")) {
    return {
      message:
        "Trades work if your proof is operational: jobs, cash, and the owner still on the tools. I switched the card to UK plumbing and electrical owners. Check Easy to find and Purchasing power. Still right?",
      summary: "UK plumbing and electrical owners, £2–8M, 11–50 people.",
      criteria: [
        {
          id: "value",
          label: "Most value",
          value:
            "UK plumbing and electrical owners. Transfer the ops and cash discipline from the plant years.",
        },
        {
          id: "pain",
          label: "Pain",
          value:
            "The owner is still on the bigger jobs. Growth means more chaos, not more freedom.",
        },
        {
          id: "growing",
          label: "Growing",
          value: "Owner-led trades at this size are easy to find and still buying help.",
        },
        {
          id: "find",
          label: "Easy to find",
          value:
            "Sales Navigator: Owner, MD. Plumbing, electrical, HVAC. 11–50 people. United Kingdom.",
        },
        {
          id: "pay",
          label: "Purchasing power",
          value: "£2–8M revenue. They can pay if the offer is about getting them off the tools.",
        },
      ],
    };
  }

  return {
    message:
      "Say what is off in one line: the industry, the size, or the proof. I will move the card. Or tap Looks right and lock it.",
  };
}

type Props = {
  onLock: () => void;
  locked: boolean;
};

export function CoreClientWorkingStage({ onLock, locked }: Props) {
  const [criteria, setCriteria] = useState(INITIAL_CRITERIA);
  const [summary, setSummary] = useState(
    "UK manufacturing owners, £2–10M, 11–50 people.",
  );
  const [messages, setMessages] = useState<WorkingChatMessage[]>([OPENING]);
  const [readyToLock, setReadyToLock] = useState(false);

  function handleSend(text: string) {
    const result = replyTo(text, locked);
    setMessages((current) => [
      ...current,
      { role: "user", content: text },
      { role: "ai", content: result.message },
    ]);
    if (result.criteria) setCriteria(result.criteria);
    if (result.summary) setSummary(result.summary);
    if (result.readyToLock) setReadyToLock(true);
  }

  const replies = locked
    ? []
    : readyToLock
      ? ["Lock it"]
      : ["Looks right", "Too narrow", "The industry is off"];

  return (
    <div className="overflow-hidden rounded-xl bg-[#f4f8fb] ring-1 ring-slate-200/80">
      <div
        aria-hidden
        className="h-1"
        style={{
          background: "linear-gradient(90deg, #051e36 0%, #0c5290 48%, #1a8fd4 100%)",
        }}
      />
      <div className="px-5 py-5 md:px-6 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#0c5290]">
              From your LinkedIn · James Hale · MD, Hale Precision
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 md:text-[1.35rem]">
              {summary}
            </p>
          </div>
          {locked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
              <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
              Locked
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-500">
              Demo profile. Check and tweak.
            </span>
          )}
        </div>

        <dl className="mt-5 divide-y divide-slate-200/80 border-y border-slate-200/80">
          {criteria.map((row) => (
            <div
              key={row.id}
              className="grid gap-1 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-4"
            >
              <dt className="text-sm font-semibold text-slate-900">{row.label}</dt>
              <dd className="text-[15px] leading-relaxed text-slate-700">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 border-t border-slate-200/80 pt-5">
          <WorkingLessonChat
            messages={messages}
            onSend={handleSend}
            replies={replies}
            disabled={false}
            footer={
              !locked ? (
                <button
                  type="button"
                  onClick={onLock}
                  className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:w-auto ${
                    readyToLock
                      ? "bg-sky-600 text-white hover:bg-sky-700"
                      : "border border-slate-300 bg-white text-slate-800 hover:border-sky-400 hover:text-sky-800"
                  }`}
                >
                  Lock this core client
                </button>
              ) : (
                <p className="text-sm font-medium text-emerald-800">
                  Locked. Understand Your Ideal Client will start from this.
                </p>
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
