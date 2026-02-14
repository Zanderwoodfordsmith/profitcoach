"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLinksRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/account");
  }, [router]);
  return (
    <p className="text-sm text-slate-600">Redirecting to Account…</p>
  );
}
