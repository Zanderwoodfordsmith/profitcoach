/**
 * Help centre answers: short written answers to the questions coaches ask.
 *
 * One truth. The Help tab on Support, the top-bar search, Ava and the support
 * suggested replies all read this list. Keep each answer to a few plain
 * sentences. Link to the page in the app when there is one.
 *
 * `needs` marks an answer that still waits on a fact from Zander or Pam. Those
 * show with a label on the admin-only page and stay out of coach-facing uses
 * until the field is cleared.
 *
 * Sources: Support tickets since July 2026 (SUP-450 to SUP-610), community
 * question posts, Bruce's and Yair's WhatsApp questions to Pam (6 Nov 2026),
 * and content/ai-knowledge/support-copilot/playbook.md.
 */

export type HelpTopicId =
  | "getting-started"
  | "linkedin-newsletter"
  | "campaigns-prospects"
  | "boss-score"
  | "calls-calendar"
  | "connections"
  | "money"
  | "where-things-moved";

export type HelpTopic = {
  id: HelpTopicId;
  name: string;
  /** One line under the name on the topic card. */
  blurb: string;
};

export type HelpAnswer = {
  /** Stable id, used in links (#id) and search results. */
  id: string;
  topic: HelpTopicId;
  question: string;
  /** Plain text. Blank line = new paragraph. [label](/coach/path) = link. */
  answer: string;
  /** Other ways coaches put the same question. Used by search only. */
  aliases?: string[];
  /** Still waiting on a fact. Admin-only until cleared. */
  needs?: "zander" | "pam";
  /** Where the question came from, for admins. */
  sources?: string[];
};

export const HELP_TOPICS: HelpTopic[] = [
  { id: "getting-started", name: "Getting started", blurb: "Your first weeks, what BCA does for you, logins and calls." },
  { id: "linkedin-newsletter", name: "LinkedIn and your newsletter", blurb: "Your profile, the newsletter, connection notes." },
  { id: "campaigns-prospects", name: "Campaigns, lists and prospects", blurb: "The Pool, Sales Navigator, old campaigns, what prospects mean." },
  { id: "boss-score", name: "BOSS Score", blurb: "Links, results, graphics, the Pro version." },
  { id: "calls-calendar", name: "Calls and calendar", blurb: "Booking pages, Zoom links, availability, time zones." },
  { id: "connections", name: "Email and LinkedIn connections", blurb: "Connecting your accounts and what to do when messages go missing." },
  { id: "money", name: "Money and invoices", blurb: "Invoices, VAT, payment plans and what you've paid." },
  { id: "where-things-moved", name: "Where things moved", blurb: "The old Academy, the old CRM and links that no longer work." },
];

export const HELP_ANSWERS: HelpAnswer[] = [
  // Getting started
  {
    id: "first-weeks",
    topic: "getting-started",
    question: "What happens in my first few weeks?",
    answer:
      "You fill in the three About You pages in your Blueprint. That takes about an hour and it is the only writing we ask of you.\n\nWe then write your LinkedIn profile, build your prospect list and write your first campaign. You read them and tell us what to change. Once you are happy we turn the campaign on and messages start going out, usually on a Monday.\n\nYour [Blueprint](/coach/blueprint) shows each step, whose turn it is and what is done.",
    aliases: ["outline of the next few weeks", "what do I do next", "next steps", "where is the plan"],
    sources: ["Bruce, WhatsApp 6 Nov", "SUP-531", "SUP-574", "SUP-591"],
  },
  {
    id: "what-bca-does",
    topic: "getting-started",
    question: "What does BCA build for me, and what do I do myself?",
    answer:
      "You do the About You pages and you check what we write. We do the rest: your LinkedIn profile text, your prospect lists, your campaign messages, your newsletter, your booking page and your BOSS Score links.\n\nWhen something is ready for you to check, it shows on your [Blueprint](/coach/blueprint) and we message you in Support.",
    aliases: ["done for you", "what do you do for me"],
    sources: ["SUP-550", "SUP-565"],
  },
  {
    id: "own-name-or-company",
    topic: "getting-started",
    question: "Should I use my own name or a company name?",
    answer:
      "On LinkedIn, use your own name. People connect with a person, and your profile is where prospects land. Your company name goes on your invoices, your website and your booking page if you want it there.\n\nIf you already trade under a company name your clients know, keep it. Tell us in Support and we use it where it fits.",
    aliases: ["does the company name matter", "trading name", "business name"],
    needs: "zander",
    sources: ["Bruce, WhatsApp 6 Nov"],
  },
  {
    id: "instagram-facebook",
    topic: "getting-started",
    question: "Do I need Instagram or Facebook pages for my coaching business?",
    answer:
      "No. Your clients are owners of businesses with 11 to 50 staff, and they are on LinkedIn. LinkedIn plus your newsletter is the whole engine, so put your time there.\n\nIf you already run a Facebook or Instagram page, keep it going if you enjoy it, but it will not bring you clients on its own.",
    aliases: ["social media", "do I need facebook", "do I need instagram"],
    needs: "zander",
    sources: ["Bruce, WhatsApp 6 Nov"],
  },
  {
    id: "group-calls",
    topic: "getting-started",
    question: "When are the group calls, and where is the link?",
    answer:
      "Monday and Thursday at 4pm UK time. The link is always the same: [businesscoachacademy.com/calls](https://businesscoachacademy.com/calls).\n\nRecordings go in the Classroom a day or so after each call. Dates and any changes show on the [community calendar](/coach/community/calendar).",
    aliases: ["zoom link for calls", "call recording", "missed the call"],
    needs: "pam",
    sources: ["SUP-500", "community 1 Jun, 23 Jun"],
  },
  {
    id: "login-email",
    topic: "getting-started",
    question: "Which email is my login, and can I change it?",
    answer:
      "Open [Settings](/coach/settings) and look at Profile. The email shown there is your login.\n\nOne email is simplest. If you want to switch to a different address, tell us in Support and we change it the same day. You log in with the new address from then on.",
    aliases: ["change my email address", "which email am I registered with"],
    sources: ["SUP-602", "SUP-609"],
  },
  {
    id: "forgot-password",
    topic: "getting-started",
    question: "I can't log in. What do I do?",
    answer:
      "Go to [theprofitcoach.com/login](https://theprofitcoach.com/login) and click Reset password. The email lasts an hour, so check spam if it has not arrived in a minute.\n\nIf no email comes, message Support and we reset it for you. We never send a password in a message.",
    aliases: ["password reset", "credentials don't work", "locked out"],
    sources: ["SUP-559", "SUP-551"],
  },
  {
    id: "va-login",
    topic: "getting-started",
    question: "Can my assistant or VA have their own login?",
    answer:
      "Not yet. For now, share your login with your assistant if you trust them with your inbox and prospects.\n\nA second login for an assistant is on the list. Tell us in Support if you want it, so we know how many coaches are waiting.",
    aliases: ["second login", "virtual assistant access", "team member access"],
    needs: "zander",
    sources: ["SUP-607"],
  },
  {
    id: "been-away",
    topic: "getting-started",
    question: "I've been away for a while. What's changed?",
    answer:
      "Everything now lives in one place: [theprofitcoach.com/login](https://theprofitcoach.com/login). Training, campaigns, prospects, conversations, calendar, community and support are all here, and the old training site and old CRM are no longer needed.\n\nThe quickest way back in is a short call. Message Support and we book one and walk you through it.",
    aliases: ["catch up", "what have I missed", "platform moved"],
    sources: ["SUP-503", "SUP-510", "SUP-559"],
  },
  {
    id: "support-reply-time",
    topic: "getting-started",
    question: "What's the best way to reach BCA, and how fast do you reply?",
    answer:
      "Support, right here, is the best way. Pam and Zander both see it, and your question is never lost in a phone. We reply within one working day, often the same day.\n\nWhatsApp works for a quick hello, but Pam is on calls most of the day, so put anything you need an answer to in Support.",
    aliases: ["how do I contact", "whatsapp pam", "no reply"],
    sources: ["SUP-574"],
  },

  // LinkedIn and newsletter
  {
    id: "newsletter-what-happens",
    topic: "linkedin-newsletter",
    question: "What happens with the newsletter?",
    answer:
      "You write a LinkedIn newsletter, one issue at a time, and your campaign messages point prospects to it. It is the thing that makes a stranger trust you before a call.\n\nWe write the first issue from your Blueprint, in your voice, using your stories and results. You read it, change what you like and publish it on LinkedIn. After that, Ava writes each new issue with you in about twenty minutes. It lives on the [LinkedIn Newsletter page](/coach/blueprint) of your Blueprint.",
    aliases: ["newsletter", "do I need a newsletter", "who writes the newsletter"],
    sources: ["Bruce, WhatsApp 6 Nov", "content/agent/capabilities/linkedin-marketing"],
  },
  {
    id: "newsletter-first-issue",
    topic: "linkedin-newsletter",
    question: "Can my first newsletter be a general announcement?",
    answer:
      "Make it useful rather than an announcement. A first issue that says \"I'm now a Profit Coach\" gets a few likes from friends. A first issue about one real problem your ideal client has, and what to do about it, gets read by the people you want as clients.\n\nYou can still say who you are and what you do in the first line. We write the first issue for you, so you only need to tell us which problem to start with.",
    aliases: ["announce my business", "first issue", "launch post"],
    needs: "zander",
    sources: ["Bruce, WhatsApp 6 Nov"],
  },
  {
    id: "linkedin-profile-changes",
    topic: "linkedin-newsletter",
    question: "What should I change on my LinkedIn profile before my campaign goes live?",
    answer:
      "We write all five parts for you: headline, About, banner wording, experience and featured. They appear on the LinkedIn profile page of your [Blueprint](/coach/blueprint) once your About You pages are done.\n\nCopy each part into LinkedIn, then tell us in Support. We check it before the campaign goes live, because every message sends people to your profile.",
    aliases: ["update my linkedin", "linkedin headline", "banner"],
    sources: ["SUP-550", "SUP-565", "SUP-570", "SUP-591"],
  },
  {
    id: "bca-boost-profile",
    topic: "linkedin-newsletter",
    question: "Can BCA boost my LinkedIn profile?",
    answer:
      "We cannot buy you followers or push your profile in LinkedIn's system, and nobody can. What we do instead is write your profile so it reads well, and send a steady stream of the right people to it through your campaign. That is what grows a profile.\n\nIf you mean the banner image, we make that for you too. Ask in Support.",
    aliases: ["grow my linkedin", "linkedin followers", "promote my profile"],
    needs: "zander",
    sources: ["Yair, WhatsApp 6 Nov"],
  },
  {
    id: "connection-note",
    topic: "linkedin-newsletter",
    question: "Should I send connection requests with a note or without?",
    answer:
      "With a short note, written for the person. A note that mentions something real about them gets accepted more often than a blank request, and it starts the conversation.\n\nYour campaign does this for you. If you are sending by hand, keep the note to two lines, no pitch.",
    aliases: ["connection request note", "connect without a note", "acceptance rate"],
    needs: "zander",
    sources: ["community 26 Oct"],
  },

  // Campaigns, lists and prospects
  {
    id: "sales-nav-invalid-url",
    topic: "campaigns-prospects",
    question: "Sales Navigator link says \"invalid URL\" when I import. Why?",
    answer:
      "You pasted a Sales Navigator link into the LinkedIn search box, or the other way round. They are two different imports. Use the Sales Navigator option for a Sales Navigator link.\n\nIf the Sales Navigator option is greyed out, Sales Navigator has disconnected. Open [Settings](/coach/settings?tab=integrations), find Sales Navigator and connect it again.",
    aliases: ["sales navigator url", "import saved search", "url is missing query"],
    sources: ["SUP-505", "SUP-538", "SUP-563"],
  },
  {
    id: "linkedin-import-fewer",
    topic: "campaigns-prospects",
    question: "The LinkedIn import brought in fewer people than I have connections. Is that right?",
    answer:
      "Usually yes. The import brings in what LinkedIn returns, and LinkedIn often returns fewer than your total. If you asked for 2,500 and the list has 700, you get 700.\n\nIf the number looks far too low, send us the number you expected and the number you got, and we check.",
    aliases: ["import stuck", "only imported some connections"],
    sources: ["SUP-508"],
  },
  {
    id: "old-campaigns",
    topic: "campaigns-prospects",
    question: "Where are my old campaigns from the previous tool?",
    answer:
      "Open [Campaigns](/coach/campaigns) and scroll to the bottom. Click Archived. Your old campaigns are there with their steps, messages and people, so you can copy what worked into a new one.\n\nIf an old campaign is missing, tell us its name in Support and we bring it across.",
    aliases: ["previous campaigns", "archived campaigns", "connector campaigns"],
    sources: ["SUP-564", "SUP-572"],
  },
  {
    id: "old-automation-sending",
    topic: "campaigns-prospects",
    question: "Messages are still going out from my old automation. How do I stop it?",
    answer:
      "Nothing should still be sending from the old tool. All old campaigns were switched off when we moved everyone across, and they sit in Archived here.\n\nIf someone replies to an old message, send us their name and the date in Support. We look it up and make sure it has stopped.",
    aliases: ["stop old campaign", "connector still running"],
    sources: ["SUP-572"],
  },
  {
    id: "filtered-pool-next",
    topic: "campaigns-prospects",
    question: "I've filtered my Pool. What's the next step?",
    answer:
      "Tell us in Support which list you want to start with. We add those people to your campaign and check your LinkedIn profile is updated.\n\nThen we turn it on. Messages go out from the next Monday, and replies land in [Conversations](/coach/conversations).",
    aliases: ["pool ready", "start my campaign", "marketing campaign going"],
    sources: ["SUP-608"],
  },
  {
    id: "pool-search-wrong-businesses",
    topic: "campaigns-prospects",
    question: "The Pool search found the wrong kind of businesses. What can I do?",
    answer:
      "A broad term pulls in everything nearby that mentions it. \"IT services\" finds electricians and carpet cleaners who list IT work. Use the words the owner would use for their own business, and add the town or area.\n\nIf you are stuck on wording, tell us who you want and we run the search with you.",
    aliases: ["google maps import", "pool import wrong results"],
    sources: ["SUP-511"],
  },
  {
    id: "prospect-stages",
    topic: "campaigns-prospects",
    question: "On Prospects, what do Expressed, Lead magnet and Not started mean?",
    answer:
      "Not started: they have your scorecard link but have not opened it. Lead magnet: they opened or started the scorecard. Expressed: they finished it, so they have shown interest and you should call them.\n\nThe stage changes on its own as they move. Open the person to see what they did and when.",
    aliases: ["prospect status", "expressed interest", "prospects tab"],
    needs: "zander",
    sources: ["community 2 Oct"],
  },
  {
    id: "stop-scorecard-emails",
    topic: "campaigns-prospects",
    question: "Someone took the scorecard who isn't a prospect. How do I stop their follow-up emails?",
    answer:
      "Open [Prospects](/coach/prospects), find the person and turn off their follow-up. That stops the sequence for them and nobody else.\n\nIf you cannot find them, send us their name or email in Support and we stop it.",
    aliases: ["unsubscribe prospect", "stop nurture emails", "spamming her"],
    needs: "zander",
    sources: ["community 28 Oct"],
  },
  {
    id: "campaign-feedback",
    topic: "campaigns-prospects",
    question: "Can you check my campaign messages before I send them?",
    answer:
      "Yes. Paste them into Support, or tell us the campaign name, and we read them before they go out. We look at the opening line, how the scorecard comes in and whether each message earns a reply.\n\nOnly send what you are comfortable sending. Then watch the numbers and change one thing at a time.",
    aliases: ["review my messaging", "campaign copy feedback"],
    sources: ["SUP-507"],
  },

  // BOSS Score
  {
    id: "boss-vs-pro",
    topic: "boss-score",
    question: "What's the difference between the BOSS Score and BOSS Pro?",
    answer:
      "BOSS stands for Business Operating System Score. The BOSS Score is the short one: 10 questions plus 3, done in three minutes. It is your lead magnet, so prospects take it before a call.\n\nBOSS Pro is the full 50-question version you run with a client. It lives under Keep Clients at [BOSS Pro](/coach/boss-pro).",
    aliases: ["boss pro", "50 questions", "what does boss stand for"],
    sources: ["playbook", "SUP-609"],
  },
  {
    id: "scorecard-links",
    topic: "boss-score",
    question: "Where are my BOSS Score links to send to prospects?",
    answer:
      "Under Get Clients, open [Campaigns, then Lead magnets](/coach/lead-magnets). Each link is yours, so anyone who completes it shows up in your Prospects with their score.\n\nThe older videos show this under Settings. It moved, and the videos are being redone.",
    aliases: ["scorecard link", "lead magnet link", "boss score not in my profile"],
    sources: ["SUP-609", "SUP-558"],
  },
  {
    id: "scorecard-results",
    topic: "boss-score",
    question: "A prospect finished the scorecard. Where do I see their answers?",
    answer:
      "Open [Prospects](/coach/prospects), click the person, then BOSS Score. You see their score, each answer and when they did it.\n\nYou also get an email when someone completes it, so you can call them while it is fresh.",
    aliases: ["see scorecard answers", "completed scorecard", "only see the score"],
    sources: ["playbook", "community 26 May", "SUP-496"],
  },
  {
    id: "send-prospect-their-scorecard",
    topic: "boss-score",
    question: "Can I send a prospect a copy of the scorecard they filled in?",
    answer:
      "Open the person in [Prospects](/coach/prospects), go to BOSS Score and use Share. They get their results page by email.\n\nIf you want it as a PDF for a meeting, ask in Support and we send one.",
    aliases: ["resend scorecard results", "prospect lost their scorecard"],
    needs: "zander",
    sources: ["community 13 Jul"],
  },
  {
    id: "video-out-of-date",
    topic: "boss-score",
    question: "The video shows settings I don't have. Am I missing something?",
    answer:
      "No. Some videos were made before the app changed and show screens that have moved. BOSS Score links are now under Campaigns, Lead magnets. Calendar and inbox are now in this app, not the old CRM.\n\nIf a video and the app disagree, trust the app and ask in Support. We point you to the right place and fix the video.",
    aliases: ["video is wrong", "can't find what's in the video"],
    sources: ["SUP-558", "SUP-609"],
  },
  {
    id: "logos-graphics",
    topic: "boss-score",
    question: "Where do I get the Profit Coach logo and BOSS Score graphics for print?",
    answer:
      "Print-ready logos are in the [brand folder on Google Drive](https://drive.google.com/drive/folders/1HOJrtvNCSk3qUoqiQXxQvUeKh2ns89Oo?usp=sharing). Use them on letterheads, banners and slides.\n\nFor the BOSS wheel, the five levels and the scorecard graphic as SVG, ask in Support and we send the files.",
    aliases: ["logo download", "letterhead", "svg files", "brand kit"],
    sources: ["SUP-467", "SUP-557", "community 21 May"],
  },

  // Calls and calendar
  {
    id: "booking-no-zoom-link",
    topic: "calls-calendar",
    question: "My booking confirmation has no Zoom or meeting link. Why?",
    answer:
      "The calendar has no location set, or the app that makes the link is not connected. Open [Calls](/coach/calls), click Settings at the top right, and choose Zoom or Google Meet as the location.\n\nBook a test call to yourself afterwards. The link should be in the email and the calendar entry.",
    aliases: ["no meeting link", "zoom link missing", "boss review booking"],
    sources: ["SUP-483", "SUP-494"],
  },
  {
    id: "no-availability",
    topic: "calls-calendar",
    question: "My booking page shows no available times. Where do I set my hours?",
    answer:
      "Open [Calls](/coach/calls) and click Settings at the top right. Set the days and hours you take calls and how much notice you need.\n\nIf a day you expect to be free shows nothing, check your own calendar. A busy event there blocks that time.",
    aliases: ["set availability", "calendar hours", "nothing available to book"],
    sources: ["SUP-573", "community 10 Jun"],
  },
  {
    id: "wrong-booking-time",
    topic: "calls-calendar",
    question: "A booking shows the wrong time. What's wrong?",
    answer:
      "The time zone. Check it in your calendar settings under [Calls](/coach/calls) and in your [Profile](/coach/settings). Both should say UK.\n\nIf they are right and a booking is still an hour out, send us the booking in Support.",
    aliases: ["time zone", "booking an hour out"],
    sources: ["SUP-465"],
  },
  {
    id: "two-people-one-call",
    topic: "calls-calendar",
    question: "How do I get two people onto one call?",
    answer:
      "Book the main contact as normal, then open the event in your Google or Outlook calendar and add the second person. Only the main contact gets the reminder emails.\n\nIf they book themselves, turn on Allow guests in your calendar settings under [Calls](/coach/calls) so they can add a colleague.",
    aliases: ["add a guest", "book two contacts", "partners on the call"],
    sources: ["SUP-521"],
  },
  {
    id: "zoom-scheduler",
    topic: "calls-calendar",
    question: "Zoom says Scheduler Basic has ended. Does that affect me?",
    answer:
      "Only if you used Zoom's own scheduler for bookings. Your booking page here does not need it.\n\nYou still need a way to make meeting links. A paid Zoom plan works, and so does Google Meet, which is free. Set your choice under [Calls](/coach/calls), Settings.",
    aliases: ["zoom scheduler", "zoom paid plan", "google meet"],
    sources: ["SUP-503", "playbook"],
  },

  // Email and LinkedIn connections
  {
    id: "connect-linkedin",
    topic: "connections",
    question: "How do I connect my LinkedIn so campaigns can send?",
    answer:
      "Open [Settings](/coach/settings?tab=integrations), find LinkedIn and click Connect. It takes about a minute. LinkedIn may ask for a code from your email or phone, so have it nearby.\n\nSales Navigator connects on the same page.",
    aliases: ["linkedin integration", "connect linkedin account"],
    sources: ["SUP-600", "SUP-519"],
  },
  {
    id: "send-from-own-email",
    topic: "connections",
    question: "Can I send emails from my own address?",
    answer:
      "Yes, if your email is Gmail or Outlook. Open [Settings](/coach/settings?tab=integrations) and connect it. Emails then send from your address and replies show in [Conversations](/coach/conversations).\n\nIf you use a work Microsoft 365 account, Microsoft may say your organisation needs to approve the app. Your IT contact can approve it in a minute.",
    aliases: ["gmail", "outlook", "email integration", "send from my domain"],
    sources: ["SUP-493", "SUP-562"],
  },
  {
    id: "messages-missing",
    topic: "connections",
    question: "LinkedIn or email messages are missing from Conversations. What do I check?",
    answer:
      "Open [Settings](/coach/settings?tab=integrations) and check the account shows as connected. If it has dropped, connect it again and the messages come back.\n\nIf it is connected and messages are still missing, send us one example in Support, with the person's name, and we look at it.",
    aliases: ["conversations empty", "can't see linkedin messages", "email content not showing"],
    sources: ["SUP-519", "SUP-520", "SUP-566"],
  },
  {
    id: "unknown-contact",
    topic: "connections",
    question: "A conversation shows \"Unknown contact\" even though I know who it is. Why?",
    answer:
      "The person has letters or a tagline after their name on LinkedIn, and the inbox could not read it as a name. We fixed the common cases, so new conversations pick up the name.\n\nIf you still see one, send us a screenshot in Support.",
    aliases: ["unknown contact", "name not recognised"],
    sources: ["SUP-566", "SUP-556"],
  },

  // Money and invoices
  {
    id: "find-invoices",
    topic: "money",
    question: "Where are my invoices?",
    answer:
      "Open [Settings, Billing](/coach/settings?tab=billing). Every payment is listed under Payment history with an Invoice button.\n\nTo put your business name, address, company number or VAT number on them, fill in Invoice details on the same page. Download the invoice again and the details are on it.",
    aliases: ["invoice", "receipt", "accountant needs invoices", "vat number on invoice"],
    sources: ["SUP-595", "SUP-610", "playbook"],
  },
  {
    id: "ask-for-invoice",
    topic: "money",
    question: "A payment says \"Ask for invoice\". What does that mean?",
    answer:
      "That payment went through a separate account, so we make the invoice by hand. Click it, or message Support with the date and amount, and we send it within a day.",
    aliases: ["missing invoice", "buy-in invoice"],
    sources: ["SUP-610", "playbook"],
  },
  {
    id: "no-vat",
    topic: "money",
    question: "Why is there no VAT on my invoice?",
    answer:
      "Business Coach Academy Limited is our UK payment company and is below the VAT registration threshold, so no VAT is charged. Your invoice is still a valid invoice for your accounts.",
    aliases: ["vat", "tax on invoice"],
    sources: ["playbook"],
  },
  {
    id: "payment-plan-finished",
    topic: "money",
    question: "Has my payment plan finished, and how much have I paid in total?",
    answer:
      "Your [Billing page](/coach/settings?tab=billing) lists every payment, so you can add them up there. If you want it confirmed in writing, ask in Support and we send the total and the dates.",
    aliases: ["monthly payments finished", "how much have I paid", "plan complete"],
    sources: ["SUP-598", "SUP-571"],
  },
  {
    id: "payment-bounced",
    topic: "money",
    question: "A payment bounced or I need to pay late. What should I do?",
    answer:
      "Tell us in Support before the next attempt. We agree a date with you and stop the reminders. Things come up, and a message saves everyone a chase.",
    aliases: ["payment failed", "pay late", "direct debit bounced"],
    needs: "pam",
    sources: ["SUP-542", "SUP-545"],
  },
  {
    id: "restart-membership",
    topic: "money",
    question: "How do I restart or change my membership?",
    answer:
      "Open [Settings, Billing](/coach/settings?tab=billing). Your plan shows there with a Restart or Change button.\n\nIf you have been given a code, click Add promotion code on the payment page and type it before you pay. If anything looks wrong, ask in Support before paying and we check it.",
    aliases: ["premium plan", "cancelled plan", "promotion code", "membership link"],
    sources: ["SUP-571", "SUP-549"],
  },

  // Where things moved
  {
    id: "platform-no-longer-active",
    topic: "where-things-moved",
    question: "I see \"this platform is no longer active\". Where do I go?",
    answer:
      "You opened the old training site. Everything moved here in May 2026. Log in at [theprofitcoach.com/login](https://theprofitcoach.com/login).\n\nIf your password does not work, click Reset password on that page.",
    aliases: ["academy hub", "disco", "old training platform"],
    sources: ["SUP-495", "SUP-503", "SUP-559"],
  },
  {
    id: "old-crm",
    topic: "where-things-moved",
    question: "Do I still need the old CRM?",
    answer:
      "No. Calendar, bookings, conversations, prospects and campaigns all run here now, and we set them up for you. The old CRM at app.procoachplatform.com still runs for coaches who have not moved yet, and you do not have to move until you are ready.\n\nOur advice is to use everything here. One login, one inbox, and we can help with all of it.",
    aliases: ["pro coach crm", "procoachplatform", "old system"],
    sources: ["SUP-503", "SUP-558", "SUP-510"],
  },
  {
    id: "old-links-in-lessons",
    topic: "where-things-moved",
    question: "A link in a lesson asks me to log in somewhere else. Is it broken?",
    answer:
      "Yes, that link is out of date. Some lessons still point at the old site. Tell us which lesson in Support and we fix it and send you the new place.\n\nThe tools themselves are in [Toolkit](/coach/toolkit) under Get Clients.",
    aliases: ["disco login", "broken link in lesson", "roi calculator", "pairwise tool"],
    sources: ["SUP-466", "community 15 Jun", "playbook"],
  },
  {
    id: "call-recordings",
    topic: "where-things-moved",
    question: "Where are the recordings of the group calls?",
    answer:
      "In the [Classroom](/coach/academy/classroom), in the week they were recorded. They go up a day or so after the call.\n\nIf you cannot find one, say which date in Support and we send the link.",
    aliases: ["recording of thursday's call", "missed call recording"],
    sources: ["community 1 Jun", "community 23 Jun"],
  },
  {
    id: "certification",
    topic: "where-things-moved",
    question: "How do I get certified now?",
    answer:
      "Certification is a sales call in the [client simulator](/coach/script/simulator). You run the call, it is scored, and you pass at 60 percent. Your result and feedback come back to you in Support within a week.\n\nIf you did the assessment and have not heard back, tell us in Support and we chase it.",
    aliases: ["certificate", "coach assessment", "certified profit coach", "mark has left"],
    needs: "zander",
    sources: ["Yair, WhatsApp 6 Nov", "SUP-525", "SUP-583"],
  },
];

export function helpTopic(id: HelpTopicId): HelpTopic {
  return HELP_TOPICS.find((t) => t.id === id) ?? HELP_TOPICS[0];
}

/** Answers safe to show coaches, Ava and suggested replies: nothing still waiting on a fact. */
export function confirmedHelpAnswers(): HelpAnswer[] {
  return HELP_ANSWERS.filter((a) => !a.needs);
}

/** Markdown of the confirmed answers, for prompts. Links keep their app paths. */
export function helpAnswersAsMarkdown(answers: HelpAnswer[] = confirmedHelpAnswers()): string {
  const byTopic = new Map<HelpTopicId, HelpAnswer[]>();
  for (const a of answers) byTopic.set(a.topic, [...(byTopic.get(a.topic) ?? []), a]);
  const parts: string[] = [];
  for (const topic of HELP_TOPICS) {
    const list = byTopic.get(topic.id);
    if (!list?.length) continue;
    parts.push(`## ${topic.name}`);
    for (const a of list) parts.push(`### ${a.question}\n${a.answer}`);
  }
  return parts.join("\n\n");
}

/** Simple word match over question, aliases and answer. Returns best first. */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "at", "for", "is", "are", "am", "was", "were", "be",
  "do", "does", "did", "can", "could", "should", "would", "will", "i", "my", "me", "we", "our", "you", "your",
  "it", "its", "this", "that", "there", "how", "what", "when", "where", "which", "who", "why", "with", "from",
  "into", "up", "out", "so", "if", "not", "no", "yes", "get", "got", "have", "has", "had", "been", "about",
]);

/** Lower-case words, stop words gone, simple plurals and "-ing" trimmed so "calls" meets "call". */
function stemWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9£]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map((w) => w.replace(/(ies|es|s|ing|ed)$/, (m) => (m === "ies" ? "y" : w.length > 4 ? "" : m)));
}

const ASKING_WORDS = ["how", "what", "when", "where", "which", "who", "why", "can"];

/** True when every word of `needle` appears in `hay` in the same order, side by side. */
function inOrder(needle: string[], hay: string[]): boolean {
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((w, j) => hay[i + j] === w)) return true;
  }
  return false;
}

/**
 * Same idea as the Postgres full-text search the rest of the app uses: the question counts most (weight A),
 * aliases next, the body least, stop words are ignored, and a whole phrase found in the question wins outright.
 */
export function searchHelpAnswers(query: string, answers: HelpAnswer[] = HELP_ANSWERS, limit = 20): HelpAnswer[] {
  const phrase = query.toLowerCase().replace(/[^a-z0-9£ ]+/g, " ").replace(/\s+/g, " ").trim();
  const words = stemWords(query);
  if (!words.length && phrase.length < 2) return [];
  const scored = answers
    .map((a) => {
      const q = a.question.toLowerCase();
      const qWords = stemWords(a.question);
      const alWords = stemWords((a.aliases ?? []).join(" "));
      const bodyWords = stemWords(a.answer);
      let score = 0;
      for (const w of words) {
        if (qWords.includes(w)) score += 3;
        else if (alWords.includes(w)) score += 2;
        else if (bodyWords.includes(w)) score += 1;
      }
      // "when" and "where" are stop words, but they split "when are the calls" from "where are the recordings".
      for (const w of ASKING_WORDS) if (phrase.split(" ").includes(w) && q.split(/[^a-z]+/).includes(w)) score += 1;
      // The typed words sit in the question in the same order: that is the answer they mean.
      if (words.length >= 2 && inOrder(words, qWords)) score += 20;
      if (phrase.length >= 4 && q.startsWith(phrase)) score += 10;
      return { a, score };
    })
    // A word found only in the body is too loose on its own ("link" is in half the answers).
    .filter((x) => x.score >= 2)
    .sort((x, y) => y.score - x.score);
  return scored.slice(0, limit).map((x) => x.a);
}
