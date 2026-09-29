"use client";

import { use } from "react";

import { AdminPracticeDetail } from "@/components/admin/AdminPracticeDetail";

export default function AdminBlueprintRecordPage({
  params,
}: {
  params: Promise<{ coachId: string }>;
}) {
  const { coachId } = use(params);
  return <AdminPracticeDetail coachId={coachId} />;
}
