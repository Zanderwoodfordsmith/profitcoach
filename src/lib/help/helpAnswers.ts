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
  | "using-get-clients"
  | "app-and-ava"
  | "training"
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
  /** A video that shows the steps, played at the top of the answer. `src` is a full URL or a path in the academy-lessons bucket (e.g. tutorials/x.mp4). */
  video?: { src: string; title: string };
};

export const HELP_TOPICS: HelpTopic[] = [
  { id: "getting-started", name: "Getting started", blurb: "Your first weeks, what BCA does for you, logins and calls." },
  { id: "linkedin-newsletter", name: "LinkedIn and your newsletter", blurb: "Your profile, the newsletter, connection notes." },
  { id: "campaigns-prospects", name: "Campaigns, lists and prospects", blurb: "The Pool, Sales Navigator, old campaigns, what prospects mean." },
  { id: "boss-score", name: "BOSS Score", blurb: "Links, results, graphics, the Pro version." },
  { id: "calls-calendar", name: "Calls and calendar", blurb: "Booking pages, Zoom links, availability, time zones." },
  { id: "connections", name: "Email and LinkedIn connections", blurb: "Connecting your accounts and what to do when messages go missing." },
  { id: "using-get-clients", name: "Using Get Clients", blurb: "Your Blueprint, the Pool, campaigns, replies and the Scoreboard." },
  { id: "app-and-ava", name: "The app and Ava", blurb: "Ava, the Support chat, notifications, your phone and the community." },
  { id: "training", name: "Training and certification", blurb: "The Classroom, the Vault, the simulator and getting certified." },
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
      "1. In [Pool](/coach/campaigns?tab=pool), tick the people you want.\n2. Click Add to campaign and pick the campaign.\n\nA LinkedIn campaign needs people with a LinkedIn profile, and an email campaign needs an email address. Anyone on your blacklist is left out on its own. You can also add them from inside the campaign: open its Prospects tab, click Add prospects and choose Already in the system.\n\nRather we did it? Tell us in Support which list to start with and we add them for you.",
    aliases: ["pool ready", "start my campaign", "marketing campaign going", "add to campaign", "add list to campaign", "add prospects"],
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
      "Under Get Clients, open [Campaigns, then Lead Magnets](/coach/campaigns?tab=magnets). Each link is yours, so anyone who completes it shows up in your Prospects with their score.\n\nThe older videos show this under Settings. It moved, and the videos are being redone.",
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
      "Print-ready logos are in the [brand folder on Google Drive](https://drive.google.com/drive/folders/1HOJrtvNCSk3qUoqiQXxQvUeKh2ns89Oo?usp=sharing). Use them on letterheads, banners and slides.\n\nThe BOSS Compass, the BOSS Wheel and the 50 playbooks are in [Toolkit, then Brand graphics](/coach/toolkit?view=brand), as PNG or SVG. Posts, banners and the A4 scorecard with your name and QR code are under Social media posts and Print.",
    aliases: ["logo download", "letterhead", "svg files", "brand kit"],
    sources: ["SUP-467", "SUP-557", "community 21 May"],
  },

  // Calls and calendar
  {
    id: "booking-no-zoom-link",
    topic: "calls-calendar",
    question: "My booking confirmation has no Zoom or meeting link. Why?",
    answer:
      "The calendar has no meeting link set. To add one:\n\n1. Open [Calls settings](/coach/calls?tab=settings) and click the calendar name.\n2. Under How the call happens, choose Google Meet if your Google account is connected, or Custom and paste your own Zoom link.\n3. Click Save calendar.\n4. Book a test call to yourself. The link should be in the email and the calendar entry.\n\nChoose Zoom only once Zoom shows Connected in [Settings](/coach/settings?tab=integrations). Until then a Zoom calendar cannot take bookings.",
    aliases: ["no meeting link", "zoom link missing", "boss review booking"],
    sources: ["SUP-483", "SUP-494", "app"],
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
      "Book the main contact as normal, then open the event in your Google or Outlook calendar and add the second person. Only the main contact gets the reminder emails.\n\nIf they book themselves, ask them to forward the calendar invite to their colleague.",
    aliases: ["add a guest", "book two contacts", "partners on the call"],
    sources: ["SUP-521"],
  },
  {
    id: "zoom-scheduler",
    topic: "calls-calendar",
    question: "Zoom says Scheduler Basic has ended. Does that affect me?",
    answer:
      "Only if you used Zoom's own scheduler for bookings. Your booking page here does not need it.\n\nYou still need a way to make meeting links. Google Meet is free, or paste your own Zoom link. Open [Calls settings](/coach/calls?tab=settings), click the calendar name and choose under How the call happens.",
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
      "Yes, if your email is Gmail or Outlook. Open [Settings](/coach/settings?tab=integrations) and connect it. Emails then send from your address, replies show in [Conversations](/coach/conversations), and your BOSS Score report and follow-ups go from you too.\n\nIf you use a work Microsoft 365 account, Microsoft may say your organisation needs to approve the app. Your IT contact can approve it in a minute.",
    aliases: ["gmail", "outlook", "email integration", "send from my domain"],
    sources: ["SUP-493", "SUP-562"],
  },
  {
    id: "messages-missing",
    topic: "connections",
    question: "LinkedIn or email messages are missing from Conversations. What do I check?",
    answer:
      "In [Conversations](/coach/conversations), click Sync now. If it says LinkedIn needs reconnecting, click Reconnect and sign in to LinkedIn again. The messages come back once it shows Connected.\n\nIf it says LinkedIn asked us to slow down, wait a few minutes. It tries again on its own. Older messages can take up to an hour to arrive.\n\nIf it is connected and a message is still missing, send us one example in Support, with the person's name, and we look at it.",
    aliases: ["conversations empty", "can't see linkedin messages", "email content not showing", "linkedin message sync failing", "sync not working", "reconnect linkedin"],
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
    aliases: ["academy hub", "bca academy hub", "disco", "old training platform", "academy.businesscoachacademy.com", "portal has moved", "coach directory"],
    sources: ["SUP-495", "SUP-503", "SUP-559", "ticket 8 Sep (Platforms)", "ticket 13 Oct (Log in failure to portal)"],
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
    topic: "training",
    question: "Where are the recordings of the group calls?",
    answer:
      "In the [Classroom](/coach/academy/classroom), in the week they were recorded. They go up a day or so after the call.\n\nIf you cannot find one, say which date in Support and we send the link.",
    aliases: ["recording of thursday's call", "missed call recording"],
    sources: ["community 1 Jun", "community 23 Jun"],
  },
  {
    id: "certification",
    topic: "training",
    question: "How do I get certified now?",
    answer:
      "Certification is a sales call in the [Call simulator](/coach/script/simulator). Open Get Clients, then Scripts, and click Start practising. You run the call, it's scored, and you pass at 60 percent. Your result and feedback come back to you in Support within a week.\n\nIf you did the assessment and haven't heard back, tell us in Support and we chase it.",
    aliases: ["certificate", "coach assessment", "certified profit coach", "mark has left"],
    needs: "zander",
    sources: ["Yair, WhatsApp 6 Nov", "SUP-525", "SUP-583"],
  },

  // Using Get Clients
  {
    id: "about-you-done-next",
    topic: "using-get-clients",
    question: "I've done About You. What happens next?",
    answer:
      "Next is your Blueprint Call. Book it from Get set up on your [Blueprint](/coach/blueprint). On the call we agree your market and your offer, and then we write the rest of your Blueprint.\n\nEach page shows a label. BCA to do and In progress mean we are writing it, so there is nothing for you to do. Review means it is ready for you. Read it, change anything that is off, then press Sign off this page.\n\nWhile you wait, work through Get set up: connect LinkedIn and your email, put the app on your phone and turn on reply alerts. Once you sign off your campaign, we switch it on.",
    aliases: ["finished about you", "about me done", "what do I do now", "blueprint next step", "anything else you need from me", "when does my campaign start", "sign off this page"],
    sources: ["ticket 1 Nov", "ticket 21 Oct", "app"],
  },
  {
    id: "start-new-campaign",
    topic: "using-get-clients",
    question: "How do I start a new campaign myself?",
    answer:
      "Open [Campaigns](/coach/campaigns), then:\n\n1. Click Create campaign.\n2. Give it a name and pick LinkedIn, Email or WhatsApp.\n3. Choose Blank to write it yourself, or Templates to start from one we wrote.\n4. Open the Steps tab and write or check the messages.\n5. Open the Prospects tab, click Add prospects and bring people in from your Pool.\n6. Flip the switch next to its name on the Campaigns list to start it.\n\nLinkedIn needs to be connected first. An email campaign needs Gmail or Outlook connected.",
    aliases: ["launch a campaign", "create campaign", "set up a new campaign", "use a template", "turn my campaign on"],
    sources: ["ticket 19 Nov", "SUP-608", "app"],
  },
  {
    id: "pause-stop-campaign",
    topic: "using-get-clients",
    question: "How do I pause or stop a campaign?",
    answer:
      "On [Campaigns](/coach/campaigns), flip the switch next to the campaign's name to off. Nothing more goes out until you switch it back on, and everyone keeps their place.\n\nTo put it away, click the three dots on its row and choose Archive. It stops sending and moves to Archived at the bottom of the list, where you can Unarchive it later. Delete removes the campaign, its steps and its queue for good. Your conversations and prospects stay either way.",
    aliases: ["turn campaign off", "pause campaign", "archive a campaign", "delete a campaign", "stop sending"],
    sources: ["SUP-572", "app"],
  },
  {
    id: "edit-campaign-message",
    topic: "using-get-clients",
    question: "How do I change a message in my campaign?",
    answer:
      "Open the campaign from [Campaigns](/coach/campaigns) and go to the Steps tab. Click the step you want and change the words. It saves as you go.\n\nThe change only reaches people who have not had that message yet. Anything already sent stays as it was.\n\nWant a second opinion first? Paste the new wording into Support and we read it.",
    aliases: ["edit message", "change my follow up", "edit connection note", "update campaign wording", "edit steps"],
    sources: ["SUP-507", "app"],
  },
  {
    id: "add-link-to-message",
    topic: "using-get-clients",
    question: "How do I put a link in a campaign message?",
    answer:
      "Open the step in the Steps tab. Under the message box is a row of fields you can click to add. Booking link adds your booking page, set up for that person, so the call links back to the campaign. Boss assessment link adds your BOSS Score link. Each person gets their own version when it sends.\n\nFor any other link, such as a video or a web page, paste the full web address into the message.\n\nYou find your BOSS Score links to copy under [Campaigns, then Lead Magnets](/coach/campaigns?tab=magnets).",
    aliases: ["add booking link", "add scorecard link", "click through link", "links in messages", "merge fields", "personalise message"],
    sources: ["ticket 17 Nov", "app"],
  },
  {
    id: "add-video-voice-note",
    topic: "using-get-clients",
    question: "How do I add a video or voice note to a campaign?",
    answer:
      "1. Open the campaign and go to the Steps tab.\n2. Add a Video message or Voice note step. Or open a LinkedIn message step and switch it from Message to Voice or Video.\n3. Click Record to make it there, or Upload to use a file you already have.\n\nVideos can be MP4 or MOV, and voice notes M4A or MP3. Each file must be under 50 MB and up to 5 minutes long.\n\nIf an upload fails, send us the file and the campaign name in Support and we add it for you.",
    aliases: ["video can't upload", "upload video", "voice note", "record a video", "video too big", "50 MB"],
    sources: ["ticket 20 Nov", "app"],
  },
  {
    id: "manual-messages-to-do",
    topic: "using-get-clients",
    question: "A step says \"You send this yourself\". Where do I send it?",
    answer:
      "That step is set to Manual. When someone reaches it, it waits for you in To do, the panel on the right of [Campaigns](/coach/campaigns). Click Send, Snooze it for later, or Skip it and the sequence carries on.\n\nPhone call steps show there too. Press Mark as called once you have rung them.\n\nIf you would rather it sent on its own, open the step and switch it from Manual. You can also turn on a fallback, so it sends by itself if you have not sent it in time.",
    aliases: ["remind me messages", "manual step", "to do list", "call step", "messages waiting for me"],
    sources: ["app"],
  },
  {
    id: "campaign-sending-limits",
    topic: "using-get-clients",
    question: "How many messages go out, and when?",
    answer:
      "Click Settings at the top of [Campaigns](/coach/campaigns). You set weekly targets for connection requests, messages and post likes, plus the hours they send in. These cover every campaign on your LinkedIn account, and we spread them across your sending hours.\n\nWe suggest 100 connection requests a week. Once your LinkedIn Social Selling Index is 70 or more, you can go up to 200.\n\nSafety warm-up starts a new or quiet account slowly over four weeks, so LinkedIn is less likely to restrict it. Leave it on unless we tell you otherwise.",
    aliases: ["daily limit", "how many invites", "sending hours", "warm up", "ssi score", "linkedin limits"],
    sources: ["SUP-519", "app"],
  },
  {
    id: "fill-pool",
    topic: "using-get-clients",
    question: "How do I add people to my Pool?",
    answer:
      "Open [Pool](/coach/campaigns?tab=pool) and click Add people. Choose how. Your connections brings in owners you already know on LinkedIn. Sales Navigator uses a search we build from your Blueprint, or one you paste in. Google Maps and Google Search find businesses by trade and town. Upload CSV takes a spreadsheet, and Add one person is for someone you met.\n\nEveryone lands in the Pool. You can also put them on a list as they come in. If someone is already in your Pool, they stay as one person, however many times you add them.",
    aliases: ["import prospects", "import linkedin connections", "google maps import", "upload csv", "add leads", "build my list"],
    sources: ["SUP-508", "SUP-511", "ticket 19 Nov", "app"],
  },
  {
    id: "sales-nav-import",
    topic: "using-get-clients",
    question: "How do I import a Sales Navigator search?",
    answer:
      "1. Open [Pool](/coach/campaigns?tab=pool), click Add people, then Sales Navigator.\n2. Click Base search. It opens Sales Navigator with our filters set.\n3. Change the area or anything else you want, then copy the web address.\n4. Back here, paste it under Custom URL. A saved search link works too.\n5. Pick an Import size and click Import to pool.\n\nSales Navigator needs to be connected in [Settings](/coach/settings?tab=integrations) first.",
    aliases: ["sales navigator url", "import saved search", "custom url", "base search"],
    sources: ["ticket 19 Nov", "SUP-505", "SUP-563", "app"],
  },
  {
    id: "import-progress",
    topic: "using-get-clients",
    question: "My import says \"69 of 2,500\". Is it working?",
    answer:
      "Yes. A big import runs in parts, one company size at a time, and the line shows how far it has got with the part it is on. It then says which part comes next.\n\nYou can leave the page. The people show in the list once the import finishes. A list of a few thousand can take a while.\n\nIf the number has not moved for a day, send us a screenshot in Support.",
    aliases: ["import stuck", "is it importing", "how long does an import take", "not sure if it imported", "import pool"],
    sources: ["SUP-508", "ticket 19 Nov", "app"],
  },
  {
    id: "do-not-contact",
    topic: "using-get-clients",
    question: "Someone asked not to be contacted. How do I stop everything?",
    answer:
      "1. Open each campaign they are in, go to the Prospects tab, tick them and click Remove. Nothing more goes out to them.\n2. In [Pool](/coach/campaigns?tab=pool), tick them and click Blacklist, so no campaign takes them again.\n3. If they took your BOSS Score and get follow-up emails, send us their name and email in Support and we stop those too.",
    aliases: ["unsubscribe", "do not contact", "dnd", "opt out", "remove from campaign", "blacklist", "stop messaging someone"],
    sources: ["ticket 12 Jun", "app"],
  },
  {
    id: "export-prospects",
    topic: "using-get-clients",
    question: "Can I export my prospects?",
    answer:
      "Yes. On [Pool](/coach/campaigns?tab=pool) or [Prospects](/coach/prospects), click Export. Choose Shown columns for what you see on screen, or All columns for everything. If you have ticked some people, you can export just those.\n\nYou get a CSV file that opens in Excel or Google Sheets.",
    aliases: ["export to excel", "download prospects", "download my list", "csv export"],
    sources: ["ticket 21 May", "app"],
  },
  {
    id: "pool-vs-prospects",
    topic: "using-get-clients",
    question: "What's the difference between the Pool and Prospects?",
    answer:
      "The [Pool](/coach/campaigns?tab=pool) is everyone you might contact: imports, searches and spreadsheets. You sort it into lists and add people from it to campaigns.\n\n[Prospects](/coach/prospects) is the people you have added, or who took your BOSS Score. Open someone there to see their score, their messages and what happens next.",
    aliases: ["what is the pool", "pool or prospects", "where are my leads"],
    sources: ["ticket 20 Nov", "app"],
  },
  {
    id: "where-replies-go",
    topic: "using-get-clients",
    question: "Where do replies show up, and how do I answer?",
    answer:
      "Every reply lands in [Conversations](/coach/conversations), from LinkedIn, email and WhatsApp. Click a conversation, type in the box and send. Your reply goes out on the channel they used.\n\nClick Suggest a reply and Ava drafts one for you to change and send. Unread shows who is waiting on you.\n\nWhen someone replies, their campaign stops for them, so they do not get the next follow-up. If a message seems missing, click Sync now.",
    aliases: ["conversations", "inbox", "reply to a prospect", "where are my messages", "linkedin replies"],
    sources: ["ticket 17 Nov", "SUP-519", "app"],
  },
  {
    id: "scripts-page",
    topic: "using-get-clients",
    question: "What's on the Scripts page?",
    answer:
      "[Scripts](/coach/script) holds what to say at each stage with an owner, in order. Reach out has cold call, email and LinkedIn scripts. Then come New lead call, Booking objections, the BOSS Score Review, the Profit Roadmap call, and No-shows and reschedules.\n\nThe Profit Roadmap call opens a live call screen. Type notes as they talk, then press Personalise, and your pitch is rewritten around what they told you.",
    aliases: ["script", "what do I say on the call", "pitch", "personalised pitch", "roadmap call", "objections"],
    sources: ["app"],
  },
  {
    id: "call-simulator",
    topic: "using-get-clients",
    question: "Can I practise my sales calls?",
    answer:
      "Yes. Open [Scripts](/coach/script) and click Start practising on the Call simulator, or go straight to the [call simulator](/coach/script/simulator). You talk out loud with an AI owner, from a cold call to the close.\n\nPick the call, choose the objections you want to face or press Surprise me, and start. Afterwards you get a score and notes beside your lines, saved so you can look again.\n\nYou get a set number of practice minutes each month. They reset on the 1st.",
    aliases: ["practice", "role play", "sales simulator", "ai practice call"],
    sources: ["SUP-602", "app"],
  },
  {
    id: "scoreboard",
    topic: "using-get-clients",
    question: "What is the Scoreboard?",
    answer:
      "[Scoreboard](/coach/scoreboard) shows the numbers it takes to hit an income target, from the first message to new clients. It starts from example numbers, not yours, so treat it as a plan.\n\nPick the income targets a month you want to compare. Then drag any number, like how many people reply or how many calls turn into clients, and watch the income change. Good and Great fill in our targets. Your choices save on this device.",
    aliases: ["targets", "my numbers", "how many clients", "income target", "funnel numbers"],
    sources: ["app"],
  },
  {
    id: "christmas-campaign",
    topic: "using-get-clients",
    question: "How do I set up the Christmas campaign Pam described?",
    answer:
      "Start a new campaign, or click the three dots on an existing one and choose Duplicate, so you keep your steps. Name it Christmas, write the seasonal messages in the Steps tab, and add the people from your Pool.\n\nFor the links, use the fields under each message box. Booking link adds your booking page and Boss assessment link adds your BOSS Score, so every click comes back to you. Paste any other link in full.\n\nWe can build it with you. Ask in Support and we set up a call.",
    aliases: ["christmas campaign", "seasonal campaign", "festive message", "holiday campaign"],
    needs: "pam",
    sources: ["ticket 17 Nov"],
  },
  {
    id: "need-sales-navigator",
    topic: "using-get-clients",
    question: "Do I need Sales Navigator, and when should I get it?",
    answer:
      "You need it to bring LinkedIn people into your Pool: both Your connections and a Sales Navigator search use it. Your campaigns themselves only need your normal LinkedIn connected.\n\nYou can fill your Pool without it, using Google Maps, Google Search or a spreadsheet.\n\nConnect it in [Settings](/coach/settings?tab=integrations) once you have it.",
    aliases: ["should I get sales nav", "sales navigator subscription", "do I have to pay for sales navigator"],
    needs: "zander",
    sources: ["ticket 17 Nov", "app"],
  },

  // Calls and calendar (round 4)
  {
    id: "connect-zoom",
    topic: "calls-calendar",
    question: "How do I connect Zoom? The Connect button is greyed out.",
    answer:
      "Zoom does not connect yet for any coach. We are finishing the set-up, and the Connect button next to Zoom stays grey until then. We tell you in Support when it works.\n\nMeanwhile, put your own Zoom link on your booking calendar:\n\n1. Open [Calls settings](/coach/calls?tab=settings) and click the calendar name.\n2. Under How the call happens, choose Custom.\n3. Paste your personal Zoom meeting link and click Save calendar.\n\nEvery booking then carries that link. If your Google account is connected, Google Meet works too and makes a new link for each call. Choose Zoom only once it shows Connected in [Settings](/coach/settings?tab=integrations). Until then a Zoom calendar cannot take bookings.",
    aliases: ["zoom button greyed out", "connect zoom", "zoom integration", "add my zoom link", "zoom not working", "manually add call link"],
    sources: ["ticket 18 Nov", "app"],
  },
  {
    id: "community-calendar-check-url",
    topic: "calls-calendar",
    question: "Google Calendar says \"check the URL\" when I add the group calls. What do I do?",
    answer:
      "1. Open the [community calendar](/coach/community/calendar) and click Subscribe, then Copy feed link.\n2. In Google Calendar on a computer, open Settings, then Add calendar, then From URL.\n3. Paste the link and add it.\n\nGoogle can take a few hours to show the calls, then keeps them up to date when times change.\n\nIf that still fails, click Download .ics in the same box and open the file. That adds the calls as they are today, so do it again if times change.",
    aliases: ["google calendar sync", "check the url", "calls not in my calendar", "add group calls to my calendar", "calendar feed", "subscribe to calls"],
    sources: ["ticket 7 Sep", "app"],
  },
  {
    id: "calls-own-events",
    topic: "calls-calendar",
    question: "Why don't my own Google or Outlook events show in Calls?",
    answer:
      "Calls shows the calls people book with you, plus calls from your old CRM calendar. Your other events stay in your own calendar. They still block those times, so nobody can book over them.\n\nTo choose which calendars block your times, open [Calls settings](/coach/calls?tab=settings), use Calendars that block availability and click Save preferences. Calendar for new bookings sets where new calls land.\n\nIf a call someone booked is missing, send us their name in Support.",
    aliases: ["calendar shows no events", "my calendar is empty", "events not showing", "calendar not syncing"],
    sources: ["ticket 7 Sep", "app"],
  },
  {
    id: "rename-call-booking-page",
    topic: "calls-calendar",
    question: "How do I change my booking page, or rename the Constraint Call?",
    answer:
      "Open [Calls settings](/coach/calls?tab=settings) and click the calendar name. Constraint Call is the one your BOSS Score report books into. Change the name, the length, the notice you need and how the call happens, then click Save calendar.\n\nThe name shows on your booking page and in your BOSS Score emails, so one change covers both.\n\nTo share a booking page, click the share icon on that calendar's row. It copies the link.",
    aliases: ["constraint call", "rename my call", "change call name", "booking link", "where is my booking page", "call length"],
    sources: ["app"],
  },

  // Connections (round 4)
  {
    id: "email-connect-error",
    topic: "connections",
    question: "Outlook or Gmail won't connect, or shows an error. What do I do?",
    answer:
      "1. Open [Settings](/coach/settings?tab=integrations).\n2. Under Email and calendars, click Connect next to Google or Outlook.\n3. Sign in with the email you want people to see.\n\nThis connects your calendar too, so bookings check your busy times.\n\nA work Microsoft 365 account may say your organisation needs to approve the app. Send that screen to whoever runs your email. They approve it once, then you try again. If it still fails, send us a screenshot of the error in Support.",
    aliases: ["outlook integration not working", "outlook error", "gmail won't connect", "email integration error", "need admin approval"],
    sources: ["ticket 15 Oct", "SUP-562", "app"],
  },
  {
    id: "linkedin-connect-password",
    topic: "connections",
    question: "LinkedIn won't connect. It says my password is wrong.",
    answer:
      "Use your LinkedIn password, not your Google or Outlook one. If you sign in to LinkedIn with Google, set a LinkedIn password first in [LinkedIn Sign in and security](https://www.linkedin.com/mypreferences/d/change-password), keeping the same email. If you never had one, use Forgot password on LinkedIn's sign-in page.\n\nLinkedIn may also send a check to the LinkedIn app or your email. Approve it, then click Connect again in [Settings](/coach/settings?tab=integrations).",
    aliases: ["linkedin didn't connect", "linkedin password", "sign in with google linkedin", "disconnected from linkedin"],
    sources: ["ticket 9 Nov", "ticket 8 Oct", "app"],
  },

  // BOSS Score (round 4)
  {
    id: "boss-score-emails",
    topic: "boss-score",
    question: "Who sends the BOSS Score emails to people who take it?",
    answer:
      "You choose. Open [Lead Magnets](/coach/campaigns?tab=magnets), open a lead magnet and click Settings. Under Who emails people after they take one, pick This app or My old CRM. The choice covers every lead magnet.\n\nWith This app and your email connected, the report goes straight away from your own email, then 10 follow-ups over about three weeks. People who stop part way get three reminders. Each email offers your Constraint Call, and the emails stop when the person books or replies. You can read and edit them in the lead magnet's Sequences tab.\n\nWith no email connected, only the report goes, from our support address as \"Your Name via Profit Coach\". [Connect your email](/coach/settings?tab=integrations) to send the rest. With My old CRM, this app sends nothing, so your old CRM must send them.",
    aliases: ["boss score emails", "scorecard follow up emails", "who emails the report", "report email", "emails from support address", "old crm or this app"],
    sources: ["ticket 10 Aug", "ticket 4 Jun", "app"],
  },
  {
    id: "blank-scorecard-print",
    topic: "boss-score",
    question: "Where's a blank BOSS Scorecard I can print?",
    answer:
      "Open [Toolkit, then Print](/coach/toolkit?view=print) under Get Clients. BOSS Scorecard - A4 carries your name, photo and a QR code that opens your scorecard online. Click PDF to print it, PNG for a picture, or SVG for a printer or designer.\n\nThe QR code needs your public link. If the page asks for one, set it in [Links](/coach/share) first.",
    aliases: ["blank score card", "printable scorecard", "paper scorecard", "scorecard pdf", "print the scorecard"],
    sources: ["ticket 16 Nov", "app"],
  },
  {
    id: "what-are-lead-magnets",
    topic: "boss-score",
    question: "What are lead magnets, and where do I manage them?",
    answer:
      "A lead magnet is something free a business owner gets for their name and email. Yours are the BOSS Score and BOSS Pro. Find them under Get Clients, in [Campaigns, then Lead Magnets](/coach/campaigns?tab=magnets).\n\nOpen one to manage it. Overview shows how many people opted in, started and finished. People lists each of them by name. Sequences holds the emails they get afterwards. Share gives you the links, a QR code and the code for your website.\n\nSettings on the same page sets who sends the emails: this app or your old CRM.",
    aliases: ["about lead magnets", "lead magnet", "where are my lead magnets", "funnel settings"],
    sources: ["ticket 20 Nov", "app"],
  },
  {
    id: "lead-magnet-analytics",
    topic: "boss-score",
    question: "How do I see who visited or opted in on my BOSS Score page?",
    answer:
      "Open [Lead Magnets](/coach/campaigns?tab=magnets) and open Boss Score Assessment. Overview shows how many people opted in out of everyone who viewed the page, and how many finished out of those who started. Use the date menu to pick from the last 7 days to all time.\n\nClick a stage, or View all, to open People. It lists everyone by name with how far they got, and you can search by name or email.\n\nSomeone who looks at the page and leaves without giving their details only counts as a view, so we have no name for them.",
    aliases: ["landing page analytics", "funnel analytics", "who opened my landing page", "drill through", "page visits", "how many people took my scorecard"],
    sources: ["ticket 12 Jun", "ticket 8 Jun", "app"],
  },
  {
    id: "embed-scorecard",
    topic: "boss-score",
    question: "Can I put the BOSS Score on my own website?",
    answer:
      "1. Open [Lead Magnets](/coach/campaigns?tab=magnets), open Boss Score Assessment and click Share.\n2. Under Embed on your website, pick Full funnel embed, which starts with the opt-in page, or Scorecard-only embed, which goes straight to the questions.\n3. Click Copy code.\n4. Paste the code where your website accepts HTML, such as an embed or code block.\n\nIt sizes itself to fit. Anyone who finishes it lands in your [Prospects](/coach/prospects), the same as from your link.\n\nThe code needs your public link. If Share asks for one, add it there first.",
    aliases: ["embed", "iframe", "scorecard on my website", "opt in box on my site", "embed landing page"],
    sources: ["ticket 28 May", "app"],
  },
  {
    id: "personalised-scorecard-link",
    topic: "boss-score",
    question: "How do I send a prospect a scorecard link with their details filled in?",
    answer:
      "1. Open [Lead Magnets](/coach/campaigns?tab=magnets), open Boss Score Assessment and click Share.\n2. Next to Scorecard only, click Personalise.\n3. Pick the prospect, or add someone new, and click Generate link.\n\nThe link skips the landing page and fills in their details, so they go straight to the questions. For BOSS Pro, open Boss Score Pro, click Share and use Personalise next to Assessment.",
    aliases: ["personalised link", "pre-filled scorecard", "send scorecard to one person", "enter details twice"],
    sources: ["ticket 4 Jun", "app"],
  },
  {
    id: "landing-page-security-warning",
    topic: "boss-score",
    question: "My landing page on my own website shows a security warning. Why?",
    answer:
      "The warning means that web address has no working security certificate. This app does not host pages on your own domain. Your BOSS Score links use theprofitcoach.com, which is secure, so a page on your own domain comes from the old CRM or your web host.\n\nUntil it is fixed, share your BOSS Score link from [Lead Magnets](/coach/campaigns?tab=magnets) instead. Send us the address in Support and we tell you who needs to fix it.",
    aliases: ["your connection is not private", "vsl page security warning", "landing page not secure", "ssl warning", "custom domain"],
    needs: "zander",
    sources: ["ticket 19 Nov"],
  },

  // The app and Ava
  {
    id: "talk-to-ava",
    topic: "app-and-ava",
    question: "How do I talk to Ava, and how do I keep a chat going?",
    answer:
      "Click Ava's glowing circle at the top right of any page, or [Ava](/coach/ava) at the top of the left sidebar. On your phone she sits in the middle of the bottom bar. Type in the box and press Enter, or tap the microphone to talk instead of typing.\n\nThe chat stays with you as you move between pages. To go back to an older chat, click History (the clock) and pick it. Use New chat to start fresh. The three dots on a chat let you rename it, pin it or delete it.\n\nYou need no special word to keep going. Just answer her question in the box. If nothing comes back after a minute, send it again. If she still stays quiet, tell us in Support.",
    aliases: ["open ava", "ava didn't reply", "ava stopped answering", "word to continue", "talk to ava", "ava chat history", "voice"],
    sources: ["ticket 22 Oct (Ava and My Profile)", "app"],
  },
  {
    id: "what-ava-does",
    topic: "app-and-ava",
    question: "What can Ava do for me?",
    answer:
      "Ava works from your Blueprint. She fills in and sharpens your Blueprint with you, finds prospects, builds lists, sets up campaigns and writes your messages. She also answers how-to questions about the app and gives you the link to the right page.\n\nAnything that sends, spends money or removes people waits for your OK. She shows a card with a Confirm button. Blueprint wording shows as a draft first, with Save to Blueprint and Change it. Nothing changes until you press Save.\n\nIf your plan doesn't include Get Clients, Ava still helps with your Blueprint and questions. She tells you when something needs Get Clients. Tap the thumbs down on any reply that's wrong. We read every one.",
    aliases: ["what can ava do", "ava help", "is ava a person", "ai assistant", "ava can't do campaigns"],
    sources: ["app", "content/agent/AGENT.md"],
  },
  {
    id: "support-icon",
    topic: "app-and-ava",
    question: "How do I message BCA about the page I'm on?",
    answer:
      "Click the question mark circle in the top bar, just left of Ava. A chat opens on the right about the page you're on, so we can see what you see. Write your question, add a photo, video or voice note if it helps, and send.\n\nA red dot on the icon means we replied. We also email you. All your chats are in [Support](/coach/support), and short answers to common questions are under [Help](/coach/support?tab=help).\n\nOn your phone the icon opens the Support page instead.",
    aliases: ["question mark icon", "contact bca", "message zander", "message pam", "support chat", "report a bug", "send a screenshot"],
    sources: ["app"],
  },
  {
    id: "book-call-bca",
    topic: "app-and-ava",
    question: "How do I book a call with Zander or Pam?",
    answer:
      "Ask in [Support](/coach/support) and say what you want to talk about. We send you a link to book a 20-minute call at a time that suits you.\n\nMany questions are quicker in Support, so try there first. If it needs a proper talk, we book the call.",
    aliases: ["book time with zander", "call with pam", "can we have a call", "one to one", "1:1 call", "support call"],
    needs: "zander",
    sources: ["ticket 17 Nov (Book Wednesday or Friday call)", "ticket 3 Sep (Call with Zander request)"],
  },
  {
    id: "notification-bell",
    topic: "app-and-ava",
    question: "What does the bell show?",
    answer:
      "The bell at the top right has two tabs. Community shows new posts, replies, mentions and announcements. Use the menu on the right to see just one kind. Prospects shows when someone starts or finishes your BOSS Score or BOSS Pro. Click a line to open it.\n\nUse Mark community as read or Mark prospects as read to clear a tab. What you've read stays read on every device.\n\nYou also get an email when a prospect finishes your BOSS Score.",
    aliases: ["notifications", "notification bell", "all marked unread", "red number", "alerts"],
    sources: ["ticket 9 Sep (Notifications Bell)", "ticket 2 Jun (Community posts all marked as unread)", "app"],
  },
  {
    id: "reply-alerts",
    topic: "app-and-ava",
    question: "Can the app tell me when a prospect replies on LinkedIn?",
    answer:
      "Yes. Open [Settings](/coach/settings) and find Ava reply alerts on the right. Choose Copilot. Ava tells you the moment someone replies, with a draft reply ready, and you send it.\n\nUnder Where Ava tells you, tick This phone or computer and click Turn on here. On an iPhone, add the app to your home screen first, then turn it on from there.",
    aliases: ["reply notifications", "linkedin reply alert", "push notifications", "copilot", "tell me when someone replies"],
    needs: "zander",
    sources: ["ticket 9 Sep", "app"],
  },
  {
    id: "app-on-phone",
    topic: "app-and-ava",
    question: "How do I put the app on my phone?",
    answer:
      "On your computer, click your name at the bottom of the left sidebar and choose Get the app, then scan the code with your phone's camera. Or open [theprofitcoach.com/install](https://theprofitcoach.com/install) on your phone.\n\nOn iPhone, in Safari:\n\n1. Tap the three dots at the bottom right.\n2. Tap Share, then View More, then Add to Home Screen.\n3. Leave Open as Web App on and tap Add.\n\nOn Android, in Chrome:\n\n1. Tap the three dots at the top right.\n2. Tap Add to Home screen, then Install.\n\nOpen it from your home screen and sign in once. It keeps you signed in.",
    aliases: ["home screen", "install the app", "mobile app", "iphone app", "android app", "get the app"],
    sources: ["app"],
  },
  {
    id: "search-the-app",
    topic: "app-and-ava",
    question: "How do I find something in the app?",
    answer:
      "Click the magnifying glass in the top bar, or press Ctrl K (⌘ K on a Mac). Type a name or a few words. It searches your prospects, lessons, videos, community posts, people and these Help answers.\n\nIf you'd rather ask, type it to Ava. She knows where everything is and gives you the link.",
    aliases: ["search", "where is", "can't find", "find a lesson", "find a prospect"],
    sources: ["app"],
  },
  {
    id: "community-post",
    topic: "app-and-ava",
    question: "How do I post in the community?",
    answer:
      "Open [Community](/coach/community) and click Write something… at the top. Add a title and your message. You can add photos, videos or a link.\n\nChoose where it goes under Where to post: General Discussion, Wins, Intros, or Ask & Share for questions. Then click Post. Only BCA posts Announcements.\n\nFor a question about a lesson, ask from the lesson page. You can make it Private so only you and the team see it.",
    aliases: ["write a post", "share a win", "ask the community", "introduce myself", "ask and share"],
    sources: ["app"],
  },
  {
    id: "community-map",
    topic: "app-and-ava",
    question: "How do I add myself to the members map?",
    answer:
      "1. Open [Members](/coach/community/members?view=map) and switch to Map.\n2. In the Your location box at the top right, type your town and country and click save.\n3. Click Place pin on map to put your pin in the right spot.\n\nTo move it later, click Update map pin.",
    aliases: ["community map", "member map", "add my location", "map api key", "pin on map"],
    sources: ["ticket 5 Oct (API Key needed on Community Map)", "app"],
  },
  {
    id: "coach-website-changes",
    topic: "app-and-ava",
    question: "Can I change my coach website?",
    answer:
      "Yes. We build your website from your Blueprint, so most changes start there. If a fact on your site is wrong, change it in your [Blueprint](/coach/blueprint) and tell us in Support.\n\nFor anything else, like a photo, a line of wording or a page you want added, send us the change in Support. A screenshot helps. We make it and tell you when it's live.",
    aliases: ["edit my website", "update my site", "website wrong", "change my about page"],
    needs: "zander",
    sources: ["ticket 30 Oct (Re: Website)", "ticket 30 Oct (Website)"],
  },

  // Training and certification
  {
    id: "classroom-vault-programs",
    topic: "training",
    question: "What's the difference between the Classroom, the Vault and Programs?",
    answer:
      "The [Classroom](/coach/academy/classroom) is the programme, step by step. It has six parts: Start Here, Coach Action Plan, Going Pro, Get Calls, Win Clients and Keep Clients. Start at the top and work along.\n\nThe Vault sits at the bottom of the Classroom. Click Show to open it. It holds extra courses: StryvX, Books & Talks and How To. Watch them when you have time. Getting and keeping clients comes first.\n\nPrograms was the old name for these courses. It all lives in the Classroom now. Templates, sheets and guides are on the [Resources](/coach/academy/resources) tab.",
    aliases: ["programs", "programmes", "where is the vault", "how to course", "books and talks", "stryvx", "training library"],
    sources: ["app"],
  },
  {
    id: "lesson-wont-open",
    topic: "training",
    question: "I can't open a training lesson. What do I do?",
    answer:
      "If the lesson shows a lock and Unlock with membership, that course isn't part of your current plan. Click it to see the plans, or open [Billing](/coach/settings?tab=billing) to restart yours.\n\nIf your link goes to academy.businesscoachacademy.com or another old site, that's the old platform. Open the [Classroom](/coach/academy/classroom) here instead.\n\nIf neither fits, tell us in Support which lesson it is, and we open it for you.",
    aliases: ["can't access training", "lesson locked", "training won't load", "unlock with membership", "academy won't let me in"],
    sources: ["ticket 10 Nov (Can't access training lessons)", "app"],
  },
  {
    id: "where-simulator",
    topic: "training",
    question: "Where are the client simulator and the call simulator?",
    answer:
      "There are two. The [Client simulator](/coach/simulator) is under Keep Clients. You practise coaching conversations out loud with AI clients, then get a score and a report.\n\nThe [Call simulator](/coach/script/simulator) is for sales calls. Open Get Clients, then Scripts, and click Start practising under the scripts. You talk to AI owners, from a cold call to the close. It comes with Get Clients.\n\nOld links on theprofitcoach.com or academy.businesscoachacademy.com no longer work. Use these instead.",
    aliases: ["client simulator", "call simulator", "practice calls", "ai coaching practice", "role play", "simulator link broken"],
    sources: ["ticket 14 Jul (I cannot find a link to the client simulators)", "ticket 5 Nov (Scorecard not filling in)", "app"],
  },

  // Money (round 4)
  {
    id: "membership-cost",
    topic: "money",
    question: "What does membership cost after my payment plan ends?",
    answer:
      "Once your programme is paid off, membership keeps your tools, training and community switched on. There are three levels: Core at £195 a month, Premium at £495 a month and VIP at £1,995 a month. Core and Premium can also be paid yearly, at ten times the monthly price.\n\nYou can see what each level includes on the [Membership page](/coach/membership#plans). Your current plan and the buttons to change it are in [Billing](/coach/settings?tab=billing).\n\nNot sure which fits? Ask in Support and we help you choose.",
    aliases: ["cost model", "how much is membership", "monthly fee", "after six months", "premium plan price", "core plan", "vip"],
    needs: "zander",
    sources: ["ticket 24 Sep (Inquiry: cost model)", "ticket 4 Nov (Monthly payments)", "ticket 20 Oct (Billing clarification)", "src/config/membershipPlans.ts"],
  },
  {
    id: "referral-fees",
    topic: "money",
    question: "How do referral fees work?",
    answer:
      "If you refer a coach who joins BCA, you earn a referral fee. Tell us in Support when they join. We confirm the amount and when it's paid. Many coaches take it off their own monthly fee instead of a payment.\n\nIf you send us a business owner who joins BOSS with BCA rather than coaching with you, you earn a referral fee too. Tell us their name in Support so it's logged against you.",
    aliases: ["referral fee", "refer a coach", "commission", "offset against my fee", "referral payment"],
    needs: "zander",
    sources: ["ticket 12 Oct (Fwd: Debit initiated by Stripe)", "ticket 9 Nov (Scorecard referral)"],
  },

  // Where things moved (round 4)
  {
    id: "connectai",
    topic: "where-things-moved",
    question: "Where did ConnectAI go?",
    answer:
      "ConnectAI was the old LinkedIn tool. Your LinkedIn campaigns now run here, under Get Clients, then [Campaigns](/coach/campaigns). You need no ConnectAI login.\n\nConnect your LinkedIn once in [Settings](/coach/settings?tab=integrations). Your old campaigns are under Archived at the bottom of Campaigns, so you can copy what worked.",
    aliases: ["connect ai", "connectai not working", "connectai disconnected", "old linkedin tool", "india team"],
    needs: "zander",
    sources: ["ticket 8 Oct (ConnectAI not working)", "ticket 21 May (Is there an issue with Connect AI?)"],
  },
];

/** Full URL for an answer's video. */
export function helpVideoUrl(src: string): string {
  if (/^https?:\/\//.test(src)) return src;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/academy-lessons/${src.replace(/^\//, "")}`;
}

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
