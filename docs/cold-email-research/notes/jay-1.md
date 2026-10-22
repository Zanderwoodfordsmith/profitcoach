# Lead Gen Jay, Cold Email Course 2026, part 1 of 3 (00:00 to 02:28)

Scope note: part 1 is mostly the three pillars, technical setup, the sending tool (Instantly), and deliverability. Copy, offers, list building and sequences are only touched on here; they come in parts 2 and 3.

## 1. Core principles
- Three pillars, built bottom up: (1) technical infrastructure, (2) list, (3) offer and copy. If the base is weak, nothing above it matters. When it isn't working, fix the weakest pillar first [00:19:00, 00:26:00 to 00:28:00].
- "Cold email does not work for 6 out of 10 people", but with trial and error any business can make it work within 60 days [00:20:01].
- Relevance stops spam complaints: "relevant offers to relevant people". An irrelevant email gets reported, and complaints are what kill reputation [00:21:01 to 00:22:01, 01:56:01].
- Get the basics right before the fancy stuff. His best campaigns don't use AI personalisation or AI videos: "Fundamentals beats AI fancy stuff every time" [00:23:01 to 00:24:00].
- Don't take shortcuts or cut costs on tools, data or mailboxes. Cheap setups end up in spam (the story of his friend Jesse) [00:17:01, 00:25:01].
- Don't trust AI to write your cold emails or build your list [01:30:01, 01:48:00].
- Treat the main business domain as "sacred". Never cold email from it, because a blacklist would hit the whole company [00:33:02].
- Cold leads live in the cold email tool. They only move into the main CRM once they opt in, book or reply [00:10:00 to 00:11:00].

## 2. Campaign structure
- Sending tools run sequences like "send, wait two days, send, wait two days" with A/B variations [01:22:00]. The detailed sequence is not covered in part 1.
- One campaign per offer or audience (e.g. agencies vs doctors vs lawyers). That way the same copy can be tested across industries. One to three campaigns is enough [01:36:00].
- Settings: stop on reply ON. "Prioritise new leads" is only for very large markets [01:39:00, 01:41:01].
- Pick test winners on **positive reply rate**, not reply rate. A 10% reply rate made up of negative replies loses to a 5% rate that is all positive [01:42:00].
- Company reply stop (stop emailing the rest of a firm once one person replies) is "not a bad idea". He skips it because he only emails decision makers [01:42:00].
- Send on weekdays, in business hours [01:39:00].
- Subsequences: when a reply contains a trigger word (e.g. ask them to "reply 'media coverage'"), the lead gets an automatic follow-up. He calls this a beginner-friendly way to automate replies [01:43:00].
- Not now? Move the lead into a "follow up in 30 days" campaign [01:45:00].

## 3. Copy (light in part 1)
- No links, no tracking, no images in cold email. Send as plain text only [00:46:00, 01:39:00].
- No unsubscribe links and no opt-out wording. He says they hurt deliverability [01:43:00, 02:11:00].
- Shorter copy gets through better [02:11:00].
- Use spintax so the same phrases aren't sent over and over [01:58:00].
- Promotions tab "may as well be spam". It is usually a copy issue: change the words and test again [02:02:00 to 02:03:00].
- His Glock Apps test email said just "cold email services" and Google put it in spam. Spam-trigger phrases matter [02:24:00].
- Sender name: use the founder's name. Failing that, an easy one-syllable name ("Ruth", "Jen") converts best [01:13:01].
- Put the signature at mailbox level and insert it with a placeholder [01:33:01].

## 4. Targeting and lists (light in part 1)
- A bad list means wrong industry, wrong job title, wrong company size, retired people, invalid emails, or people without the problem [00:27:01 to 00:28:00].
- Pull leads fresh. Emails go stale as people change jobs, so a list cleaned 3 months ago will bounce. Don't buy big old lists and leave them running [02:15:01].
- Avoid catch-all, risky and unknown addresses unless a tool verifies them [02:16:01].
- Keep a block list (a public Google Sheet with one column of emails) of existing clients, suppliers and competitors. Add new clients as they sign [01:52:01].
- Turn on the tool's "skip hostile prospects" and risky-email (bounce protect) filtering [01:43:00, 01:52:01].
- Instantly AI prompts can enrich each lead with a personalisation column (e.g. "find competitor") [01:38:00].

## 5. Deliverability and infrastructure
- Ranked by importance: IP address (sending server), then domain, then mailbox. Each has its own reputation [00:30:01 to 00:32:01].
- Use Google Workspace mailboxes (best inbox placement, about 87.2%). Microsoft is about 75.6%. "Provider matching" doesn't help, and Google even reaches Microsoft inboxes better [01:03:00 to 01:05:02].
- Small and mid-sized firms mostly use Google; enterprises mostly use Microsoft [01:04:01].
- Long term, spread across 3 providers to hedge, but start on Google [01:12:00].
- Cheap SMTP (under about $2 per mailbox, or "unlimited" on 1 dedicated IP, e.g. Inframail or Mailin) is fragile. One burnt IP kills every domain and mailbox on it. Only for experts, and only alongside Google [01:06:00 to 01:10:01].
- Buy .com lookalike domains with a prefix or suffix (e.g. get-/my- + brand). Spaceship costs $8.88 to buy and about $10 a year to renew [00:40:02 to 00:42:00].
- Redirect the secondary domains to the real website. Domain masking proxies add nothing [00:43:02, 00:48:00].
- DNS: SPF, DKIM and DMARC (quarantine or reject, failure reports off), MX records, plus a custom tracking domain CNAME [00:54:01 to 00:58:00].
- Domain age: wait 30 days minimum, ideally 60 to 90, before sending. Warm up from day one [00:36:01].
- **5 mailboxes per domain. About 100 emails a day per domain, so about 20 a day per mailbox.** 50 a day is the ceiling. Fewer is safer [01:14:01 to 01:15:00].
- Mailbox settings: about 10 sends a day each, 5+ minute gaps, campaign slow ramp ON, daily inbox placement tests [01:34:01].
- Warm-up: raise by 1 to 2 a day up to the campaign daily limit. Reply rate 30 to 100%. All advanced options on. **Leave warm-up on for good**, because it dilutes spam complaints (1 complaint in 100 sends = 1%; with 100 warm-ups added, the rate halves) [01:34:01, 01:57:01, 02:05:01, 02:07:00].
- Never forward mailboxes to a central inbox. A reply from a new mailbox looks like a fresh cold email. Reply from inside the sending tool [01:15:00 to 01:18:00].
- Automations: below 50% inbox placement, pause for 14 days. On a blacklist, pause for 30 days. Back above 70%, slow-ramp back in [01:48:00, 02:19:01].
- Troubleshooting order: DNS check, domain blacklist check, then domain age, copy and reputation. The fix is always the same: pull the whole domain out of campaigns, warm up only, send fewer cold emails, wait 4 to 8 weeks [02:08:01 to 02:16:01, 02:28:01].
- Auto-pause campaigns that bounce a lot, because a high bounce rate means the list is bad [01:51:00].
- Judge with inbox placement tests, not the health score (that only reflects warm-up emails) [01:35:00, 02:18:00].
- Being 0% at Google is a crisis. Being 0% at Zoho or Proton is not [02:27:00].

## 6. Numbers and benchmarks
- Under $100 a month to start: tool from $37 a month, leads about $50 per 10k, mailboxes about $3 each through a reseller (Google retail is $8.40) [00:15:01 to 00:16:00, 01:02:02].
- Inbox placement: Google 87.2%, Microsoft 75.6% [01:03:00, 01:05:02]. He inboxes almost 100% with aged, warmed Google mailboxes [01:06:00].
- Starter fleet: 25 to 50 mailboxes at 5 per domain [01:20:00].
- Spam rate: 1% is "not good" [01:57:01].
- Without open tracking, low reply rate is the sign you are landing in spam (under 40% opens used to be the rule) [02:17:00].
- His operation generates 4,500+ leads a day [00:01:01].

## 7. Mistakes to watch for
- Using the main domain; cheap lifetime deals (AppSumo, Lead Rocks); Apollo as a sending tool; unmanaged-IP mailboxes as your only setup [00:33:02, 01:27:00, 01:31:02].
- Instantly's or Smartlead's own done-for-you mailboxes lock you into their system [01:19:01].
- Mailbox forwarding; tracking links; sending before domains are 30 days old; ramping volume too fast [01:15:00, 00:46:00].
- Trusting the health score; panicking when replies are zero without running a placement test [02:17:00].
- Treating every bounce as a bad address. Spam content or blacklists also cause bounces [02:14:01].

## 8. Small changes with big effect
- Choose winners on positive reply rate [01:42:00].
- Use the "Test domain setup" button before you go live [01:36:00].
- Set limits at mailbox level and include every mailbox in every campaign [01:39:00].
- Turn on "skip hostile prospects"; it also helps team morale [01:53:00].
- Use snippets and macros (# key), AI-suggested replies and mobile push alerts for speed to lead [01:29:00, 01:45:00].

## 9. Tools
Instantly (sending, warm-up, inbox placement, Unibox, CRM, block list; $97 plan for advanced warm-up); Smartlead and Reach Inbox (alternatives); Spaceship (domains); Google Workspace / Microsoft 365; Mailin and Inframail (cheap SMTP); Mission Inbox and Mailforge-type managed SMTP ("Meldoso"); EasyDMARC and MX Toolbox (DNS and blacklist checks); Glock Apps (placement tests, 2 free a month); EmailGuard (cheap placement tests, masking proxies); Warmy.io (warm-up for the main domain only); Google Postmaster (domain reputation); MillionVerifier (verification); Clay (advanced); Zapier/n8n (automations).

## 10. UK/GDPR/PECR, free calls, service businesses
- No UK, GDPR or PECR content in part 1. He only says cold email "is completely legal" from a US viewpoint [00:10:00].
- **Watch out:** his "no unsubscribe link, no opt-out wording" advice clashes with UK rules (PECR and GDPR legitimate interest expect a clear sender and an easy way to object). A UK campaign should keep a plain-text opt-out line, such as "reply 'no' and I won't email again", rather than a link. This is my note, not his.
- Service and consulting firms are a core fit for cold email: B2B, high-ticket, and you can target owners by industry and title [00:12:00 to 00:13:01].
- Speed to lead and an "interested to booked call" pipeline in the CRM matter for call-booking offers [01:45:00 to 01:46:01].
