"use client";

import { useEffect, useState } from "react";

import { supabaseClient } from "@/lib/supabaseClient";
import { CommunityCalendar } from "@/components/community/CommunityCalendar";

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
    <CommunityCalendar
      addModalOpen={addModalOpen}
      onAddModalOpenChange={setAddModalOpen}
      canAddEvent={calendarAdmin}
    />
  );
}
