-- Refresh Community Tour overview: Members + Map sections, and map action.
update public.academy_lesson_content
set
  body_markdown = $md$
## The Community feed

The Community is where you ask questions, share progress and learn from coaches working through the same challenges.

When replying to someone, tag them with **@their name** so they see your response.

![Tag the person you are replying to](/academy/start-here/community-tagging.png)

### Where to post

* **💬 General Discussion** — questions, ideas and conversations that do not fit another category.
* **🏆 Wins** — client results, booked calls, shipped work and meaningful progress.
* **🚨 Announcements** — important updates from the Profit Coach team.
* **🗣️ Ask & Share** — ask for help or share work when you want feedback.
* **👋 Intros** — welcome new members and introduce yourself.

### Members

Open the **Members** tab to browse coaches in the community. Search by name, see who is online, and open someone’s profile when you want to connect.

### Map

The **Map** tab shows where members are around the world. Use the location box on the map to add your city and place a pin so nearby coaches can find you.

### Get better answers

When asking for help, include what you are trying to achieve, what you have already tried and the specific point where you are stuck. Screenshots or a short Loom are useful when the question is visual or technical.

Be generous too. If you know the answer to another coach’s question, jump in.
$md$,
  recommended_actions = '[
    {"id":"reply-and-tag-member","text":"Reply to another coach and tag them in your response","completion":"tracked","verifyRule":"community_reply_with_mention"},
    {"id":"add-map-location","text":"Add your location on the Community Map","completion":"tracked","verifyRule":"community_map_location_set"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'kickstart'
  and lesson_id = 'kickstart-welcome-community-tour';
