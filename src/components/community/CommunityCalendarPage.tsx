"use client";

import { useEffect, useState } from "react";

import { supabaseClient } from "@/lib/supabaseClient";
import { CommunityCalendar } from "@/components/community/CommunityCalendar";
import { fetchProfileRole } from "@/lib/getClients/cachedProfileRole";

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
      const body = (await fetchProfileRole(uid)) as { role?: string };
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
