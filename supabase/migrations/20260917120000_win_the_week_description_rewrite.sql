-- Win The Week: drop “front of the queue” / form CTA; keep pre-review framing.

UPDATE community_calendar_events
SET description = $desc$Weekly working session to move your Profit Coach business forward. This is not a training session. It's one hour focused on getting you unstuck for the week ahead (implementation and Q&A). Bring your questions about outreach, offers, Value Sessions, delivery, time-management, or anything else standing in your way – including your own beliefs.

We'll work through them live so you leave with clear next actions for the week.

Send your questions ahead when you can — we review them before the session so we can group similar challenges and give sharper, more complete answers. We start with people who are live on the call, then open up to live questions, and work through as many as we can in the hour.

If we don't get to your question and it's high-leverage for the group, we may follow up with a short Loom or cover it on a future call.$desc$
WHERE id IN (
  'd1ae0ec5-0594-4a49-ac2b-ab18cb6a4a83', -- Win The Week (pre-Aug 2026)
  'c8f10000-0000-4000-a000-000000000001'  -- Win The Week (from Aug 2026)
);
