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
  | "academy"
  | "blueprint"
  | "get-clients"
  | "keep-clients"
  | "account-money";

export type HelpTopic = {
  id: HelpTopicId;
  name: string;
  /** One line under the name on the topic card. */
  blurb: string;
  /** Smaller groups inside a big topic, in the order they show. */
  groups?: Array<{ id: string; name: string }>;
};

export type HelpAnswer = {
  /** Stable id, used in links (#id) and search results. */
  id: string;
  topic: HelpTopicId;
  /** One of the topic's groups, when it has them. */
  group?: string;
  /** Something broken rather than a how-to: listed under "Something not working?" too. */
  fix?: boolean;
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

// Named after the app's own sidebar, so coaches look where they already work.
export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "getting-started",
    name: "Getting started",
    blurb: "Your first weeks, connecting your accounts, Ava and the app.",
    groups: [
      { id: "first-weeks", name: "Your first weeks" },
      { id: "accounts", name: "Connect your accounts" },
      { id: "app", name: "Ava, Support and the app" },
    ],
  },
  {
    id: "academy",
    name: "Academy",
    blurb: "The Classroom, getting certified, group calls and the community.",
    groups: [
      { id: "training", name: "Classroom and training" },
      { id: "community", name: "Group calls and community" },
    ],
  },
  { id: "blueprint", name: "My Blueprint", blurb: "About You, your LinkedIn profile and your newsletter." },
  {
    id: "get-clients",
    name: "Get Calls and Win Clients",
    blurb: "Lead lists, campaigns, the BOSS Score, calls and your pipeline.",
    groups: [
      { id: "prospects", name: "Lead lists and pipeline" },
      { id: "campaigns", name: "Campaigns and replies" },
      { id: "boss-score", name: "BOSS Score" },
      { id: "calls", name: "Calls and scripts" },
    ],
  },
  {
    id: "keep-clients",
    name: "Keep Clients",
    blurb: "The Profit System, your clients, BOSS Pro, playbooks and coaching sessions.",
    groups: [
      { id: "profit-system", name: "The Profit System" },
      { id: "clients", name: "Your clients" },
      { id: "boss-pro", name: "BOSS Pro and playbooks" },
      { id: "coaching", name: "Coaching sessions and practice" },
    ],
  },
  { id: "account-money", name: "Account and money", blurb: "Logins, membership, invoices and referrals." },
];

export const HELP_ANSWERS: HelpAnswer[] = [
  // getting-started / first-weeks
  {
    id: "first-weeks",
    topic: "getting-started",
    group: "first-weeks",
    question: "What happens in my first few weeks?",
    answer:
      "You fill in the three About You pages in your Blueprint. That takes about an hour and it is the only writing we ask of you.\n\nWe then write your LinkedIn profile, build your prospect list and write your first campaign. You read them and tell us what to change. Once you are happy we turn the campaign on and messages start going out, usually on a Monday.\n\nYour [Blueprint](/coach/blueprint) shows each step, whose turn it is and what is done.",
    aliases: ["outline of the next few weeks", "what do I do next", "next steps", "where is the plan"],
    sources: ["Bruce, WhatsApp 6 Nov", "SUP-531", "SUP-574", "SUP-591"],
  },
  {
    id: "what-bca-does",
    topic: "getting-started",
    group: "first-weeks",
    question: "What does BCA build for me, and what do I do myself?",
    answer:
      "You do the About You pages and you check what we write. We do the rest: your LinkedIn profile text, your prospect lists, your campaign messages, your newsletter, your booking page and your BOSS Score links.\n\nWhen something is ready for you to check, it shows on your [Blueprint](/coach/blueprint) and we message you in Support.",
    aliases: ["done for you", "what do you do for me"],
    sources: ["SUP-550", "SUP-565"],
  },
  {
    id: "been-away",
    topic: "getting-started",
    group: "first-weeks",
    question: "I've been away for a while. What's changed?",
    answer:
      "Everything now lives in one place: [theprofitcoach.com/login](https://theprofitcoach.com/login). Training, campaigns, prospects, conversations, calendar, community and support are all here, and the old training site and old CRM are no longer needed.\n\nThe quickest way back in is a short call. Message Support and we book one and walk you through it.",
    aliases: ["catch up", "what have I missed", "platform moved"],
    sources: ["SUP-503", "SUP-510", "SUP-559"],
  },
  {
    id: "old-crm",
    topic: "getting-started",
    group: "first-weeks",
    question: "Do I still need the old CRM?",
    answer:
      "No. Calendar, bookings, conversations, prospects and campaigns all run here now, and we set them up for you. The old CRM at app.procoachplatform.com still runs for coaches who have not moved yet, and you do not have to move until you are ready.\n\nOur advice is to use everything here. One login, one inbox, and we can help with all of it.",
    aliases: ["pro coach crm", "procoachplatform", "old system"],
    sources: ["SUP-503", "SUP-558", "SUP-510"],
  },
  {
    id: "platform-no-longer-active",
    topic: "getting-started",
    group: "first-weeks",
    fix: true,
    question: "I see \"this platform is no longer active\". Where do I go?",
    answer:
      "You opened the old training site. Everything moved here in May 2026. Log in at [theprofitcoach.com/login](https://theprofitcoach.com/login).\n\nIf your password does not work, click Reset password on that page.",
    aliases: ["academy hub", "bca academy hub", "disco", "old training platform", "academy.businesscoachacademy.com", "portal has moved", "coach directory"],
    sources: ["SUP-495", "SUP-503", "SUP-559", "ticket 8 Sep (Platforms)", "ticket 13 Oct (Log in failure to portal)"],
  },
  // getting-started / accounts
  {
    id: "connect-linkedin",
    topic: "getting-started",
    group: "accounts",
    question: "How do I connect my LinkedIn so campaigns can send?",
    answer:
      "1. Open [Settings](/coach/settings?tab=integrations).\n2. Find LinkedIn and click Connect.\n3. Sign in with your LinkedIn email and LinkedIn password.\n4. LinkedIn may ask for a code from your email or phone, or a check in the LinkedIn app. Enter it or approve it.\n5. Wait until LinkedIn shows Connected.\n\nIt takes about a minute. Sales Navigator connects on the same page. If it says your password is wrong, see [LinkedIn won't connect](/coach/support?tab=help&a=linkedin-connect-password).",
    aliases: ["linkedin integration", "connect linkedin account"],
    sources: ["SUP-600", "SUP-519"],
  },
  {
    id: "linkedin-connect-password",
    topic: "getting-started",
    group: "accounts",
    fix: true,
    question: "LinkedIn won't connect. It says my password is wrong.",
    answer:
      "Use your LinkedIn password, not your Google or Outlook one. If you sign in to LinkedIn with Google, set a LinkedIn password first in [LinkedIn Sign in and security](https://www.linkedin.com/mypreferences/d/change-password), keeping the same email. If you never had one, use Forgot password on LinkedIn's sign-in page.\n\nLinkedIn may also send a check to the LinkedIn app or your email. Approve it, then click Connect again in [Settings](/coach/settings?tab=integrations).",
    aliases: ["linkedin didn't connect", "linkedin password", "sign in with google linkedin", "disconnected from linkedin"],
    sources: ["ticket 9 Nov", "ticket 8 Oct", "app"],
  },
  {
    id: "send-from-own-email",
    topic: "getting-started",
    group: "accounts",
    question: "Can I send emails from my own address?",
    answer:
      "Yes, if your email is Gmail or Outlook. Open [Settings](/coach/settings?tab=integrations) and connect it. Emails then send from your address, replies show in [Conversations](/coach/conversations), and your BOSS Score report and follow-ups go from you too.\n\nIf you use a work Microsoft 365 account, Microsoft may say your organisation needs to approve the app. Your IT contact can approve it in a minute.",
    aliases: ["gmail", "outlook", "email integration", "send from my domain"],
    sources: ["SUP-493", "SUP-562"],
  },
  {
    id: "email-connect-error",
    topic: "getting-started",
    group: "accounts",
    fix: true,
    question: "Outlook or Gmail won't connect, or shows an error. What do I do?",
    answer:
      "1. Open [Settings](/coach/settings?tab=integrations).\n2. Under Email and calendars, click Connect next to Google or Outlook.\n3. Sign in with the email you want people to see.\n\nThis connects your calendar too, so bookings check your busy times.\n\nA work Microsoft 365 account may say your organisation needs to approve the app. Send that screen to whoever runs your email. They approve it once, then you try again. If it still fails, send us a screenshot of the error in Support.",
    aliases: ["outlook integration not working", "outlook error", "gmail won't connect", "email integration error", "need admin approval"],
    sources: ["ticket 15 Oct", "SUP-562", "app"],
  },
  // getting-started / app
  {
    id: "talk-to-ava",
    topic: "getting-started",
    group: "app",
    question: "How do I talk to Ava, and how do I keep a chat going?",
    answer:
      "Click Ava's glowing circle at the top right of any page, or [Ava](/coach/ava) at the top of the left sidebar. On your phone she sits in the middle of the bottom bar. Type in the box and press Enter, or tap the microphone to talk instead of typing.\n\nThe chat stays with you as you move between pages. To go back to an older chat, click History (the clock) and pick it. Use New chat to start fresh. The three dots on a chat let you rename it, pin it or delete it.\n\nYou need no special word to keep going. Just answer her question in the box. If nothing comes back after a minute, send it again. If she still stays quiet, tell us in Support.",
    aliases: ["open ava", "ava didn't reply", "ava stopped answering", "word to continue", "talk to ava", "ava chat history", "voice"],
    sources: ["ticket 22 Oct (Ava and My Profile)", "app"],
  },
  {
    id: "what-ava-does",
    topic: "getting-started",
    group: "app",
    question: "What can Ava do for me?",
    answer:
      "Ava works from your Blueprint. She fills in and sharpens your Blueprint with you, finds prospects, builds lists, sets up campaigns and writes your messages. She also answers how-to questions about the app and gives you the link to the right page.\n\nAnything that sends, spends money or removes people waits for your OK. She shows a card with a Confirm button. Blueprint wording shows as a draft first, with Save to Blueprint and Change it. Nothing changes until you press Save.\n\nIf your plan doesn't include Get Calls and Win Clients, Ava still helps with your Blueprint and questions. She tells you when something needs them. Tap the thumbs down on any reply that's wrong. We read every one.",
    aliases: ["what can ava do", "ava help", "is ava a person", "ai assistant", "ava can't do campaigns"],
    sources: ["app", "content/agent/AGENT.md"],
  },
  {
    id: "reply-alerts",
    topic: "getting-started",
    group: "app",
    question: "Can the app tell me when a prospect replies on LinkedIn?",
    answer:
      "Yes. Ava reads every LinkedIn reply as it lands and tells you.\n\n1. Open [Settings](/coach/settings) and stay on the Profile tab.\n2. On the right, find the box called Ava reply alerts.\n3. Choose Copilot.\n\nThere are three choices. Off means Ava stays quiet and you check replies yourself. Copilot means Ava tells you the moment someone replies, with a draft reply ready, and you read it and send it. This is the one we recommend. Autopilot means Ava answers for you when someone asks to talk, offering two times from your calendar. It says Coming soon while we switch it on coach by coach.\n\nOnce you pick Copilot, Where Ava tells you appears. Tick as many as you like:\n\n1. This phone or computer: click Turn on here, then allow alerts when your browser asks. Click Send test to check it works. Do this on each device you use.\n2. WhatsApp from BCA: type your mobile number and click Save. These come from BCA's number and pause from 9pm to 7am.\n3. Email to yourself: an email for each reply.\n\nEach alert opens the conversation with Ava's draft ready.\n\nOn an iPhone, alerts only work from the app on your home screen. [Put the app on your phone](/coach/support?tab=help&a=app-on-phone) first, open it from there, then tap Turn on here. If it says alerts are blocked, allow notifications for Profit Coach in your phone's settings and try again.",
    aliases: ["reply notifications", "linkedin reply alert", "push notifications", "copilot", "autopilot", "tell me when someone replies", "whatsapp alerts"],
    sources: ["ticket 9 Sep", "app"],
  },
  {
    id: "app-on-phone",
    topic: "getting-started",
    group: "app",
    question: "How do I put the app on my phone?",
    answer:
      "On your computer, click your name at the bottom of the left sidebar and choose Get the app, then scan the code with your phone's camera. Or open [theprofitcoach.com/install](https://theprofitcoach.com/install) on your phone.\n\nOn iPhone, in Safari:\n\n1. Tap the three dots at the bottom right.\n2. Tap Share, then View More, then Add to Home Screen.\n3. Leave Open as Web App on and tap Add.\n\nOn Android, in Chrome:\n\n1. Tap the three dots at the top right.\n2. Tap Add to Home screen, then Install.\n\nOpen it from your home screen and sign in once. It keeps you signed in.",
    aliases: ["home screen", "install the app", "mobile app", "iphone app", "android app", "get the app"],
    sources: ["app"],
  },
  {
    id: "search-the-app",
    topic: "getting-started",
    group: "app",
    question: "How do I find something in the app?",
    answer:
      "Click the magnifying glass in the top bar, or press Ctrl K (⌘ K on a Mac). Type a name or a few words. It searches your prospects, lessons, videos, community posts, people and these Help answers.\n\nIf you'd rather ask, type it to Ava. She knows where everything is and gives you the link.",
    aliases: ["search", "where is", "can't find", "find a lesson", "find a prospect"],
    sources: ["app"],
  },
  {
    id: "notification-bell",
    topic: "getting-started",
    group: "app",
    question: "What does the bell show?",
    answer:
      "The bell at the top right has two tabs. Community shows new posts, replies, mentions and announcements. Use the menu on the right to see just one kind. Prospects shows when someone starts or finishes your BOSS Score or BOSS Pro. Click a line to open it.\n\nUse Mark community as read or Mark prospects as read to clear a tab. What you've read stays read on every device.\n\nYou also get an email when a prospect finishes your BOSS Score.",
    aliases: ["notifications", "notification bell", "all marked unread", "red number", "alerts"],
    sources: ["ticket 9 Sep (Notifications Bell)", "ticket 2 Jun (Community posts all marked as unread)", "app"],
  },
  {
    id: "support-icon",
    topic: "getting-started",
    group: "app",
    question: "How do I message BCA about the page I'm on?",
    answer:
      "Click the question mark circle in the top bar, just left of Ava. A chat opens on the right about the page you're on, so we can see what you see. Write your question, add a photo, video or voice note if it helps, and send.\n\nA red dot on the icon means we replied. We also email you. All your chats are in [Support](/coach/support), and short answers to common questions are under [Help](/coach/support?tab=help).\n\nOn your phone the icon opens the Support page instead.",
    aliases: ["question mark icon", "contact bca", "message zander", "message pam", "support chat", "report a bug", "send a screenshot"],
    sources: ["app"],
  },
  {
    id: "support-reply-time",
    topic: "getting-started",
    group: "app",
    question: "What's the best way to reach BCA, and how fast do you reply?",
    answer:
      "Support, right here, is the best way. Pam and Zander both see it, and your question is never lost in a phone. We reply within one working day, often the same day.\n\nWhatsApp works for a quick hello, but Pam is on calls most of the day, so put anything you need an answer to in Support.",
    aliases: ["how do I contact", "whatsapp pam", "no reply"],
    sources: ["SUP-574"],
  },
  {
    id: "book-call-bca",
    topic: "getting-started",
    group: "app",
    question: "How do I book a call with Zander or Pam?",
    answer:
      "Ask in [Support](/coach/support) and say what you want to talk about. We send you a link to book a 20-minute call at a time that suits you.\n\nMany questions are quicker in Support, so try there first. If it needs a proper talk, we book the call.",
    aliases: ["book time with zander", "call with pam", "can we have a call", "one to one", "1:1 call", "support call"],
    sources: ["ticket 17 Nov (Book Wednesday or Friday call)", "ticket 3 Sep (Call with Zander request)"],
  },
  // academy / training
  {
    id: "classroom-vault-programs",
    topic: "academy",
    group: "training",
    question: "What's the difference between the Classroom, the Vault and Programs?",
    answer:
      "The [Classroom](/coach/academy/classroom) is the programme, step by step. It has six parts: Start Here, Coach Action Plan, Going Pro, Get Calls, Win Clients and Keep Clients. Start at the top and work along.\n\nThe Vault sits at the bottom of the Classroom. Click Show to open it. It holds extra courses: StryvX, Books & Talks and How To. Watch them when you have time. Getting and keeping clients comes first.\n\nPrograms was the old name for these courses. It all lives in the Classroom now. Templates, sheets and guides are on the [Resources](/coach/academy/resources) tab.",
    aliases: ["programs", "programmes", "where is the vault", "how to course", "books and talks", "stryvx", "training library"],
    sources: ["app"],
  },
  {
    id: "lesson-wont-open",
    topic: "academy",
    group: "training",
    fix: true,
    question: "I can't open a training lesson. What do I do?",
    answer:
      "If the lesson shows a lock and Unlock with membership, that course isn't part of your current plan. Click it to see the plans, or open [Billing](/coach/settings?tab=billing) to restart yours.\n\nIf your link goes to academy.businesscoachacademy.com or another old site, that's the old platform. Open the [Classroom](/coach/academy/classroom) here instead.\n\nIf neither fits, tell us in Support which lesson it is, and we open it for you.",
    aliases: ["can't access training", "lesson locked", "training won't load", "unlock with membership", "academy won't let me in"],
    sources: ["ticket 10 Nov (Can't access training lessons)", "app"],
  },
  {
    id: "old-links-in-lessons",
    topic: "academy",
    group: "training",
    fix: true,
    question: "A link in a lesson asks me to log in somewhere else. Is it broken?",
    answer:
      "Yes, that link is out of date. Some lessons still point at the old site. Tell us which lesson in Support and we fix it and send you the new place.\n\nThe tools themselves are in [Toolkit](/coach/toolkit) under Get Calls.",
    aliases: ["disco login", "broken link in lesson", "roi calculator", "pairwise tool"],
    sources: ["SUP-466", "community 15 Jun", "playbook"],
  },
  {
    id: "video-out-of-date",
    topic: "academy",
    group: "training",
    fix: true,
    question: "The video shows settings I don't have. Am I missing something?",
    answer:
      "No. Some videos were made before the app changed and show screens that have moved. BOSS Score links are now under Campaigns, Lead magnets. Calendar and inbox are now in this app, not the old CRM.\n\nIf a video and the app disagree, trust the app and ask in Support. We point you to the right place and fix the video.",
    aliases: ["video is wrong", "can't find what's in the video"],
    sources: ["SUP-558", "SUP-609"],
  },
  {
    id: "certification",
    topic: "academy",
    group: "training",
    question: "How do I get certified now?",
    answer:
      "Certification is a sales call in [Call Practice](/coach/script/simulator). Open Win Clients, then Call Practice. You run the call, it's scored, and you pass at 60 percent. Your result and feedback come back to you in Support within a week.\n\nIf you did the assessment and haven't heard back, tell us in Support and we chase it.",
    aliases: ["certificate", "coach assessment", "certified profit coach", "mark has left"],
    sources: ["Yair, WhatsApp 6 Nov", "SUP-525", "SUP-583"],
  },
  // academy / community
  {
    id: "group-calls",
    topic: "academy",
    group: "community",
    question: "When are the group calls, and where is the link?",
    answer:
      "Monday and Thursday at 4pm UK time. The link is always the same: [businesscoachacademy.com/calls](https://businesscoachacademy.com/calls).\n\nThe recording is ready about two hours after each call. Open the [community calendar](/coach/community/calendar), click the call and press Watch recording. Dates and any changes show on the same calendar.",
    aliases: ["zoom link for calls", "call recording", "missed the call"],
    sources: ["SUP-500", "community 1 Jun, 23 Jun"],
  },
  {
    id: "call-recordings",
    topic: "academy",
    group: "community",
    question: "Where are the recordings of the group calls?",
    answer:
      "1. Open the [community calendar](/coach/community/calendar).\n2. Click the call you missed.\n3. Press Watch recording.\n\nZoom takes about two hours to get the recording ready, so a call that ends at 5pm is there by about 7pm.\n\nIf you cannot find one, say which date in Support and we send the link.",
    aliases: ["recording of thursday's call", "missed call recording"],
    sources: ["community 1 Jun", "community 23 Jun"],
  },
  {
    id: "community-calendar-check-url",
    topic: "academy",
    group: "community",
    fix: true,
    question: "Google Calendar says \"check the URL\" when I add the group calls. What do I do?",
    answer:
      "1. Open the [community calendar](/coach/community/calendar) and click Subscribe, then Copy feed link.\n2. In Google Calendar on a computer, open Settings, then Add calendar, then From URL.\n3. Paste the link and add it.\n\nGoogle can take a few hours to show the calls, then keeps them up to date when times change.\n\nIf that still fails, click Download .ics in the same box and open the file. That adds the calls as they are today, so do it again if times change.",
    aliases: ["google calendar sync", "check the url", "calls not in my calendar", "add group calls to my calendar", "calendar feed", "subscribe to calls"],
    sources: ["ticket 7 Sep", "app"],
  },
  {
    id: "community-post",
    topic: "academy",
    group: "community",
    question: "How do I post in the community?",
    answer:
      "Open [Community](/coach/community) and click Write something… at the top. Add a title and your message. You can add photos, videos or a link.\n\nChoose where it goes under Where to post: General Discussion, Wins, Intros, or Ask & Share for questions. Then click Post. Only BCA posts Announcements.\n\nFor a question about a lesson, ask from the lesson page. You can make it Private so only you and the team see it.",
    aliases: ["write a post", "share a win", "ask the community", "introduce myself", "ask and share"],
    sources: ["app"],
  },
  {
    id: "community-map",
    topic: "academy",
    group: "community",
    question: "How do I add myself to the members map?",
    answer:
      "1. Open [Members](/coach/community/members?view=map) and switch to Map.\n2. In the Your location box at the top right, type your town and country and click save.\n3. Click Place pin on map to put your pin in the right spot.\n\nTo move it later, click Update map pin.",
    aliases: ["community map", "member map", "add my location", "map api key", "pin on map"],
    sources: ["ticket 5 Oct (API Key needed on Community Map)", "app"],
  },
  // blueprint
  {
    id: "about-you-done-next",
    topic: "blueprint",
    question: "I've done About You. What happens next?",
    answer:
      "Next is your Blueprint Call. Book it from Get set up on your [Blueprint](/coach/blueprint). On the call we agree your market and your offer, and then we write the rest of your Blueprint.\n\nEach page shows a label. BCA to do and In progress mean we are writing it, so there is nothing for you to do. Review means it is ready for you. Read it, change anything that is off, then press Sign off this page.\n\nWhile you wait, work through Get set up: connect LinkedIn and your email, put the app on your phone and turn on reply alerts. Once you sign off your campaign, we switch it on.",
    aliases: ["finished about you", "about me done", "what do I do now", "blueprint next step", "anything else you need from me", "when does my campaign start", "sign off this page"],
    sources: ["ticket 1 Nov", "ticket 21 Oct", "app"],
  },
  {
    id: "own-name-or-company",
    topic: "blueprint",
    question: "Should I use my own name or a company name?",
    answer:
      "On LinkedIn, use your own name. People connect with a person, and your profile is where prospects land. Your company name goes on your invoices, your website and your booking page if you want it there.\n\nIf you already trade under a company name your clients know, keep it. Tell us in Support and we use it where it fits.",
    aliases: ["does the company name matter", "trading name", "business name"],
    sources: ["Bruce, WhatsApp 6 Nov"],
  },
  {
    id: "linkedin-profile-changes",
    topic: "blueprint",
    question: "What should I change on my LinkedIn profile before my campaign goes live?",
    answer:
      "We write all five parts for you: headline, About, banner wording, experience and featured. They appear on the LinkedIn profile page of your [Blueprint](/coach/blueprint) once your About You pages are done.\n\nCopy each part into LinkedIn, then tell us in Support. We check it before the campaign goes live, because every message sends people to your profile.",
    aliases: ["update my linkedin", "linkedin headline", "banner"],
    sources: ["SUP-550", "SUP-565", "SUP-570", "SUP-591"],
  },
  {
    id: "instagram-facebook",
    topic: "blueprint",
    question: "Do I need Instagram or Facebook pages for my coaching business?",
    answer:
      "Most coaches don't. Put your profile where your customers spend their time. For most owners we help, that is LinkedIn, so LinkedIn plus your newsletter does the work.\n\nIt depends on who you help. Some owners hardly use LinkedIn but spend plenty of time on Facebook and Instagram. In our own numbers, owners in trades, building, hotels and restaurants, and health and care accept far fewer LinkedIn requests than owners in consulting, tech or recruitment. Restaurant and bar owners, gym owners, salon owners, builders and trades, and shop owners are good examples. If you help owners like these, run your campaigns on Facebook or Instagram too, because that is where they are.\n\nNot sure where your owners are? Look at five of your best-fit owners and see where they post. Or ask in Support and we look at your market with you.",
    aliases: ["social media", "do I need facebook", "do I need instagram", "which social media", "where are my customers"],
    sources: ["Bruce, WhatsApp 6 Nov"],
  },
  {
    id: "newsletter-what-happens",
    topic: "blueprint",
    question: "What happens with the newsletter?",
    answer:
      "You write a LinkedIn newsletter, one issue at a time, and your campaign messages point prospects to it. It is the thing that makes a stranger trust you before a call.\n\nWe write the first issue from your Blueprint, in your voice, using your stories and results. You read it, change what you like and publish it on LinkedIn. After that, Ava writes each new issue with you in about twenty minutes. It lives on the [LinkedIn Newsletter page](/coach/blueprint) of your Blueprint.",
    aliases: ["newsletter", "do I need a newsletter", "who writes the newsletter"],
    sources: ["Bruce, WhatsApp 6 Nov", "content/agent/capabilities/linkedin-marketing"],
  },
  {
    id: "newsletter-vs-article",
    topic: "blueprint",
    question: "What's the difference between a newsletter, an issue, an article and a post?",
    answer:
      "People use \"newsletter\" for two things, which is why it gets confusing.\n\nThe newsletter is the whole series, with one name, such as \"The Profit Letter\". People subscribe to it once. You set it up on LinkedIn one time.\n\nAn issue is one edition inside that series. Each time you publish an issue, LinkedIn tells every subscriber. When we say \"write this week's newsletter\", we mean one issue.\n\nAn article is a long piece on LinkedIn that sits on its own, outside the newsletter. Subscribers get no alert, so fewer people see it. We use an article to point people back to the newsletter.\n\nA post is the short update in people's feed: a few lines, maybe a picture. Use posts for news, like telling people what you do now, and to point people to your latest issue.\n\nIn short: the newsletter is the series, an issue is one edition, an article stands alone, and a post is short. All of them live on the [LinkedIn Newsletter page](/coach/blueprint) of your Blueprint, where we write them with you.",
    aliases: ["newsletter or article", "what is an issue", "newsletter vs post", "article vs post", "edition"],
    sources: ["Zander, 21 Nov", "content/agent/capabilities/linkedin-marketing"],
  },
  {
    id: "newsletter-first-issue",
    topic: "blueprint",
    question: "Can my first newsletter be a general announcement?",
    answer:
      "Make the announcement a post, and make your first newsletter issue useful. They are two different things on LinkedIn. If the words get confusing, read [newsletter, issue, article and post](/coach/support?tab=help&a=newsletter-vs-article).\n\nA post is the short update that shows in people's feed. That is the right place to tell your network what you do now. Here is the shape we recommend:\n\n1. One line on the news: \"After 20 years running a [type of] business, I now help owners [one plain result].\"\n2. Why: one short story or reason, in your own words.\n3. Who you help: \"Owners of [type of] businesses with [size] who [problem].\"\n4. One ask: \"If that's you, or someone you know, send me a message.\"\n\nKeep it under 150 words. Then send a personal message to the people who know you best.\n\nYour first newsletter issue is different. Write it about one real problem your ideal client has and what to do about it. That gets read by the people you want as clients. We write the first issue for you, so you only need to tell us which problem to start with.",
    aliases: ["announce my business", "first issue", "launch post", "announcement post", "tell my network"],
    sources: ["Bruce, WhatsApp 6 Nov"],
  },
  // get-clients / prospects
  {
    id: "pool-vs-prospects",
    topic: "get-clients",
    group: "prospects",
    question: "What's the difference between Lead Lists and Pipeline?",
    answer:
      "The [Lead Lists](/coach/campaigns?tab=pool) is everyone you might contact: imports, searches and spreadsheets. You sort it into lists and add people from it to campaigns.\n\n[Pipeline](/coach/prospects) is the people you have added, or who took your BOSS Score. Open someone there to see their score, their messages and what happens next.",
    aliases: ["what is the pool", "pool or prospects", "where are my leads"],
    sources: ["ticket 20 Nov", "app"],
  },
  {
    id: "prospect-stages",
    topic: "get-clients",
    group: "prospects",
    question: "What does each column on Pipeline mean?",
    answer:
      "[Pipeline](/coach/prospects) has two views. Switch between them with the two small buttons at the top: Pipeline view (columns of cards) and List view (a table).\n\nPipeline view has a column for each stage. Some columns split into smaller groups inside them:\n\n1. Pool: people you might contact. Not started means they are in no campaign yet. In outreach means a campaign is messaging them. This column is hidden unless you turn it on.\n2. To sort: people with no stage yet, no scorecard, no call and no next step. Give each one a status or a next action.\n3. Replied: they answered a message.\n4. Interested: they want to hear more. Lead magnet means they finished your BOSS Score. Expressed means they showed interest another way, such as a reply, without finishing it.\n5. Booked: a call is set. Upcoming is a call still to come. Rebook is a call that has happened or they missed, so book the next one.\n6. Follow-up: you set a next action. It splits by when it is due: Overdue, This week, This month, Later and No date.\n7. Closed: Won (they became a client), Abandoned (it went quiet) or Lost (they said no).\n\nCards move on their own as things happen. A booked call moves them to Booked, a finished BOSS Score to Interested, a next action to Follow-up. You can also change a status by hand. Click the status on their card or row and pick one. To hand it back to the app, choose Use auto.\n\nList view shows one row per person:\n\n1. Name.\n2. Contact Info: email and phone.\n3. Status: the stage above. Click it to change it.\n4. LinkedIn: opens their profile.\n5. Source: where they came from, such as BOSS Score, Sales Navigator, LinkedIn, Campaign or Manual.\n6. Boss: their BOSS Score and the date. Share copies their report link. Get link copies a scorecard link made just for them.\n7. Boss Pro: the same for BOSS Pro. Start begins one with them.\n8. Date created: when they came into the app.\n9. Next call: the next booked call and when.\n10. Next action: what you plan to do next. Click to change it.\n\nBusiness details (revenue, team size and years in business) and CRM link are hidden at first. Click Columns to show or hide any column, and drag to change the order. Filter, Sort and Group sit beside it. Tags are not a column, so find them under Filter.",
    aliases: ["prospect status", "expressed interest", "prospects tab", "prospects columns", "what does lead magnet mean", "not started", "pipeline view", "to sort", "rebook"],
    sources: ["community 2 Oct", "app"],
  },
  {
    id: "fill-pool",
    topic: "get-clients",
    group: "prospects",
    question: "How do I add people to my lead lists?",
    answer:
      "Open [Lead Lists](/coach/campaigns?tab=pool) and click Add people. Choose how. Your connections brings in owners you already know on LinkedIn. Sales Navigator uses a search we build from your Blueprint, or one you paste in. Google Maps and Google Search find businesses by trade and town. Upload CSV takes a spreadsheet, and Add one person is for someone you met.\n\nEveryone lands in Lead Lists. You can also put them on a list as they come in. If someone is already in your Pool, they stay as one person, however many times you add them.",
    aliases: ["import prospects", "import linkedin connections", "google maps import", "upload csv", "add leads", "build my list"],
    sources: ["SUP-508", "SUP-511", "ticket 19 Nov", "app"],
  },
  {
    id: "need-sales-navigator",
    topic: "get-clients",
    group: "prospects",
    question: "Do I need Sales Navigator, and when should I get it?",
    answer:
      "If LinkedIn is your main way of finding clients, yes, and for most of our coaches it is. Get it before your first campaign goes live.\n\nIt helps in three ways:\n\n1. You can send about twice as many connection requests each week, so your campaign reaches twice as many owners. See [how many messages go out](/coach/support?tab=help&a=campaign-sending-limits).\n2. You can search and filter owners properly: by job title, industry, company size and area. Plain LinkedIn search can't do that.\n3. Those searches fill your lead lists. You bring them in, sort them into lead lists, and add the lists to your campaigns. See [how to import a Sales Navigator search](/coach/support?tab=help&a=sales-nav-import) and [Lead Lists and Pipeline](/coach/support?tab=help&a=pool-vs-prospects).\n\nThe app also uses it to bring in your own LinkedIn connections. If you mostly find clients another way, such as calls, email or events, you can fill your lead lists without it, using Google Maps, Google Search or a spreadsheet.\n\nYou can [get your first two months free](/coach/support?tab=help&a=sales-nav-free) with our link. Once you have it, connect it in [Settings](/coach/settings?tab=integrations).",
    aliases: ["should I get sales nav", "sales navigator subscription", "do I have to pay for sales navigator", "is sales navigator worth it"],
    sources: ["ticket 17 Nov", "app"],
  },
  {
    id: "sales-nav-free",
    topic: "get-clients",
    group: "prospects",
    question: "How do I get Sales Navigator free for two months?",
    answer:
      "Use [our Sales Navigator link](https://www.linkedin.com/premium/redeem/?upsellOrderOrigin=sn_referral_promotion&coupon=rbt8JKG-x&customKey=ref_s&redeemTypeV2=REFERRAL_COUPON). It gives you the first two months free.\n\n1. Open the link while you are signed in to LinkedIn.\n2. Follow the steps. LinkedIn asks for a card, but takes nothing for two months.\n3. Connect it in [Settings](/coach/settings?tab=integrations) so we can build your lead lists.\n\nAfter two months it carries on at LinkedIn's normal price. If you want to stop, cancel in LinkedIn before then.\n\nIf LinkedIn says you can't use the offer, message Support and we help you.",
    aliases: ["sales navigator free trial", "sales nav referral link", "sales navigator discount", "2 months free", "free sales navigator", "sales navigator coupon"],
    sources: ["Zander, 20 Nov", "coach setup bar"],
  },
  {
    id: "sales-nav-import",
    topic: "get-clients",
    group: "prospects",
    question: "How do I import a Sales Navigator search?",
    answer:
      "1. Open [Lead Lists](/coach/campaigns?tab=pool), click Add people, then Sales Navigator.\n2. Click Base search. It opens Sales Navigator with our filters set.\n3. Change the area or anything else you want, then copy the web address.\n4. Back here, paste it under Custom URL. A saved search link works too.\n5. Pick an Import size and click Import to pool.\n\nSales Navigator needs to be connected in [Settings](/coach/settings?tab=integrations) first.",
    aliases: ["sales navigator url", "import saved search", "custom url", "base search"],
    sources: ["ticket 19 Nov", "SUP-505", "SUP-563", "app"],
  },
  {
    id: "sales-nav-invalid-url",
    topic: "get-clients",
    group: "prospects",
    fix: true,
    question: "Sales Navigator link says \"invalid URL\" when I import. Why?",
    answer:
      "You pasted a Sales Navigator link into the LinkedIn search box, or the other way round. They are two different imports. Use the Sales Navigator option for a Sales Navigator link.\n\nIf the Sales Navigator option is greyed out, Sales Navigator has disconnected. Open [Settings](/coach/settings?tab=integrations), find Sales Navigator and connect it again.",
    aliases: ["sales navigator url", "import saved search", "url is missing query"],
    sources: ["SUP-505", "SUP-538", "SUP-563"],
  },
  {
    id: "linkedin-import-fewer",
    topic: "get-clients",
    group: "prospects",
    fix: true,
    question: "The LinkedIn import brought in fewer people than I have connections. Is that right?",
    answer:
      "Usually yes. The import brings in what LinkedIn returns, and LinkedIn often returns fewer than your total. If you asked for 2,500 and the list has 700, you get 700.\n\nIf the number looks far too low, send us the number you expected and the number you got, and we check.",
    aliases: ["import stuck", "only imported some connections"],
    sources: ["SUP-508"],
  },
  {
    id: "import-progress",
    topic: "get-clients",
    group: "prospects",
    fix: true,
    question: "My import says \"69 of 2,500\". Is it working?",
    answer:
      "Yes. A big import runs in parts, one company size at a time, and the line shows how far it has got with the part it is on. It then says which part comes next.\n\nYou can leave the page. The people show in the list once the import finishes. A list of a few thousand can take a while.\n\nIf the number has not moved for a day, send us a screenshot in Support.",
    aliases: ["import stuck", "is it importing", "how long does an import take", "not sure if it imported", "import pool"],
    sources: ["SUP-508", "ticket 19 Nov", "app"],
  },
  {
    id: "pool-search-wrong-businesses",
    topic: "get-clients",
    group: "prospects",
    fix: true,
    question: "The Lead Lists search found the wrong kind of businesses. What can I do?",
    answer:
      "A broad term pulls in everything nearby that mentions it. \"IT services\" finds electricians and carpet cleaners who list IT work. Use the words the owner would use for their own business, and add the town or area.\n\nIf you are stuck on wording, tell us who you want and we run the search with you.",
    aliases: ["google maps import", "pool import wrong results"],
    sources: ["SUP-511"],
  },
  {
    id: "filtered-pool-next",
    topic: "get-clients",
    group: "prospects",
    question: "I've filtered my lead lists. What's the next step?",
    answer:
      "1. In [Lead Lists](/coach/campaigns?tab=pool), tick the people you want.\n2. Click Add to campaign and pick the campaign.\n\nA LinkedIn campaign needs people with a LinkedIn profile, and an email campaign needs an email address. Anyone on your blacklist is left out on its own. You can also add them from inside the campaign: open its Prospects tab, click Add prospects and choose Already in the system.\n\nRather we did it? Tell us in Support which list to start with and we add them for you.",
    aliases: ["pool ready", "start my campaign", "marketing campaign going", "add to campaign", "add list to campaign", "add prospects"],
    sources: ["SUP-608"],
  },
  {
    id: "export-prospects",
    topic: "get-clients",
    group: "prospects",
    question: "Can I export my prospects?",
    answer:
      "Yes. On [Lead Lists](/coach/campaigns?tab=pool) or [Pipeline](/coach/prospects), click Export. Choose Shown columns for what you see on screen, or All columns for everything. If you have ticked some people, you can export just those.\n\nYou get a CSV file that opens in Excel or Google Sheets.",
    aliases: ["export to excel", "download prospects", "download my list", "csv export"],
    sources: ["ticket 21 May", "app"],
  },
  {
    id: "stop-scorecard-emails",
    topic: "get-clients",
    group: "prospects",
    question: "How do I stop a prospect's follow-up emails?",
    answer:
      "Use this when someone took your BOSS Score but you don't want the emails to keep going to them, for example a friend testing it or someone who isn't a prospect.\n\n1. Open [Pipeline](/coach/prospects) and click the person's name.\n2. On the left, find the Campaigns section. Each set of follow-ups shows as a small box, such as \"Scorecard · Completed · In sequence\".\n3. Click the small × on that box.\n4. Click OK when it asks \"Do you want to remove them from…?\"\n\nThat stops the emails for this one person. Everyone else keeps getting theirs.\n\nThe emails also stop on their own when the person books a call or replies. To stop everything for someone who asked not to be contacted, see [someone asked not to be contacted](/coach/support?tab=help&a=do-not-contact). If you get stuck, send us their name or email in Support and we stop it.",
    aliases: ["unsubscribe prospect", "stop nurture emails", "spamming her", "stop follow up", "stop sequence", "remove from sequence", "stop scorecard emails"],
    sources: ["community 28 Oct", "app"],
  },
  {
    id: "do-not-contact",
    topic: "get-clients",
    group: "prospects",
    question: "Someone asked not to be contacted. How do I stop everything?",
    answer:
      "1. Open each campaign they are in, go to the Prospects tab, tick them and click Remove. Nothing more goes out to them.\n2. In [Lead Lists](/coach/campaigns?tab=pool), tick them and click Blacklist, so no campaign takes them again.\n3. If they took your BOSS Score, stop their follow-up emails too. See [stop a prospect's follow-up emails](/coach/support?tab=help&a=stop-scorecard-emails).",
    aliases: ["unsubscribe", "do not contact", "dnd", "opt out", "remove from campaign", "blacklist", "stop messaging someone"],
    sources: ["ticket 12 Jun", "app"],
  },
  // get-clients / campaigns
  {
    id: "start-new-campaign",
    topic: "get-clients",
    group: "campaigns",
    question: "How do I start a new campaign myself?",
    answer:
      "Open [Campaigns](/coach/campaigns), then:\n\n1. Click Create campaign.\n2. Type a name, such as \"Owners in Leeds, November\", and pick LinkedIn, Email or WhatsApp.\n3. Choose Templates to start from one we wrote, or Blank to write it yourself. Templates are for LinkedIn.\n4. If you chose Templates, pick one from Choose a template.\n5. Open the Steps tab. Click each step and read or change the words. Change the parts in square brackets to fit you and the people you are writing to.\n6. Open the Prospects tab, click Add prospects and bring people in from your Pool or a lead list.\n7. Go back to the Campaigns list and flip the switch next to its name to start it.\n\nWhich template? Connection sends a blank request, then short messages. Tribe connection sends a short note to a group people feel part of, such as owners in one town. Warm network and Reactivation write to people you already know, so run one of those first. Ongoing nurture keeps in touch over months, and Positive replies helps you answer people who are keen. To choose between a note and no note, see [connection requests with a note or without](/coach/support?tab=help&a=connection-note).\n\nFor a seasonal campaign, such as Christmas, click the three dots on a campaign that works and choose Duplicate. Then change the words for the season.\n\nLinkedIn needs to be connected first. An email campaign needs Gmail or Outlook connected. Once it runs, check [the numbers to watch](/coach/support?tab=help&a=campaign-kpis).",
    aliases: ["launch a campaign", "create campaign", "set up a new campaign", "use a template", "turn my campaign on", "christmas campaign", "seasonal campaign", "which template"],
    sources: ["ticket 19 Nov", "SUP-608", "app"],
  },
  {
    id: "connection-note",
    topic: "get-clients",
    group: "campaigns",
    question: "Should I send connection requests with a note or without?",
    answer:
      "It depends on what you want most: more connections, or calls in your diary soon.\n\nHere is what we found across our coaches' campaigns on the old platform:\n\n1. Blank request, no note: 17.8% accepted, 0.12 meeting requests per 100 sent.\n2. Any note: 14.2% accepted, 0.19 meetings per 100.\n3. A short note with a real result (a proof note): 11.9% accepted, 0.31 meetings per 100.\n4. A note with a link in it: 11.2% accepted, no meetings at all.\n\nSo a blank request gets a few more people to accept, but a proof note books 2 to 3 times as many meetings. Fewer accept a note, but more of them meet you.\n\nIf you are playing the long game, building an audience who read your newsletter and turning them into clients over months, blank requests grow your network fastest. If you want calls in your diary as soon as you can, use a proof note. The shape is: \"I see you run a UK [industry] company. Are you looking to [simple result]? I ask because [as a role, or with a client like them] I used a simple system to [before to after, with numbers] in [time]. Is this of interest?\" Never put a link in the note.\n\nTake the numbers as a guide. Some notes were weak, and some coaches wrote to sectors that hardly use LinkedIn. Whichever you pick, [test both](/coach/support?tab=help&a=ab-testing) on the same kind of people and count meetings, not just connections. Our [campaign templates](/coach/support?tab=help&a=start-new-campaign) have both: Connection sends a blank request, and Tribe connection sends a short note, and [the numbers to watch](/coach/support?tab=help&a=campaign-kpis) explains what to count.",
    aliases: ["connection request note", "connect without a note", "acceptance rate", "blank connection request", "proof note"],
    sources: ["community 26 Oct", "content/ai-knowledge/outreach-research.md"],
  },
  {
    id: "edit-campaign-message",
    topic: "get-clients",
    group: "campaigns",
    question: "How do I change a message in my campaign?",
    answer:
      "Open the campaign from [Campaigns](/coach/campaigns) and go to the Steps tab. Click the step you want and change the words. It saves as you go.\n\nThe change only reaches people who have not had that message yet. Anything already sent stays as it was.\n\nWant a second opinion first? Paste the new wording into Support and we read it.",
    aliases: ["edit message", "change my follow up", "edit connection note", "update campaign wording", "edit steps"],
    sources: ["SUP-507", "app"],
  },
  {
    id: "add-link-to-message",
    topic: "get-clients",
    group: "campaigns",
    question: "How do I put a link in a campaign message?",
    answer:
      "Open the step in the Steps tab. Under the message box is a row of fields you can click to add. Booking link adds your booking page, set up for that person, so the call links back to the campaign. Boss assessment link adds your BOSS Score link. Each person gets their own version when it sends.\n\nFor any other link, such as a video or a web page, paste the full web address into the message.\n\nYou find your BOSS Score links to copy under [Campaigns, then Lead Magnets](/coach/campaigns?tab=magnets).",
    aliases: ["add booking link", "add scorecard link", "click through link", "links in messages", "merge fields", "personalise message"],
    sources: ["ticket 17 Nov", "app"],
  },
  {
    id: "add-video-voice-note",
    topic: "get-clients",
    group: "campaigns",
    question: "How do I add a video or voice note to a campaign?",
    answer:
      "1. Open the campaign and go to the Steps tab.\n2. Add a Video message or Voice note step. Or open a LinkedIn message step and switch it from Message to Voice or Video.\n3. Click Record to make it there, or Upload to use a file you already have.\n\nVideos can be MP4 or MOV, and voice notes M4A or MP3. Each file must be under 50 MB and up to 5 minutes long.\n\nIf an upload fails, send us the file and the campaign name in Support and we add it for you.",
    aliases: ["video can't upload", "upload video", "voice note", "record a video", "video too big", "50 MB"],
    sources: ["ticket 20 Nov", "app"],
  },
  {
    id: "manual-messages-to-do",
    topic: "get-clients",
    group: "campaigns",
    question: "A step says \"You send this yourself\". Where do I send it?",
    answer:
      "That step is set to Manual. When someone reaches it, it waits for you in To do, the panel on the right of [Campaigns](/coach/campaigns). Click Send, Snooze it for later, or Skip it and the sequence carries on.\n\nPhone call steps show there too. Press Mark as called once you have rung them.\n\nIf you would rather it sent on its own, open the step and switch it from Manual. You can also turn on a fallback, so it sends by itself if you have not sent it in time.",
    aliases: ["remind me messages", "manual step", "to do list", "call step", "messages waiting for me"],
    sources: ["app"],
  },
  {
    id: "campaign-sending-limits",
    topic: "get-clients",
    group: "campaigns",
    question: "How many messages go out, and when?",
    answer:
      "Click Settings at the top of [Campaigns](/coach/campaigns). You set weekly targets for connection requests, messages and post likes, plus the hours they send in. These cover every campaign on your LinkedIn account, and we spread them across your sending hours.\n\nWe suggest 100 connection requests a week. Once your LinkedIn Social Selling Index is 70 or more, you can go up to 200.\n\nSafety warm-up starts a new or quiet account slowly over four weeks, so LinkedIn is less likely to restrict it. Leave it on unless we tell you otherwise.",
    aliases: ["daily limit", "how many invites", "sending hours", "warm up", "ssi score", "linkedin limits"],
    sources: ["SUP-519", "app"],
  },
  {
    id: "pause-stop-campaign",
    topic: "get-clients",
    group: "campaigns",
    question: "How do I pause or stop a campaign?",
    answer:
      "On [Campaigns](/coach/campaigns), flip the switch next to the campaign's name to off. Nothing more goes out until you switch it back on, and everyone keeps their place.\n\nTo put it away, click the three dots on its row and choose Archive. It stops sending and moves to Archived at the bottom of the list, where you can Unarchive it later. Delete removes the campaign, its steps and its queue for good. Your conversations and prospects stay either way.",
    aliases: ["turn campaign off", "pause campaign", "archive a campaign", "delete a campaign", "stop sending"],
    sources: ["SUP-572", "app"],
  },
  {
    id: "ab-testing",
    topic: "get-clients",
    group: "campaigns",
    question: "How do I A/B test my campaign messages?",
    answer:
      "An A/B test sends two versions of one message to similar people, so you can see which works better. Always run one. It is the quickest way to get more people accepting, replying and booking.\n\n1. Open the campaign from [Campaigns](/coach/campaigns) and go to the Steps tab.\n2. Click the step you want to test, such as the connection request or the first message.\n3. Flip the A/B switch to On. You now have version A and version B, both with the same words.\n4. Click B and change one thing, such as the first line, or a note against no note.\n5. Leave it running.\n\nEach version shows its rate on its A or B button. For a connection request that is how many accepted. For a message it is how many showed interest. Once each version has reached at least 5 people, the one ahead shows Best. Wait for more than that before you decide: 100 or more people each gives you a fair answer.\n\nThen keep the winner, switch the loser off, and test the next thing. Change one thing at a time, or you won't know what made the difference. To know which numbers to judge by, see [the numbers to watch](/coach/support?tab=help&a=campaign-kpis).",
    aliases: ["split test", "a/b test", "ab test", "two versions", "test my messages", "which message works best"],
    sources: ["Zander, 21 Nov", "app"],
  },
  {
    id: "campaign-kpis",
    topic: "get-clients",
    group: "campaigns",
    question: "Which numbers should I watch in my campaigns?",
    answer:
      "KPIs are the few numbers that tell you if your campaign is working. Watch these, in this order:\n\n1. Connect rate: how many of the people you asked accepted. Our coaches average about 17%. If it's low, look at who you're asking and your profile.\n2. Reply rate or Interest rate: how many people who connected replied, or showed interest. If people accept but don't reply, look at your messages.\n3. Calls booked: how many calls came from the campaign. This is the one that matters most. Count calls, not connections.\n4. Clients won: how many calls turned into clients.\n\nTo find them, open [Campaigns](/coach/campaigns). The top of the page shows People reached, Connect rate and Replies across all your campaigns. Open one campaign and its Overview tab shows its Connect rate, its Reply or Interest rate, and a daily chart.\n\nAs a rough guide from our coaches, 1,000 connection requests bring 1 or 2 booked calls. Give a campaign about 4 weeks of steady sending before you judge it. To work out how many calls you need for the income you want, open the [Scoreboard](/coach/scoreboard). To improve a number, [A/B test](/coach/support?tab=help&a=ab-testing) one thing at a time.",
    aliases: ["kpi", "kpis", "campaign stats", "connect rate", "reply rate", "is my campaign working", "campaign numbers", "acceptance rate"],
    sources: ["content/ai-knowledge/outreach-research.md", "app"],
  },
  {
    id: "scoreboard",
    topic: "get-clients",
    group: "campaigns",
    question: "What is the Scoreboard?",
    answer:
      "[Scoreboard](/coach/scoreboard) shows the numbers it takes to hit an income target, from the first message to new clients. It starts from example numbers, not yours, so treat it as a plan.\n\nPick the income targets a month you want to compare. Then drag any number, like how many people reply or how many calls turn into clients, and watch the income change. Good and Great fill in our targets. Your choices save on this device.",
    aliases: ["targets", "my numbers", "how many clients", "income target", "funnel numbers"],
    sources: ["app"],
  },
  {
    id: "campaign-feedback",
    topic: "get-clients",
    group: "campaigns",
    question: "Can you check my campaign messages before I send them?",
    answer:
      "Yes. Paste them into Support, or tell us the campaign name, and we read them before they go out. We look at the opening line, how the scorecard comes in and whether each message earns a reply.\n\nOnly send what you are comfortable sending. Then watch the numbers and change one thing at a time.",
    aliases: ["review my messaging", "campaign copy feedback"],
    sources: ["SUP-507"],
  },
  {
    id: "where-replies-go",
    topic: "get-clients",
    group: "campaigns",
    question: "Where do replies show up, and how do I answer?",
    answer:
      "Every reply lands in [Conversations](/coach/conversations), from LinkedIn, email and WhatsApp. Click a conversation, type in the box and send. Your reply goes out on the channel they used.\n\nClick Suggest a reply and Ava drafts one for you to change and send. Unread shows who is waiting on you.\n\nWhen someone replies, their campaign stops for them, so they do not get the next follow-up. If a message seems missing, click Sync now.",
    aliases: ["conversations", "inbox", "reply to a prospect", "where are my messages", "linkedin replies"],
    sources: ["ticket 17 Nov", "SUP-519", "app"],
  },
  {
    id: "messages-missing",
    topic: "get-clients",
    group: "campaigns",
    fix: true,
    question: "LinkedIn or email messages are missing from Conversations. What do I check?",
    answer:
      "In [Conversations](/coach/conversations), click Sync now. If it says LinkedIn needs reconnecting, click Reconnect and sign in to LinkedIn again. The messages come back once it shows Connected.\n\nIf it says LinkedIn asked us to slow down, wait a few minutes. It tries again on its own. Older messages can take up to an hour to arrive.\n\nIf it is connected and a message is still missing, send us one example in Support, with the person's name, and we look at it.",
    aliases: ["conversations empty", "can't see linkedin messages", "email content not showing", "linkedin message sync failing", "sync not working", "reconnect linkedin"],
    sources: ["SUP-519", "SUP-520", "SUP-566"],
  },
  {
    id: "unknown-contact",
    topic: "get-clients",
    group: "campaigns",
    fix: true,
    question: "A conversation shows \"Unknown contact\" even though I know who it is. Why?",
    answer:
      "The person has letters or a tagline after their name on LinkedIn, and the inbox could not read it as a name. We fixed the common cases, so new conversations pick up the name.\n\nIf you still see one, send us a screenshot in Support.",
    aliases: ["unknown contact", "name not recognised"],
    sources: ["SUP-566", "SUP-556"],
  },
  {
    id: "old-campaigns",
    topic: "get-clients",
    group: "campaigns",
    question: "Where are my old campaigns from the previous tool?",
    answer:
      "Open [Campaigns](/coach/campaigns) and scroll to the bottom. Click Archived. Your old campaigns are there with their steps, messages and people, so you can copy what worked into a new one.\n\nIf an old campaign is missing, tell us its name in Support and we bring it across.",
    aliases: ["previous campaigns", "archived campaigns", "connector campaigns"],
    sources: ["SUP-564", "SUP-572"],
  },
  {
    id: "old-automation-sending",
    topic: "get-clients",
    group: "campaigns",
    fix: true,
    question: "Messages are still going out from my old automation. How do I stop it?",
    answer:
      "Nothing should still be sending from the old tool. All old campaigns were switched off when we moved everyone across, and they sit in Archived here.\n\nIf someone replies to an old message, send us their name and the date in Support. We look it up and make sure it has stopped.",
    aliases: ["stop old campaign", "connector still running"],
    sources: ["SUP-572"],
  },
  // get-clients / boss-score
  {
    id: "what-are-lead-magnets",
    topic: "get-clients",
    group: "boss-score",
    question: "What are lead magnets, and where do I manage them?",
    answer:
      "A lead magnet is something free a business owner gets for their name and email. Yours are the BOSS Score and BOSS Pro. Find them under Get Calls, in [Lead Magnets](/coach/campaigns?tab=magnets).\n\nOpen one to manage it. Overview shows how many people opted in, started and finished. People lists each of them by name. Sequences holds the emails they get afterwards. Share gives you the links, a QR code and the code for your website.\n\nSettings on the same page sets who sends the emails: this app or your old CRM.",
    aliases: ["about lead magnets", "lead magnet", "where are my lead magnets", "funnel settings"],
    sources: ["ticket 20 Nov", "app"],
  },
  {
    id: "scorecard-links",
    topic: "get-clients",
    group: "boss-score",
    question: "Where are my BOSS Score links to send to prospects?",
    answer:
      "1. In the left sidebar, click Get Calls.\n2. Click the Lead Magnets tab.\n3. Open Boss Score Assessment and click Share.\n4. Copy the link and paste it into your message.\n\nEach link is yours, so anyone who completes it shows up in your [Pipeline](/coach/prospects) with their score. To send one person a link with their details already filled in, see [personalised scorecard links](/coach/support?tab=help&a=personalised-scorecard-link).\n\nThe older videos show this under Settings. It moved, and the videos are being redone.",
    aliases: ["scorecard link", "lead magnet link", "boss score not in my profile"],
    sources: ["SUP-609", "SUP-558"],
  },
  {
    id: "personalised-scorecard-link",
    topic: "get-clients",
    group: "boss-score",
    question: "How do I send a prospect a scorecard link with their details filled in?",
    answer:
      "1. Open [Lead Magnets](/coach/campaigns?tab=magnets), open Boss Score Assessment and click Share.\n2. Next to Scorecard only, click Personalise.\n3. Pick the prospect, or add someone new, and click Generate link.\n\nThe link skips the landing page and fills in their details, so they go straight to the questions. For BOSS Pro, open Boss Score Pro, click Share and use Personalise next to Assessment.",
    aliases: ["personalised link", "pre-filled scorecard", "send scorecard to one person", "enter details twice"],
    sources: ["ticket 4 Jun", "app"],
  },
  {
    id: "scorecard-results",
    topic: "get-clients",
    group: "boss-score",
    question: "A prospect finished the scorecard. Where do I see their answers?",
    answer:
      "1. Open [Pipeline](/coach/prospects) and click the person's name.\n2. On the left, find the Assessment section.\n3. Click their Boss Score. Their report opens with the score, each answer and when they did it.\n\nTo send them a copy, see [send a prospect their scorecard](/coach/support?tab=help&a=send-prospect-their-scorecard).\n\nYou also get an email when someone completes it, so you can call them while it is fresh.",
    aliases: ["see scorecard answers", "completed scorecard", "only see the score"],
    sources: ["playbook", "community 26 May", "SUP-496"],
  },
  {
    id: "send-prospect-their-scorecard",
    topic: "get-clients",
    group: "boss-score",
    question: "Can I send a prospect a copy of the scorecard they filled in?",
    answer:
      "Yes. You copy a link to their report and send it to them yourself.\n\n1. Open [Pipeline](/coach/prospects) and click the person's name.\n2. On the left, find the Assessment section. You see their Boss Score and the date.\n3. Click Report link, just under the score. It copies the link and shows Copied!\n4. Open your message to them, in [Conversations](/coach/conversations), LinkedIn or email.\n5. Paste the link and send. They click it and see their full results.\n\nThere is a quicker way too. In the List view on Prospects, click Share in the Boss column. It copies the same link. For BOSS Pro, use Client link instead.\n\nIf you want it as a PDF for a meeting, ask in Support and we send one.",
    aliases: ["resend scorecard results", "prospect lost their scorecard", "share report", "send results", "report link"],
    sources: ["community 13 Jul", "app"],
  },
  {
    id: "boss-score-emails",
    topic: "get-clients",
    group: "boss-score",
    question: "Who sends the BOSS Score emails to people who take it?",
    answer:
      "You choose. Open [Lead Magnets](/coach/campaigns?tab=magnets), open a lead magnet and click Settings. Under Who emails people after they take one, pick This app or My old CRM. The choice covers every lead magnet.\n\nWith This app and your email connected, the report goes straight away from your own email, then 10 follow-ups over about three weeks. People who stop part way get three reminders. Each email offers your Constraint Call, and the emails stop when the person books or replies. You can read and edit them in the lead magnet's Sequences tab.\n\nWith no email connected, only the report goes, from our support address as \"Your Name via Profit Coach\". [Connect your email](/coach/settings?tab=integrations) to send the rest. With My old CRM, this app sends nothing, so your old CRM must send them.",
    aliases: ["boss score emails", "scorecard follow up emails", "who emails the report", "report email", "emails from support address", "old crm or this app"],
    sources: ["ticket 10 Aug", "ticket 4 Jun", "app"],
  },
  {
    id: "lead-magnet-analytics",
    topic: "get-clients",
    group: "boss-score",
    question: "How do I see who visited or opted in on my BOSS Score page?",
    answer:
      "Open [Lead Magnets](/coach/campaigns?tab=magnets) and open Boss Score Assessment. Overview shows how many people opted in out of everyone who viewed the page, and how many finished out of those who started. Use the date menu to pick from the last 7 days to all time.\n\nClick a stage, or View all, to open People. It lists everyone by name with how far they got, and you can search by name or email.\n\nSomeone who looks at the page and leaves without giving their details only counts as a view, so we have no name for them.",
    aliases: ["landing page analytics", "funnel analytics", "who opened my landing page", "drill through", "page visits", "how many people took my scorecard"],
    sources: ["ticket 12 Jun", "ticket 8 Jun", "app"],
  },
  {
    id: "embed-scorecard",
    topic: "get-clients",
    group: "boss-score",
    question: "Can I put the BOSS Score on my own website?",
    answer:
      "1. Open [Lead Magnets](/coach/campaigns?tab=magnets), open Boss Score Assessment and click Share.\n2. Under Embed on your website, pick Full funnel embed, which starts with the opt-in page, or Scorecard-only embed, which goes straight to the questions.\n3. Click Copy code.\n4. Paste the code where your website accepts HTML, such as an embed or code block.\n\nIt sizes itself to fit. Anyone who finishes it lands in your [Pipeline](/coach/prospects), the same as from your link.\n\nThe code needs your public link. If Share asks for one, add it there first.",
    aliases: ["embed", "iframe", "scorecard on my website", "opt in box on my site", "embed landing page"],
    sources: ["ticket 28 May", "app"],
  },
  {
    id: "blank-scorecard-print",
    topic: "get-clients",
    group: "boss-score",
    question: "Where's a blank BOSS Scorecard I can print?",
    answer:
      "Open [Toolkit, then Print](/coach/toolkit?view=print) under Get Calls. BOSS Scorecard - A4 carries your name, photo and a QR code that opens your scorecard online. Click PDF to print it, PNG for a picture, or SVG for a printer or designer.\n\nThe QR code needs your public link. If the page asks for one, set it in [Links](/coach/share) first.",
    aliases: ["blank score card", "printable scorecard", "paper scorecard", "scorecard pdf", "print the scorecard"],
    sources: ["ticket 16 Nov", "app"],
  },
  {
    id: "logos-graphics",
    topic: "get-clients",
    group: "boss-score",
    question: "Where do I get the Profit Coach logo and BOSS Score graphics for print?",
    answer:
      "Print-ready logos are in the [brand folder on Google Drive](https://drive.google.com/drive/folders/1HOJrtvNCSk3qUoqiQXxQvUeKh2ns89Oo?usp=sharing). Use them on letterheads, banners and slides.\n\nThe BOSS Compass, the BOSS Wheel and the 50 playbooks are in [Toolkit, then Brand graphics](/coach/toolkit?view=brand), as PNG or SVG. Posts, banners and the A4 scorecard with your name and QR code are under Social media posts and Print.",
    aliases: ["logo download", "letterhead", "svg files", "brand kit"],
    sources: ["SUP-467", "SUP-557", "community 21 May"],
  },
  // get-clients / calls
  {
    id: "rename-call-booking-page",
    topic: "get-clients",
    group: "calls",
    question: "How do I change my booking page, or rename the Constraint Call?",
    answer:
      "Open [Calls settings](/coach/calls?tab=settings) and click the calendar name. Constraint Call is the one your BOSS Score report books into. Change the name, the length, the notice you need and how the call happens, then click Save calendar.\n\nThe name shows on your booking page and in your BOSS Score emails, so one change covers both.\n\nTo share a booking page, click the share icon on that calendar's row. It copies the link.",
    aliases: ["constraint call", "rename my call", "change call name", "booking link", "where is my booking page", "call length"],
    sources: ["app"],
  },
  {
    id: "no-availability",
    topic: "get-clients",
    group: "calls",
    fix: true,
    question: "My booking page shows no available times. Where do I set my hours?",
    answer:
      "Open [Calls](/coach/calls) and click Settings at the top right. Set the days and hours you take calls and how much notice you need.\n\nIf a day you expect to be free shows nothing, check your own calendar. A busy event there blocks that time.",
    aliases: ["set availability", "calendar hours", "nothing available to book"],
    sources: ["SUP-573", "community 10 Jun"],
  },
  {
    id: "booking-no-zoom-link",
    topic: "get-clients",
    group: "calls",
    fix: true,
    question: "My booking confirmation has no Zoom or meeting link. Why?",
    answer:
      "The calendar has no meeting link set. To add one:\n\n1. Open [Calls settings](/coach/calls?tab=settings) and click the calendar name.\n2. Under How the call happens, choose Google Meet if your Google account is connected, or Custom and paste your own Zoom link.\n3. Click Save calendar.\n4. Book a test call to yourself. The link should be in the email and the calendar entry.\n\nChoose Zoom only once Zoom shows Connected in [Settings](/coach/settings?tab=integrations). Until then a Zoom calendar cannot take bookings.",
    aliases: ["no meeting link", "zoom link missing", "boss review booking"],
    sources: ["SUP-483", "SUP-494", "app"],
  },
  {
    id: "connect-zoom",
    topic: "get-clients",
    group: "calls",
    question: "How do I connect Zoom? The Connect button is greyed out.",
    answer:
      "Zoom does not connect yet for any coach. We are finishing the set-up, and the Connect button next to Zoom stays grey until then. We tell you in Support when it works.\n\nMeanwhile, put your own Zoom link on your booking calendar:\n\n1. Open [Calls settings](/coach/calls?tab=settings) and click the calendar name.\n2. Under How the call happens, choose Custom.\n3. Paste your personal Zoom meeting link and click Save calendar.\n\nEvery booking then carries that link. If your Google account is connected, Google Meet works too and makes a new link for each call. Choose Zoom only once it shows Connected in [Settings](/coach/settings?tab=integrations). Until then a Zoom calendar cannot take bookings.",
    aliases: ["zoom button greyed out", "connect zoom", "zoom integration", "add my zoom link", "zoom not working", "manually add call link"],
    sources: ["ticket 18 Nov", "app"],
  },
  {
    id: "zoom-scheduler",
    topic: "get-clients",
    group: "calls",
    question: "Zoom says Scheduler Basic has ended. Does that affect me?",
    answer:
      "Only if you used Zoom's own scheduler for bookings. Your booking page here does not need it.\n\nYou still need a way to make meeting links. Google Meet is free, or paste your own Zoom link. Open [Calls settings](/coach/calls?tab=settings), click the calendar name and choose under How the call happens.",
    aliases: ["zoom scheduler", "zoom paid plan", "google meet"],
    sources: ["SUP-503", "playbook"],
  },
  {
    id: "wrong-booking-time",
    topic: "get-clients",
    group: "calls",
    fix: true,
    question: "A booking shows the wrong time. What's wrong?",
    answer:
      "The time zone. Check it in your calendar settings under [Calls](/coach/calls) and in your [Profile](/coach/settings). Both should say UK.\n\nIf they are right and a booking is still an hour out, send us the booking in Support.",
    aliases: ["time zone", "booking an hour out"],
    sources: ["SUP-465"],
  },
  {
    id: "calls-own-events",
    topic: "get-clients",
    group: "calls",
    fix: true,
    question: "Why don't my own Google or Outlook events show in Calls?",
    answer:
      "Calls shows the calls people book with you, plus calls from your old CRM calendar. Your other events stay in your own calendar. They still block those times, so nobody can book over them.\n\nTo choose which calendars block your times, open [Calls settings](/coach/calls?tab=settings), use Calendars that block availability and click Save preferences. Calendar for new bookings sets where new calls land.\n\nIf a call someone booked is missing, send us their name in Support.",
    aliases: ["calendar shows no events", "my calendar is empty", "events not showing", "calendar not syncing"],
    sources: ["ticket 7 Sep", "app"],
  },
  {
    id: "two-people-one-call",
    topic: "get-clients",
    group: "calls",
    question: "How do I get two people onto one call?",
    answer:
      "1. Book the main contact as normal, or let them book themselves.\n2. Open the call in your own Google or Outlook calendar.\n3. Add the second person's email as a guest and save. Your calendar sends them the invite with the meeting link.\n\nOnly the main contact gets the reminder emails from us. If they booked themselves, you can also ask them to forward the invite to their colleague.",
    aliases: ["add a guest", "book two contacts", "partners on the call"],
    sources: ["SUP-521"],
  },
  {
    id: "scripts-page",
    topic: "get-clients",
    group: "calls",
    question: "What's on the Scripts page?",
    answer:
      "[Scripts](/coach/script) holds what to say at each stage with an owner, in order. Reach out has cold call, email and LinkedIn scripts. Then come New lead call, Booking objections, the BOSS Score Review, the Profit Roadmap call, and No-shows and reschedules.\n\nThe Profit Roadmap call opens a live call screen. Type notes as they talk, then press Personalise, and your pitch is rewritten around what they told you.",
    aliases: ["script", "what do I say on the call", "pitch", "personalised pitch", "roadmap call", "objections"],
    sources: ["app"],
  },
  {
    id: "call-simulator",
    topic: "get-clients",
    group: "calls",
    question: "Can I practise my sales calls?",
    answer:
      "Yes. Open [Scripts](/coach/script) and click Start practising on the Call simulator, or go straight to the [call simulator](/coach/script/simulator). You talk out loud with an AI owner, from a cold call to the close.\n\nPick the call, choose the objections you want to face or press Surprise me, and start. Afterwards you get a score and notes beside your lines, saved so you can look again.\n\nYou get a set number of practice minutes each month. They reset on the 1st.",
    aliases: ["practice", "role play", "sales simulator", "ai practice call"],
    sources: ["SUP-602", "app"],
  },
  // keep-clients
  {
    id: "profit-system",
    topic: "keep-clients",
    group: "profit-system",
    question: "What is the Profit System?",
    answer:
      "The Profit System is the map we use to grow an owner's business. It has three parts, which we call the 5, 3, 9:\n\n1. 5 levels: how much the business still depends on the owner, from Overwhelm up to Owner. See [the five levels](/coach/support?tab=help&a=five-levels).\n2. 3 pillars: Vision, Velocity and Value, the three big jobs in any business. See [the three pillars](/coach/support?tab=help&a=three-pillars).\n3. 9 steps: the nine areas you work through, three in each pillar. See [the nine steps](/coach/support?tab=help&a=nine-steps).\n\nUnder all of it sits a foundation, Owner Performance: the owner's own time, energy and habits.\n\nPut the 5 levels and the 10 areas (9 steps plus the foundation) together and you get a grid of 50 boxes. Each box has one playbook, a short guide to fixing that one thing. BOSS Pro asks one question per box, so it shows you exactly which boxes are red, amber or green for your client. See [running BOSS Pro with a client](/coach/support?tab=help&a=run-boss-pro).\n\nYou explain the Profit System to a new client in Session 1. The Classroom walks you through it: see [your first four sessions](/coach/support?tab=help&a=first-four-sessions).",
    aliases: ["profit system", "5 3 9", "what is the 5/3/9", "profit 5/3/9", "boss grid", "50 playbooks", "framework"],
    sources: ["content/ai-knowledge/methodology.md", "src/lib/bossData.ts"],
  },
  {
    id: "five-levels",
    topic: "keep-clients",
    group: "profit-system",
    question: "What are the five levels?",
    answer:
      "The five levels show how much a business still needs its owner. Most owners you meet are at level 1 or 2.\n\n1. Overwhelm: too many fires. It's hard to run even the day-to-day, and they don't know what to do next.\n2. Overworked: tired from doing and checking everything, because the team isn't trained and there are no systems yet.\n3. Organised: processes and training are in place, so things can run without them, at least for a short while.\n4. Overseer: they manage how the business performs and work on it, not only in it.\n5. Owner: leaders run the business. The owner steers and is hardly needed day to day.\n\nEach level has its own row of playbooks. You fix the lower level first, because there is no point building leaders (level 4) for a business that has no cash plan (level 1). BOSS Pro shows which level your client is at in each area.",
    aliases: ["5 levels", "owner levels", "overwhelm", "overworked", "organised", "overseer", "owner level"],
    sources: ["src/components/profitSystem/profitSystemData.ts", "src/lib/bossData.ts"],
  },
  {
    id: "three-pillars",
    topic: "keep-clients",
    group: "profit-system",
    question: "What are the three pillars?",
    answer:
      "The three pillars are the three big jobs in any business. Each holds three of the [nine steps](/coach/support?tab=help&a=nine-steps).\n\n1. Vision: being clear about the future. Where the business is going, the plan to get there and the next 90 days.\n2. Velocity: how fast profit and growth come. Cash, sales and marketing, and getting the work done well.\n3. Value: what the business is worth in the long run. The numbers, the systems and the team, so it can run, and sell, without the owner.\n\nThey give owners a simple way to see their business. Most start strong in one pillar and weak in another. A busy owner with plenty of sales but no plan has Velocity and no Vision.",
    aliases: ["3 pillars", "vision velocity value", "pillars"],
    sources: ["src/lib/profitSystemCopy.ts", "src/lib/bossData.ts"],
  },
  {
    id: "nine-steps",
    topic: "keep-clients",
    group: "profit-system",
    question: "What are the nine steps?",
    answer:
      "The nine steps are the nine areas of a business you work through with a client, three in each [pillar](/coach/support?tab=help&a=three-pillars). Each one moves the owner from a problem to a result.\n\nVision:\n\n1. Aligned Vision: from a foggy future to clear direction.\n2. Defined Strategy: from busy tactics to a deliberate strategy.\n3. Disciplined Planning: from endless to-dos to a 90-day rhythm.\n\nVelocity:\n\n4. Profit & Cash Flow: from tight cash to reliable margin.\n5. Revenue & Marketing: from feast or famine to predictable demand.\n6. Operations & Delivery: from owner-dependent to a business that runs without them.\n\nValue:\n\n7. Financials & Metrics: from gut feel to numbers they trust.\n8. Infrastructure & Systems: from daily heroics to repeatable systems.\n9. Team & Leadership: from doing it all to a team that runs the machine.\n\nThe tenth area, Owner Performance, is the foundation under all nine. The first letters of steps 4 to 9 spell PROFIT. Want the roadmap picture for your Session 1 slides? Ask in Support and we send it.",
    aliases: ["9 steps", "nine step roadmap", "roadmap", "9 areas", "categories", "profit acronym", "aligned vision"],
    sources: ["src/components/profitSystem/profitSystemData.ts", "src/lib/bossData.ts", "ticket 443"],
  },
  {
    id: "profit-scorecard-name",
    topic: "keep-clients",
    group: "profit-system",
    question: "Is the Profit Scorecard the same as the BOSS Score or BOSS Pro?",
    answer:
      "Profit Scorecard is an old name for the BOSS Score. You still see it in some older videos and materials.\n\nThere are two versions now:\n\n1. BOSS Score: 10 questions plus 3, for marketing. Prospects take it before a call.\n2. BOSS Pro: the full 50 questions, one for each box of the [Profit System](/coach/support?tab=help&a=profit-system) grid. You use it on a sales call or with a client for a deep check-up. It lives under Keep Clients.\n\nBOSS stands for Business Operating System Score.",
    aliases: ["profit scorecard", "scorecard vs boss pro", "old name"],
    sources: ["ticket 642"],
  },
  {
    id: "add-client",
    topic: "keep-clients",
    group: "clients",
    question: "How do I add a client?",
    answer:
      "1. In the left sidebar, click Keep Clients. You land on Clients.\n2. Click Add client.\n3. Paste their LinkedIn profile address and click Import. Or, under Or add them yourself, type their name, business, the date they joined and their price a month.\n4. Click Save client.\n\nGot several? Click Add many and paste them in as a table.\n\nClick a client's row to add more, like their sector, turnover, team size and the result you got them. That row also has Run BOSS Score and Coaching workspace. See [the coaching workspace](/coach/support?tab=help&a=coaching-workspace).",
    aliases: ["new client", "add a client", "import client", "add many clients", "client list"],
    sources: ["app"],
  },
  {
    id: "prospect-to-client",
    topic: "keep-clients",
    group: "clients",
    question: "A prospect has become a client. How do I move them across?",
    answer:
      "Well done. There is no button for this yet, so tell us in Support who it is and we move them across for you, with everything they've done so far.\n\nPlease don't add them again with Add client. The app sees the same LinkedIn profile and stops you, because they are already a prospect.\n\nMeanwhile, set their status on [Pipeline](/coach/prospects) to Won, so your numbers count them.",
    aliases: ["convert prospect to client", "won a client", "prospect became client", "already a prospect"],
    sources: ["app"],
  },
  {
    id: "coaching-workspace",
    topic: "keep-clients",
    group: "clients",
    question: "What's in a client's coaching workspace?",
    answer:
      "Open [Clients](/coach/clients), click the client, then Coaching workspace. It has these tabs:\n\n1. Overview: their details, the date of each session, and cards that open their BOSS Pro, their playbooks and your session notes.\n2. 3-Year Plan: their north star, the revenue and profit target for each year, and the focus for each quarter. Click Save plan.\n3. 90-Day: the actions for this quarter. Click Add action, give each one a week and a status, and see them as a List, a Board or a Timeline. Click Save.\n4. Notes: click Log session after each call, add a title and your notes, and click Save session.\n\nRevenue, Expenses and Team say Coming soon.\n\nYou build the 3-Year Plan in Session 3 and the 90-day plan in Session 4. See [your first four sessions](/coach/support?tab=help&a=first-four-sessions).",
    aliases: ["coaching workspace", "3 year plan", "90 day plan", "session notes", "log session", "client actions", "coaching sheet"],
    sources: ["app"],
  },
  {
    id: "client-login",
    topic: "keep-clients",
    group: "clients",
    question: "Can my client log in and see their plan?",
    answer:
      "Not yet. Clients don't have their own login. For now you can share two things with them:\n\n1. Their BOSS Pro results. See [share BOSS Pro results](/coach/support?tab=help&a=share-boss-pro).\n2. A playbook. See [use playbooks with a client](/coach/support?tab=help&a=playbooks-with-clients).\n\nWant to see what a client would see? In their coaching workspace, click View as client.",
    aliases: ["client portal", "client login", "client access", "can my client see"],
    sources: ["app"],
  },
  {
    id: "run-boss-pro",
    topic: "keep-clients",
    group: "boss-pro",
    question: "How do I run BOSS Pro with a client?",
    answer:
      "You go through it together, live, on a call or in person.\n\n1. In the left sidebar, click Keep Clients, then BOSS Score.\n2. In Select someone, pick your client. For someone new, choose Add new person, type their name, title and business, and click Start session.\n3. Go through the grid together. For each box, ask the question and click the answer they give. It saves as you go.\n4. At the end, look at the results with them: the BOSS wheel, the grid in red, amber and green, their owner level, and Insights.\n\nEach box links to its playbook, so you can pick the first two or three to work on together. They become the first actions in their [90-day plan](/coach/support?tab=help&a=coaching-workspace).\n\nPractise on yourself or a demo first. Choose Add new person or demo.",
    aliases: ["boss pro", "run boss pro", "50 questions", "boss grid with client", "score a client", "workshop"],
    sources: ["app"],
  },
  {
    id: "share-boss-pro",
    topic: "keep-clients",
    group: "boss-pro",
    question: "How do I send a client their BOSS Pro results?",
    answer:
      "1. Open Keep Clients, then [BOSS Score](/coach/boss-pro).\n2. Pick the client in Select someone.\n3. Open the session menu and click Share client link. It says Client link copied.\n4. Paste the link in an email or message to them.\n\nThe link opens their results page. They can look but not change anything. You need to have scored at least one session with them first.",
    aliases: ["share boss pro", "client link", "send boss pro results", "boss pro dashboard"],
    sources: ["app"],
  },
  {
    id: "playbooks-with-clients",
    topic: "keep-clients",
    group: "boss-pro",
    question: "How do I use the playbooks with a client?",
    answer:
      "There are 50 playbooks, one for each box of the [Profit System](/coach/support?tab=help&a=profit-system) grid. Each is a short guide to fixing one thing.\n\nTo find one, open Keep Clients, then [Playbooks](/coach/playbooks). Switch between Grid and List. To send one to a client, open it and copy the web address from your browser. The page shows your name.\n\nTo track a client's playbooks:\n\n1. Open the client's coaching workspace and click the Playbooks card on Overview.\n2. Set each playbook to Locked, In progress or Implemented.\n\nPick playbooks from the client's red and amber boxes in [BOSS Pro](/coach/support?tab=help&a=run-boss-pro), starting at the lowest level.",
    aliases: ["playbooks", "send a playbook", "playbook status", "implemented", "assign playbook"],
    sources: ["app"],
  },
  {
    id: "first-four-sessions",
    topic: "keep-clients",
    group: "coaching",
    question: "How do I run my first four sessions with a new client?",
    answer:
      "The Classroom has a lesson for each. Open the [Classroom](/coach/academy/classroom), go to Keep Clients, then Client Launch.\n\n1. How To Setup A New Client: what to do before the first call.\n2. Session 1, Profit Systems & Dashboard: explain the [Profit System](/coach/support?tab=help&a=profit-system) and run [BOSS Pro](/coach/support?tab=help&a=run-boss-pro) together.\n3. Session 2, Leverage & Critical Issues: find the few things holding the business back most.\n4. Session 3, Align The 3 Year Plan: agree where the business is going.\n5. Session 4, Ninety Day Plan: turn that into actions for the next 90 days.\n\nThe same part has How To Use The Coaching Sheet In Sessions, Start & End a Coaching Session, and Coaching Session FAQs for tricky moments.\n\nPractise each one first in the [Client simulator](/coach/simulator). Pick an AI client and choose Session 1, 2, 3 or 4.",
    aliases: ["first sessions", "onboard a client", "session 1", "onboarding", "client launch", "new client sessions"],
    sources: ["content/academy/classroom-hub.json"],
  },
  {
    id: "keep-clients-longer",
    topic: "keep-clients",
    group: "coaching",
    question: "How do I keep clients for longer?",
    answer:
      "Open the [Classroom](/coach/academy/classroom), go to Keep Clients, then Client Retention. It has eight short lessons on why clients stay or leave: Prevent Overwhelm, Remove Distraction, Ownership, Generate Belief, Results and Rewards, Exemplify, Sustainability and Self-Identity.\n\nFor help with the session itself, see Coaching Method in the same part of the Classroom.",
    aliases: ["retention", "clients leaving", "renew", "keep clients longer", "churn"],
    sources: ["content/academy/classroom-hub.json"],
  },
  {
    id: "tricky-coaching-moments",
    topic: "keep-clients",
    group: "coaching",
    question: "A client is stuck, in crisis or won't do the work. What do I do?",
    answer:
      "Open the [Classroom](/coach/academy/classroom), go to Keep Clients, Client Launch, then Coaching Session FAQs. Short videos cover:\n\n1. A client in crisis.\n2. A new priority that isn't in the plan.\n3. A client who doesn't want to grow.\n4. False or unsure answers.\n5. A client who won't use the cashflow tools.\n6. Low energy and commitment.\n\nTo practise one first, open the [Client simulator](/coach/simulator) and choose Tricky moments. Still stuck? Ask in Support or bring it to a group call.",
    aliases: ["client in crisis", "difficult client", "client won't do the work", "off plan", "low commitment"],
    sources: ["content/academy/classroom-hub.json"],
  },
  {
    id: "boss-vs-pro",
    topic: "keep-clients",
    group: "boss-pro",
    question: "What's the difference between the BOSS Score and BOSS Pro?",
    answer:
      "BOSS stands for Business Operating System Score. The BOSS Score is the short one: 10 questions plus 3, done in three minutes. It is your lead magnet, so prospects take it before a call.\n\nBOSS Pro is the full 50-question version you run with a client. It lives under Keep Clients at [BOSS Pro](/coach/boss-pro).",
    aliases: ["boss pro", "50 questions", "what does boss stand for"],
    sources: ["playbook", "SUP-609"],
  },
  {
    id: "use-client-simulator",
    topic: "keep-clients",
    group: "coaching",
    question: "How do I practise coaching with the client simulator?",
    answer:
      "1. In the left sidebar, click Keep Clients, then [Client simulator](/coach/simulator).\n2. Pick an AI client from the faces. Or click Create your own to describe a client like yours, or Surprise me.\n3. Choose what to practise: a Coaching session, one of Session 1 to 4, or Tricky moments.\n4. Choose Easy, Medium or Hard, and click Start.\n5. Talk out loud, as you would on a real call.\n\nAfterwards you get a score out of 50 and a report, with moments from the call and your one thing to do better next time. Your sessions are saved under Your sessions.\n\nYou get 240 practice minutes a month. They reset on the 1st.\n\nShow you can coach, on the same page, is three sessions with at least one on Hard. Average 30 out of 50 and a BCA coach reviews them.",
    aliases: ["client simulator", "practise coaching", "ai client", "coaching practice", "show you can coach", "practice minutes"],
    sources: ["app"],
  },
  {
    id: "where-simulator",
    topic: "keep-clients",
    group: "coaching",
    question: "Where are the client simulator and the call simulator?",
    answer:
      "There are two. The [Client simulator](/coach/simulator) is under Keep Clients. You practise coaching conversations out loud with AI clients, then get a score and a report.\n\n[Call Practice](/coach/script/simulator) is for sales calls. Open Win Clients, then Call Practice. You talk to AI owners, from a cold call to the close. It comes with Get Calls and Win Clients.\n\nOld links on theprofitcoach.com or academy.businesscoachacademy.com no longer work. Use these instead.",
    aliases: ["client simulator", "call simulator", "practice calls", "ai coaching practice", "role play", "simulator link broken"],
    sources: ["ticket 14 Jul (I cannot find a link to the client simulators)", "ticket 5 Nov (Scorecard not filling in)", "app"],
  },
  // account-money
  {
    id: "login-email",
    topic: "account-money",
    question: "Which email is my login, and can I change it?",
    answer:
      "Open [Settings](/coach/settings) and look at Profile. The email shown there is your login.\n\nOne email is simplest. If you want to switch to a different address, tell us in Support and we change it the same day. You log in with the new address from then on.",
    aliases: ["change my email address", "which email am I registered with"],
    sources: ["SUP-602", "SUP-609"],
  },
  {
    id: "forgot-password",
    topic: "account-money",
    fix: true,
    question: "I can't log in. What do I do?",
    answer:
      "Go to [theprofitcoach.com/login](https://theprofitcoach.com/login) and click Reset password. The email lasts an hour, so check spam if it has not arrived in a minute.\n\nIf no email comes, message Support and we reset it for you. We never send a password in a message.",
    aliases: ["password reset", "credentials don't work", "locked out"],
    sources: ["SUP-559", "SUP-551"],
  },
  {
    id: "membership-cost",
    topic: "account-money",
    question: "What does membership cost after my payment plan ends?",
    answer:
      "Advisor OS is £495 a month. It runs your whole coaching business: this app, Ava, your campaigns, the training and the community, all kept switched on once your programme is paid off.\n\nTo pay:\n\n1. Open [Settings, Billing](/coach/settings?tab=billing).\n2. Under Change plan, find the £495 a month plan and click Restart plan (or Switch plan).\n3. Enter your card and pay.\n\nWant us working closely with you on your systems as well? That is VIP, at £1,995 a month. Ask in Support and we tell you more.",
    aliases: ["cost model", "how much is membership", "monthly fee", "after six months", "premium plan price", "advisor os", "vip", "what do I pay"],
    sources: ["ticket 24 Sep (Inquiry: cost model)", "ticket 4 Nov (Monthly payments)", "ticket 20 Oct (Billing clarification)", "src/config/membershipPlans.ts"],
  },
  {
    id: "restart-membership",
    topic: "account-money",
    question: "How do I restart or change my membership?",
    answer:
      "Open [Settings, Billing](/coach/settings?tab=billing). Under Change plan, click Restart plan or Switch plan on the plan you want.\n\nIf you have been given a code, click Add promotion code on the payment page and type it before you pay. If anything looks wrong, ask in Support before paying and we check it.",
    aliases: ["premium plan", "cancelled plan", "promotion code", "membership link"],
    sources: ["SUP-571", "SUP-549"],
  },
  {
    id: "find-invoices",
    topic: "account-money",
    question: "Where are my invoices?",
    answer:
      "1. Open [Settings, Billing](/coach/settings?tab=billing).\n2. Scroll to Payments and invoices. Every payment is listed there.\n3. Click Invoice next to the payment you want. It downloads.\n\nTo put your business name, address, company number or VAT number on them, find the line that starts Made out to, just under Payments and invoices, and click Add details (or Change). Download the invoice again and the details are on it.",
    aliases: ["invoice", "receipt", "accountant needs invoices", "vat number on invoice"],
    sources: ["SUP-595", "SUP-610", "playbook"],
  },
  {
    id: "ask-for-invoice",
    topic: "account-money",
    question: "A payment says \"Ask for invoice\". What does that mean?",
    answer:
      "That payment went through a separate account, so we make the invoice by hand. Click it, or message Support with the date and amount, and we send it within a day.",
    aliases: ["missing invoice", "buy-in invoice"],
    sources: ["SUP-610", "playbook"],
  },
  {
    id: "no-vat",
    topic: "account-money",
    question: "Why is there no VAT on my invoice?",
    answer:
      "Business Coach Academy Limited is our UK payment company and is below the VAT registration threshold, so no VAT is charged. Your invoice is still a valid invoice for your accounts.",
    aliases: ["vat", "tax on invoice"],
    sources: ["playbook"],
  },
  {
    id: "payment-plan-finished",
    topic: "account-money",
    question: "Has my payment plan finished, and how much have I paid in total?",
    answer:
      "1. Open [Settings, Billing](/coach/settings?tab=billing).\n2. Look at Payments and invoices. It lists every payment with its date and amount, so you can count them and add them up.\n\nIf you want it confirmed in writing, ask in Support and we send the total and the dates.",
    aliases: ["monthly payments finished", "how much have I paid", "plan complete"],
    sources: ["SUP-598", "SUP-571"],
  },
  {
    id: "payment-bounced",
    topic: "account-money",
    fix: true,
    question: "A payment bounced or I need to pay late. What should I do?",
    answer:
      "Tell us in Support before the next attempt. We agree a date with you and stop the reminders. Things come up, and a message saves everyone a chase.",
    aliases: ["payment failed", "pay late", "direct debit bounced"],
    sources: ["SUP-542", "SUP-545"],
  },
  {
    id: "referral-fees",
    topic: "account-money",
    question: "How do referral fees work?",
    answer:
      "You earn £1,000 for anyone you refer who joins BCA.\n\nWe pay it as they pay us: 10% of each payment they make, until you have had £1,000. So if they pay in four payments of £2,500, you get £250 each time. If they pay in full, you get the £1,000 in one go.\n\n1. Tell us their name in Support before they join, so it's logged against you.\n2. We tell you when they join.\n3. Each time they pay, we pay you your share. You can take it off your own monthly fee instead, if you prefer.",
    aliases: ["referral fee", "refer a coach", "commission", "offset against my fee", "referral payment", "£1000", "refer a friend"],
    sources: ["ticket 12 Oct (Fwd: Debit initiated by Stripe)", "ticket 9 Nov (Scorecard referral)"],
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
