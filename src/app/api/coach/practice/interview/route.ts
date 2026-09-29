import { NextResponse } from "next/server";

import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import {
  createIntakeSession,
  ensurePracticeKnowledge,
  getActiveIntakeSession,
  getLatestIntakeSession,
  patchPracticeKnowledge,
  saveIntakeSession,
} from "@/lib/practiceKnowledge/store";
import {
  buildInterviewUser,
  PRACTICE_INTERVIEW_SYSTEM,
} from "@/lib/practiceKnowledge/prompts";
import { sanitizePayloadPatch } from "@/lib/practiceKnowledge/sanitize";
import type {
  InterviewTurn,
  PracticeKnowledgePayload,
} from "@/lib/practiceKnowledge/types";

export const maxDuration = 60;

const MAX_TURNS = 80;
const MAX_MESSAGE = 8000;

type InterviewModelOut = {
  assistant_message?: string;
  done?: boolean;
  extraction?: Partial<PracticeKnowledgePayload>;
};

export async function GET(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  try {
    const [knowledge, session] = await Promise.all([
      ensurePracticeKnowledge(check.userId),
      getLatestIntakeSession(check.userId),
    ]);
    return NextResponse.json({ knowledge, session });
  } catch (err) {
    console.error("practice interview GET:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load interview." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }

  let body: { message?: string; start?: boolean } = {};
  try {
    body = (await request.json()) as { message?: string; start?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const userText = String(body.message ?? "").trim().slice(0, MAX_MESSAGE);
  const starting = body.start === true || !userText;

  try {
    const knowledge = await ensurePracticeKnowledge(check.userId);
    let session = await getActiveIntakeSession(check.userId);
    if (!session) session = await createIntakeSession(check.userId);

    const turns: InterviewTurn[] = [...(session.turns ?? [])];
    if (turns.length >= MAX_TURNS) {
      return NextResponse.json(
        { error: "This interview has reached its turn limit." },
        { status: 429 }
      );
    }

    if (userText && !starting) {
      turns.push({
        role: "user",
        content: userText,
        at: new Date().toISOString(),
      });
    }

    const { summary } = await loadCoachLinkedInSummary(check.userId);
    const { data, error } = await generateCampaignJson<InterviewModelOut>({
      system: PRACTICE_INTERVIEW_SYSTEM,
      user: buildInterviewUser({
        linkedinSummary: summary,
        knowledge: knowledge.payload,
        turns,
        userMessage: starting ? null : userText,
      }),
      maxTokens: 2048,
    });

    if (!data?.assistant_message) {
      return NextResponse.json(
        { error: error || "The interviewer could not reply. Try again." },
        { status: 502 }
      );
    }

    turns.push({
      role: "assistant",
      content: data.assistant_message.slice(0, MAX_MESSAGE),
      at: new Date().toISOString(),
    });

    const extraction = sanitizePayloadPatch(data.extraction ?? {}, "interview");
    const saved = await saveIntakeSession({
      sessionId: session.id,
      coachId: check.userId,
      turns,
      extraction,
      status: data.done ? "completed" : "active",
    });

    const nextKnowledge = await patchPracticeKnowledge({
      coachId: check.userId,
      payloadPatch: extraction,
      interviewCompleted: data.done === true,
      status: data.done ? "extracted" : knowledge.status,
    });

    return NextResponse.json({
      knowledge: nextKnowledge,
      session: saved,
      assistant_message: data.assistant_message,
      done: Boolean(data.done),
    });
  } catch (err) {
    console.error("practice interview POST:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not continue the interview." }, { status: 500 });
  }
}
