"use client";

import { useEffect, useState } from "react";

import { supabaseClient } from "@/lib/supabaseClient";
import { CommunityCalendar } from "@/components/community/CommunityCalendar";
import { CommunitySidebar } from "@/components/community/CommunitySidebar";

export function CommunityCalendarPage() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [calendarAdmin, setCalendarAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) {
        if (!cancelled) setCalendarAdmin(false);
        return;
      }
      const res = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      });
      const body = (await res.json().catch(() => ({}))) as { role?: string };
      if (!cancelled) setCalendarAdmin(body.role === "admin");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:items-start lg:justify-start lg:gap-10">
      <div className="min-w-0 w-full flex-1">
        <CommunityCalendar
          addModalOpen={addModalOpen}
          onAddModalOpenChange={setAddModalOpen}
        />
      </div>
      <CommunitySidebar
        className="pt-5 lg:pt-6"
        calendarAddEvent={
          calendarAdmin
            ? { show: true, onClick: () => setAddModalOpen(true) }
            : undefined
        }
      />
    </div>
  );
}
