import { Suspense, type ReactNode } from "react";
import { AdminWinsReplyQueue } from "@/components/admin/AdminWinsReplyQueue";
import { CommunityAreaLayout } from "@/components/community/CommunityAreaLayout";

export default function AdminCommunityLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <AdminWinsReplyQueue />
      <Suspense
        fallback={<p className="text-sm text-slate-600">Loading…</p>}
      >
        <CommunityAreaLayout>{children}</CommunityAreaLayout>
      </Suspense>
    </>
  );
}
