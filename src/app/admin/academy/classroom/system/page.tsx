import { HorizontalLeadFlowMap } from "@/components/academy/HorizontalLeadFlowMap";

const CLASSROOM_BASE = "/admin/academy/classroom";

export default function AdminClassroomSystemPage() {
  return <HorizontalLeadFlowMap classroomBase={CLASSROOM_BASE} />;
}
