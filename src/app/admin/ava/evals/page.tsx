"use client";

import { AvaEvals } from "@/components/admin/ava/AvaEvals";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminAvaEvalsPage() {
  useRequireAdminRole("/coach");
  return <AvaEvals />;
}
