import { HorizontalLeadFlowMap } from "@/components/academy/HorizontalLeadFlowMap";

const CLASSROOM_BASE = "/coach/academy/classroom";

export default function CoachClassroomSystemPage() {
  return <HorizontalLeadFlowMap classroomBase={CLASSROOM_BASE} />;
}
