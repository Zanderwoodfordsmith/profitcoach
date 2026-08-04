-- Publish the Start Here onboarding overviews and curated actions.
-- Videos stay empty until the new recordings are ready.

insert into public.academy_lesson_content (
  course_id,
  lesson_id,
  video_url,
  body_markdown,
  recommended_actions,
  is_draft,
  is_deleted
)
values
  (
    'kickstart',
    'kickstart-welcome-welcome-program-overview',
    null,
    $md$
## Welcome

Welcome to the Profit Coach community.

You are here to build the confidence, skills and systems to win clients, coach them well and grow a profitable coaching business.

### Do these two things now

1. **Choose your next live call.** Open the Community Calendar and pick a call you can attend in the next seven days.
2. **Complete Start Here in order.** Mark each lesson complete as you go so you always know what is next.

![Where to mark a lesson complete](/academy/start-here/welcome-lesson.png)

Once you finish Start Here, complete your **Coach Action Plan** this week. That plan will turn the training into a clear route for your business.

Then use **Pick Your Path** to decide where to begin in the main programme.
$md$,
    '[
      {"id":"choose-next-live-call","text":"Choose a live call to attend in the next seven days"},
      {"id":"complete-start-here","text":"Complete every lesson in Start Here","completion":"tracked","verifyRule":"start_here_lessons_complete"}
    ]'::jsonb,
    false,
    false
  ),
  (
    'kickstart',
    'kickstart-welcome-member-wins',
    null,
    $md$
## Real outcomes from real coaches

The Wins tab below is where members share progress, client results and milestones from inside the community.

Read a few wins. Look for what the coach did, not just the result they achieved. The aim is to see what is possible and borrow ideas you can put into action.

Your win does not need to be huge. A good conversation, a booked call, a clearer offer, a client breakthrough or a task you had been avoiding all count.

When you make progress, post it here. Sharing wins helps you recognise your own momentum and shows other coaches what is working.

> If they did it, so can you.
$md$,
    '[
      {"id":"read-three-member-wins","text":"Read three member wins and note what made them possible"},
      {"id":"share-next-win","text":"Share your next meaningful win with the community"}
    ]'::jsonb,
    false,
    false
  ),
  (
    'kickstart',
    'kickstart-welcome-pick-your-path',
    null,
    $md$
## Pick the route that matches what you need now

First, finish **Start Here** today and complete your **Coach Action Plan** this week. Whichever route you choose, work through **Going Pro** at roughly one lesson per week alongside it.

### Path A — Start from the beginning

Choose this if you do not yet have enough people to speak to about coaching.

1. **Get Calls** — create conversations with the right people.
2. **Win Clients** — turn those conversations into coaching clients.
3. **Coach Clients** — deliver excellent coaching and results.

### Path B — Build your coaching confidence first

Choose this if your main concern is, "Can I confidently coach someone and get them a result?"

1. **Coach Clients** — learn the coaching process and build delivery confidence.
2. **Get Calls** — start creating more of the right conversations.
3. **Win Clients** — turn those conversations into paying clients.

### Path C — You already have people to speak to

Choose this if you already have calls booked, warm contacts or existing relationships you can approach — especially if you are pivoting into the Profit Coach model.

1. **Win Clients** — sharpen the offer and lead the next conversations well.
2. **Coach Clients** — be ready to deliver confidently when they say yes.
3. **Get Calls** — build a repeatable pipeline after you have used the opportunities already in front of you.

Do not overthink this choice. Start with the module that solves your immediate bottleneck, then continue through the other two.
$md$,
    '[
      {"id":"choose-programme-path","text":"Choose Path A, B or C based on your immediate bottleneck"},
      {"id":"open-first-path-module","text":"Open the first module in your chosen path"}
    ]'::jsonb,
    false,
    false
  ),
  (
    'kickstart',
    'kickstart-welcome-introduce-yourself',
    null,
    $md$
## Say hello

Introduce yourself in the Intros tab below. It gives the community enough context to welcome you, connect you with the right people and offer useful help.

Copy this template and make it your own:

> Hey everyone! I’m **[name]** from **[location]**.
>
> I currently **[what you do / who you help]**.
>
> Over the next 90 days, I want to **[specific business or coaching goal]**.
>
> Right now I am **[starting from scratch / building coaching confidence / already speaking to potential clients]**.
>
> I would especially value help with **[one specific thing]**.

Keep it simple. You do not need a polished story or a perfect offer before you introduce yourself.
$md$,
    '[
      {"id":"post-introduction","text":"Post your introduction in the community","completion":"tracked","verifyRule":"community_intro_posted"}
    ]'::jsonb,
    false,
    false
  ),
  (
    'kickstart',
    'kickstart-welcome-community-tour',
    null,
    $md$
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
    '[
      {"id":"reply-and-tag-member","text":"Reply to another coach and tag them in your response","completion":"tracked","verifyRule":"community_reply_with_mention"},
      {"id":"add-map-location","text":"Add your location on the Community Map","completion":"tracked","verifyRule":"community_map_location_set"},
      {"id":"browse-map-or-members","text":"Browse the Map or Members tab for coaches to connect with"}
    ]'::jsonb,
    false,
    false
  ),
  (
    'kickstart',
    'kickstart-welcome-classroom-tour',
    null,
    $md$
## Your training library

The Classroom is organised around the work you need to do, rather than a huge course you must watch from beginning to end.

![The Classroom library](/academy/start-here/classroom-library.png)

### Begin here

* **Start Here** — finish these onboarding lessons first.
* **Coach Action Plan** — decide your target, pace and priorities for the next 90 days.
* **Going Pro** — strengthen your energy, time, focus and mindset. Complete roughly one lesson each week alongside your main route.

### Build your coaching business

* **Get Calls** — create a consistent flow of conversations with potential clients.
* **Win Clients** — shape your offer, lead value sessions and enrol the right clients.
* **Coach Clients** — deliver excellent coaching, build confidence and help clients get results.
* **Profit Coach OS** — use the tools and systems that support your coaching business.

Follow the route you chose in **Pick Your Path**. You do not need to consume everything before taking action.

### Progress and points

Complete lessons to track your own progress. Community points come from useful participation — sharing, commenting and helping other members — not from passively watching content.

![How community points work](/academy/start-here/classroom-points.png)
$md$,
    '[
      {"id":"open-coach-action-plan","text":"Open Coach Action Plan and review what you will complete this week"},
      {"id":"schedule-going-pro","text":"Choose a weekly time for one Going Pro lesson"}
    ]'::jsonb,
    false,
    false
  ),
  (
    'kickstart',
    'kickstart-welcome-calendar-calls',
    null,
    $md$
## Put the calls in your calendar

Live calls help you turn the lessons into decisions and action. Open the **Community Calendar** to see the current schedule, access details and any changes.

The main call types include:

* **Win The Week** — choose the priority that will move your business forward and follow through.
* **Profit Coach Training** — develop your coaching, client-winning and business-building skills.
* **Monthly Momentum** — step back, review progress and set direction for the month.

The Community Calendar is always the source of truth because times and sessions can change, and some calls depend on your membership.

Choose the next useful call you can attend and add it to your own calendar now. Do not wait until you feel fully prepared — bring your current question or goal with you.
$md$,
    '[
      {"id":"add-calls-calendar","text":"Add the coaching calls to your calendar"},
      {"id":"choose-next-call-question","text":"Choose your next call and write down the question or goal you will bring"}
    ]'::jsonb,
    false,
    false
  ),
  (
    'kickstart',
    'kickstart-welcome-support',
    null,
    $md$
## Get unstuck quickly

Do not spend days wrestling with a problem alone. Use the community and live calls to get a clear next step.

### Ask in the community

Post in **Ask & Share** and include:

* A clear title and one-sentence description.
* What you are trying to achieve.
* What you have already tried.
* What happened versus what you expected.
* Screenshots, error messages or a short Loom when they add useful context.

Tag the relevant person when you are replying to them. When the issue is resolved, add a short comment explaining what fixed it so the answer can help the next coach too.

### Bring it to a live call

If the question needs discussion, judgement or live feedback, bring it to the most relevant session in the Community Calendar. Give the group the context briefly, then ask one clear question.

The better the context, the faster the community can help.
$md$,
    '[
      {"id":"save-support-checklist","text":"Use the support checklist when you next ask the community for help"}
    ]'::jsonb,
    false,
    false
  ),
  (
    'kickstart',
    'kickstart-welcome-tools-bonuses',
    null,
    $md$
## Useful extras — after the essentials

This is the place for tools, member benefits and referral details that can support your coaching business.

Start with **Profit Coach OS** when you need the practical systems behind your brand, client journey and coaching operation. Use the tools because they solve a real problem in your current plan — not because you feel you need to set up everything at once.

Any current member offers, recommended software and referral opportunities will be added to this lesson with their terms and instructions.

This lesson is deliberately last and optional. Do not let a new tool delay the work that matters most:

1. Finish **Start Here**.
2. Complete your **Coach Action Plan**.
3. Begin the first module in your chosen path.
4. Attend a live call and take the next real action.
$md$,
    '[
      {"id":"open-profit-coach-os","text":"Open Profit Coach OS when your action plan calls for a supporting tool or system"}
    ]'::jsonb,
    false,
    false
  )
on conflict (course_id, lesson_id) do update
set
  video_url = excluded.video_url,
  body_markdown = excluded.body_markdown,
  recommended_actions = excluded.recommended_actions,
  is_draft = excluded.is_draft,
  is_deleted = excluded.is_deleted,
  updated_at = now();
