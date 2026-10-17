import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { openQuestions } from "@/lib/practiceKnowledge/blueprint";
import { avaCallProtocol } from "@/lib/practiceKnowledge/intakeCall";
import { buildInterviewUser, PRACTICE_INTERVIEW_SYSTEM } from "@/lib/practiceKnowledge/prompts";
import { sanitizePayloadPatch } from "@/lib/practiceKnowledge/sanitize";
import {
  createIntakeSession,
  ensurePracticeKnowledge,
  getActiveIntakeSession,
  patchPracticeKnowledge,
  saveIntakeSession,
} from "@/lib/practiceKnowledge/store";
import type {
  IntakeSessionRow,
  InterviewTurn,
  PracticeKnowledgePayload,
  PracticeKnowledgeRow,
} from "@/lib/practiceKnowledge/types";

const MAX_TURNS = 80;
const MAX_MESSAGE = 8000;

const FOLLOWUP = `This coach already finished the first call. Do not restart the agenda and do not re-ask a filled fact. If "Still open" has items, ask the next one. If they correct something, save the correction. If nothing is open, tell them the brief is in, BCA is drafting the markets and the campaign angle, and the next step is to book the call with Pam. Set done=true.`;

const SPOKEN = `You are on a call. assistant_message is spoken aloud: two short sentences at most, then one question. No lists, headings, or markdown.`;

type InterviewModelOut = {
  assistant_message?: string;
  done?: boolean;
  extraction?: Partial<PracticeKnowledgePayload>;
  question?: string;
  message?: string;
  reply?: string;
};

export type IntakeTurnResult =
  | {
      ok: true;
      assistant_message: string;
      done: boolean;
      knowledge: PracticeKnowledgeRow;
      session: IntakeSessionRow;
    }
  | { ok: false; status: number; error: string };

function spoken(out: InterviewModelOut | null): string {
  const text = out?.assistant_message || out?.question || out?.message || out?.reply || "";
  return typeof text === "string" ? text.trim() : "";
}

function systemFor(protocol: "intake" | "followup", medium: "voice" | "text"): string {
  const parts = [PRACTICE_INTERVIEW_SYSTEM];
  if (protocol === "followup") parts.push(FOLLOWUP);
  if (medium === "voice") parts.push(SPOKEN);
  return parts.join("\n\n");
}

/**
 * A voice reconnect must not ask the model again for a line we already saved.
 * Returns the spoken line to repeat, or null when this turn is new.
 */
function replayVoice(
  session: IntakeSessionRow,
  starting: boolean,
  userText: string
): string | null {
  const turns = session.turns ?? [];
  const last = turns[turns.length - 1];
  if (!last) return null;
  if (starting && last.role === "assistant") return last.content;
  if (!userText || last.role !== "assistant") return null;
  const previous = [...turns].reverse().find((turn) => turn.role === "user");
  if (previous?.content === userText) return last.content;
  return null;
}

export async function runIntakeTurn(opts: {
  coachId: string;
  message?: string;
  start?: boolean;
  /** Voice is spoken and safe to retry. Text always takes a new turn. */
  medium?: "voice" | "text";
}): Promise<IntakeTurnResult> {
  const medium = opts.medium ?? "text";
  const userText = String(opts.message ?? "").trim().slice(0, MAX_MESSAGE);
  const starting = opts.start === true || !userText;

  const knowledge = await ensurePracticeKnowledge(opts.coachId);
  let session = await getActiveIntakeSession(opts.coachId);
  if (!session) session = await createIntakeSession(opts.coachId);

  if (medium === "voice") {
    const again = replayVoice(session, starting, userText);
    if (again) {
      return {
        ok: true,
        assistant_message: again,
        done: session.status === "completed",
        knowledge,
        session,
      };
    }
  }

  const turns: InterviewTurn[] = [...(session.turns ?? [])];
  if (turns.length >= MAX_TURNS) {
    return { ok: false, status: 429, error: "This interview has reached its turn limit." };
  }

  if (userText && !starting) {
    turns.push({ role: "user", content: userText, at: new Date().toISOString() });
  }

  const protocol = avaCallProtocol(knowledge.interview_completed_at);
  const { summary } = await loadCoachLinkedInSummary(opts.coachId);
  const ask = () =>
    generateCampaignJson<InterviewModelOut>({
      system: systemFor(protocol, medium),
      user: buildInterviewUser({
        linkedinSummary: summary,
        knowledge: knowledge.payload,
        turns,
        userMessage: starting ? null : userText,
        stillOpen: openQuestions(knowledge),
      }),
      maxTokens: 3000,
    });

  let { data, error } = await ask();
  if (!spoken(data)) ({ data, error } = await ask());
  if (data && spoken(data)) {
    data.assistant_message = spoken(data).replace(/\s*\u2014\s*/g, ", ");
  }

  if (!data?.assistant_message) {
    return { ok: false, status: 502, error: error || "The interviewer could not reply. Try again." };
  }

  turns.push({
    role: "assistant",
    content: data.assistant_message.slice(0, MAX_MESSAGE),
    at: new Date().toISOString(),
  });

  const extraction = sanitizePayloadPatch(data.extraction ?? {}, "interview");
  const saved = await saveIntakeSession({
    sessionId: session.id,
    coachId: opts.coachId,
    turns,
    extraction,
    status: data.done ? "completed" : "active",
  });

  const nextKnowledge = await patchPracticeKnowledge({
    coachId: opts.coachId,
    payloadPatch: extraction,
    interviewCompleted: data.done === true,
    status: data.done ? "extracted" : knowledge.status,
  });

  return {
    ok: true,
    assistant_message: data.assistant_message,
    done: Boolean(data.done),
    knowledge: nextKnowledge,
    session: saved,
  };
}
