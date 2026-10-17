"use client";

import { AvaReplyReview } from "@/components/admin/ava/AvaReplyReview";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminAvaRepliesPage() {
  useRequireAdminRole("/coach");
  return <AvaReplyReview />;
}
