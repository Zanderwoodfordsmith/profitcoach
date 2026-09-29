"use client";

import { PracticeBrief } from "./PracticeBrief";
import { usePractice } from "./PracticeProvider";

export function BlueprintDocument() {
  const practice = usePractice();
  const { knowledge, payload, session } = practice;
  if (!knowledge || !payload) return null;
  const lastQuestion = [...(session?.turns ?? [])].reverse().find((turn) => turn.role === "assistant");

  return (
    <PracticeBrief
      showOutline={false}
      title="The operating blueprint for your client practice"
      lede="One document. LinkedIn and the conversation write it. Every other page reads from here."
      payload={payload}
      report={knowledge.report_payload}
      turns={session?.turns ?? []}
      question={session?.status === "completed" ? null : (lastQuestion?.content ?? null)}
      interviewDone={session?.status === "completed" || Boolean(knowledge.interview_completed_at)}
      busy={practice.busy}
      error={practice.error}
      ttsOn={practice.ttsOn}
      assets={practice.assets}
      comments={payload.review.report_comments?.value ?? ""}
      onComments={practice.setComments}
      onPatch={practice.patch}
      onCommit={practice.commit}
      onStart={practice.start}
      onReply={practice.reply}
      onSpeak={practice.speak}
      onTranscribe={practice.transcribe}
      onPullLinkedIn={practice.pullLinkedIn}
      onUpload={practice.upload}
      hideComposer
      hideHeader
      approvedSections={payload.review.approved_sections?.value ?? {}}
      onApproveSection={practice.approveSection}
    />
  );
}
