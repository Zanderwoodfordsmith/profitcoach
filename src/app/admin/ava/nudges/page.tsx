"use client";

import { AvaNudgeQueue } from "@/components/admin/ava/AvaNudgeQueue";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminAvaNudgesPage() {
  useRequireAdminRole("/coach");
  return <AvaNudgeQueue />;
}
