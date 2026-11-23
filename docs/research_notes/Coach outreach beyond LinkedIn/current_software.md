# Current outreach software: how the Profit Coach app uses Unipile, and what non-LinkedIn channels would need

Read-only code review, 21 Nov 2026. All paths are relative to the repo root `/Users/zander/Coding/profit-coach-app`. Line numbers are from the working tree on 21 Nov. Nothing was run against Unipile, Apify or the database, so runtime behaviour (whether a code path has ever fired in production) is not confirmed. Note: migration filenames are dated ahead of their commits (e.g. `20261220120000_campaign_instagram_messenger.sql` was committed on 14 Sep 2026 per `git log`), so do not read migration names as ship dates.

**Headline:** the app is much further along than "LinkedIn only". Unipile hosted auth already connects LinkedIn, WhatsApp, Instagram, Messenger, Gmail and Outlook; the campaign engine already has WhatsApp, email, Instagram (DM, like, comment, follow) and Messenger step types; the inbox already syncs and replies on all of them, including voice notes; and Google Maps / Google Search prospect import via Apify is built, coach-facing and wired into Ava. The gaps are in the joins: Instagram/Facebook-only prospects can't be enrolled in a campaign, replies on non-LinkedIn campaign chats probably don't stop the sequence, voice notes only work on LinkedIn campaign steps, pacing is LinkedIn-shaped, cold email has no deliverability layer, and Ava's planner only drafts Sales Navigator lists and LinkedIn connection campaigns.

## 1. Where is the Unipile client code, and which endpoints are called?

### Takeaway
One hand-written fetch wrapper, `src/lib/unipile/client.ts` (1,146 lines), covers every Unipile call; about 75 modules in `src/lib/unipile/` build on it. It calls accounts, hosted auth, users (profile, invite, follow, relations, sent/received invites), LinkedIn search, chats, messages (incl. voice/video multipart), attendees, posts/comments/reactions, emails (list/get/send/attachments), webhooks and sync endpoints. The only search endpoint called is `/api/v1/linkedin/search`.

### Cited Findings
- Base wrapper `unipileFetch` (JSON) and a multipart variant; config check `isUnipileConfigured` reads UNIPILE_DSN / UNIPILE_API_KEY — [src/lib/unipile/client.ts:17-41, 121-245](src/lib/unipile/client.ts); error message at [src/lib/unipile/hostedAuth.ts:77](src/lib/unipile/hostedAuth.ts).
- Accounts: `listUnipileAccounts` GET `/api/v1/accounts` (L246-251), `getUnipileAccount` GET `/api/v1/accounts/{id}` (L253-258), `deleteUnipileAccount` DELETE (L507-511), `syncUnipileAccountMessaging` GET `/accounts/{id}/sync` (L790-795) — [client.ts](src/lib/unipile/client.ts).
- Hosted auth: `createHostedAuthLink` POST `/api/v1/hosted/accounts/link`; body defaults `providers` to `["LINKEDIN"]` when the caller passes none — [client.ts:260-299, line 280](src/lib/unipile/client.ts).
- Users: `resolveUnipileUser` GET `/api/v1/users/{identifier}` (optional `notify=true` = LinkedIn profile visit) (L301-312); `followUnipileUser` POST `/users/follow` (L314-326); `sendUnipileInvitation` POST `/users/invite`, note truncated to 300 chars (L328-342); `listSentInvitations` / `cancelSentInvitation` `/users/invite/sent` (L533-567); `getUnipileOwnProfile` `/users/me` (L569-572); `listReceivedInvitations` (L575-590); `listUnipileRelations` `/users/relations` (L610-628); `listUnipileUserPosts` `/users/{id}/posts` (L797-818) — [client.ts](src/lib/unipile/client.ts).
- Chats/messages: `startUnipileChat` POST `/api/v1/chats` with optional `linkedin: { inmail: true }` (L344-361); `sendUnipileChatMessage` POST `/chats/{id}/messages`, switches to multipart with `attachments`, `voice_message`, `video_message` (L363-423); `listUnipileChats` (L425-449); `listUnipileAttendees` `/chat_attendees` (L451-466); `listUnipileChatAttendees` (L468-483); `listUnipileChatMessages` (L485-505); message reaction/edit/delete `/messages/{id}` (L736-759); `syncUnipileChatHistory` `/chats/{id}/sync` (L783-788); `downloadUnipileMessageAttachment` `/messages/{id}/attachments/{aid}` (L1105-1115) — [client.ts](src/lib/unipile/client.ts).
- Posts: `createUnipilePost` POST `/api/v1/posts`, get post, list comments/reactions, comment, react (L630-735) — [client.ts](src/lib/unipile/client.ts).
- Search: `unipileLinkedInSearchRequest` / `linkedInSearch` POST `/api/v1/linkedin/search` (Sales Nav URL or cursor, 45 s timeout) (L823-895); `fetchOwnLinkedInSsi` POST `/api/v1/linkedin` with a fixed SSI URL (L897-917) — [client.ts](src/lib/unipile/client.ts).
- Email: `listUnipileEmails` GET `/api/v1/emails` (L919-948), update/delete/get email (L950-1015), `downloadUnipileEmailAttachment` (L1087-1103), `sendUnipileEmail` POST `/api/v1/emails` multipart with `to`, `subject`, `reply_to`, `custom_headers`, attachments (L1117-1146) — [client.ts](src/lib/unipile/client.ts).
- Webhooks: `listUnipileWebhooks`, `createUnipileWebhook`, `deleteUnipileWebhook` (L761-781) — [client.ts](src/lib/unipile/client.ts). Registered specs: `message_received`, `message_reaction`, `message_read` (source messaging), `new_relation` (users), account_status events, `mail_received`/`mail_sent` (email) — [src/lib/unipile/webhooks.ts:17-24, 80-136](src/lib/unipile/webhooks.ts). Inbound routes: [src/app/api/unipile/webhooks/route.ts](src/app/api/unipile/webhooks/route.ts) and [src/app/api/unipile/notify/route.ts](src/app/api/unipile/notify/route.ts).
- Calendar via Unipile also exists (booking busy times) — [src/lib/unipile/calendars.ts](src/lib/unipile/calendars.ts), [src/lib/booking/unipileCalendar.ts](src/lib/booking/unipileCalendar.ts).
- Sales Nav pool import calls `linkedInSearch` from a Unipile import job — [src/lib/unipile/salesNavImportJob.ts:382](src/lib/unipile/salesNavImportJob.ts); entry point `createUnipileSalesNavImportJob` used by [src/lib/salesNavigator/startImport.ts:18](src/lib/salesNavigator/startImport.ts).
- Main consumer modules: send worker [src/lib/unipile/worker.ts](src/lib/unipile/worker.ts) (1,240 lines), campaigns CRUD/enrolment [src/lib/unipile/campaigns.ts](src/lib/unipile/campaigns.ts) (2,137), inbox sync/reply [src/lib/unipile/inboxSync.ts](src/lib/unipile/inboxSync.ts) (2,343), webhook handlers [src/lib/unipile/webhookHandlers.ts](src/lib/unipile/webhookHandlers.ts) (815), non-LinkedIn sends [src/lib/unipile/channelOutreach.ts](src/lib/unipile/channelOutreach.ts) (519).

### Inferences
- The client is already provider-neutral for chats, messages and voice/video media: nothing in `sendUnipileChatMessage` is LinkedIn-specific, so Instagram, Messenger and WhatsApp voice notes need no new client code.
- There is no Unipile call that discovers new Instagram/Facebook/WhatsApp people. Prospect discovery for those channels has to come from somewhere else (Apify, Google Maps, CSV).

### Gaps
- Whether Unipile supports Instagram/Messenger search or cold voice notes on each provider is an external question, not answerable from the code (other researchers cover it).

## 2. How are coach accounts connected, which providers are allowed, and where are account ids stored?

### Takeaway
Coaches connect through Unipile hosted auth, one provider per link. Six providers are allowed (LINKEDIN, WHATSAPP, INSTAGRAM, MESSENGER, GOOGLE, OUTLOOK) and Settings shows all six to coaches. Every coach-owned Unipile account, whatever the provider, lives in the badly named `linkedin_outreach_accounts` table. LinkedIn is the hard-coded default in only a few fallback spots.

### Cited Findings
- Allowed providers constant: `UNIPILE_CONNECT_PROVIDERS = ["LINKEDIN","WHATSAPP","INSTAGRAM","MESSENGER","GOOGLE","OUTLOOK"]`; app channels `linkedin | whatsapp | instagram | messenger | email` — [src/lib/unipile/providers.ts:6-24](src/lib/unipile/providers.ts).
- `providerToAppChannel` falls back to `"linkedin"` for unknown providers — [providers.ts:70-88](src/lib/unipile/providers.ts).
- `createProviderConnectLink(coachId, request, provider)` validates the provider, builds a 1-hour hosted link with `providers: [provider]`, `name: coachId`, `notify_url: /api/unipile/notify`, and adds Google/Microsoft mail+calendar scopes for GOOGLE/OUTLOOK — [src/lib/unipile/hostedAuth.ts:67-149](src/lib/unipile/hostedAuth.ts); scopes include `gmail.send` and `Mail.Send` — [src/lib/unipile/hostedAuthScopes.ts:15-45](src/lib/unipile/hostedAuthScopes.ts).
- Deprecated `createLinkedInConnectLink` hard-codes LINKEDIN and returns to Campaigns — [hostedAuth.ts:151-159](src/lib/unipile/hostedAuth.ts).
- Coach connect API accepts any of the six — [src/app/api/coach/integrations/accounts/route.ts:98-123](src/app/api/coach/integrations/accounts/route.ts).
- Settings UI groups: "Email and calendars" (Google, Outlook) and "Social media" (LinkedIn, WhatsApp, Instagram, Messenger) with the text "LinkedIn, Instagram, and Messenger also power Campaigns" — [src/components/settings/IntegrationsSettingsTab.tsx:78-110](src/components/settings/IntegrationsSettingsTab.tsx). Instagram connect tip warns about Instagram's sign-in blocks — [src/lib/unipile/connectHelp.ts:8-14](src/lib/unipile/connectHelp.ts).
- A coach's Instagram connect has already hit Instagram's "too many attempts" block; the fix was advice text, not a retry change — [docs/overnight-2026-10-23-morning-review.md:26, 50](docs/overnight-2026-10-23-morning-review.md).
- Storage: `linkedin_outreach_accounts (coach_id, unipile_account_id, provider default 'LINKEDIN', status, display_name, raw jsonb, last_synced_at)` — [supabase/migrations/20261102120000_linkedin_outreach_campaigns.sql:27-40](supabase/migrations/20261102120000_linkedin_outreach_campaigns.sql); a Unipile account id can belong to only one coach (unique index) — [supabase/migrations/20261230120000_unipile_account_unique_coach.sql:20-21](supabase/migrations/20261230120000_unipile_account_unique_coach.sql).
- LinkedIn pacing columns sit on the same table: `weekly_invite_target`, `daily_message_target`, `daily_react_target`, delays, `send_rules`, `warmup_started_at`, `invite_paused_until`, `rate_limited_until`, `daily_send_plan` — [supabase/migrations/20261222120000_linkedin_account_send_safety.sql](supabase/migrations/20261222120000_linkedin_account_send_safety.sql).
- Notify webhook upserts the account with whatever provider Unipile reports, defaulting to LINKEDIN if none — [src/lib/unipile/outreachAccounts.ts:265-312, line 293](src/lib/unipile/outreachAccounts.ts). The notify route also routes `platform-alerts`, support WhatsApp and support mailbox connects to platform tables — [src/app/api/unipile/notify/route.ts:17-89](src/app/api/unipile/notify/route.ts).
- Which account sends on a channel: `firstAccountIdForChannel` picks the first OK account whose provider maps to that channel (any Gmail/Outlook/IMAP for email) — [src/lib/messaging/startConversation.ts:137-155](src/lib/messaging/startConversation.ts).
- Platform-level (non-coach) Unipile accounts: `platform_unipile_accounts` (support mailbox; later also "alerts") — [supabase/migrations/20261115120000_support_mailbox_unipile.sql:4-18](supabase/migrations/20261115120000_support_mailbox_unipile.sql), [src/lib/ava/alertsWhatsApp.ts](src/lib/ava/alertsWhatsApp.ts); admins' own WhatsApp lines in `support_whatsapp_lines` — [supabase/migrations/20271118120000_support_whatsapp_lines.sql:6-16](supabase/migrations/20271118120000_support_whatsapp_lines.sql).
- Other files with a literal `"LINKEDIN"` check (setup bars, coach health, launch readiness, campaign editor) — e.g. [src/components/layout/CoachSetupBar.tsx](src/components/layout/CoachSetupBar.tsx), [src/lib/gettingLive.ts](src/lib/gettingLive.ts), [src/lib/coachHealth.ts](src/lib/coachHealth.ts), [src/lib/unipile/linkedinSetupState.ts](src/lib/unipile/linkedinSetupState.ts).

### Inferences
- No schema change is needed to connect more channels; the gap is that "is this coach set up?" checks (setup bar, health, getting live) are LinkedIn-centric, so a coach running on Instagram or email would look "not ready".
- `firstAccountIdForChannel` means one sending account per channel; there is no mailbox rotation for email or multiple Instagram accounts.

### Gaps
- Not checked: whether Settings gates any provider by access level (job 257 access levels) at runtime.

## 3. Prospect data model: which tables, which columns are LinkedIn-specific, and could Instagram/Facebook/Maps/Companies House prospects fit?

### Takeaway
Three layers: the pool/lists (`coach_lead_lists` + `coach_lead_list_items`), the CRM (`contacts`, where `type='prospect'`), and campaign enrolments (`linkedin_campaign_leads`). Google Maps and Google Search rows already fit the pool (place_id, website, phone, email). Instagram/Facebook URLs exist as columns on `contacts` but not on list items, where Maps-scraped Instagram/Facebook links are buried in `raw` jsonb. Nothing in the app writes `contacts.instagram_url` / `facebook_url`. There is no Companies House integration.

### Cited Findings
- Lists: `coach_lead_lists (coach_id, name, source, icp_id, item_count, filters)` and `coach_lead_list_items (list_id, source, full_name, first/last, job_title, company, linkedin_url, email, phone, team_size, revenue_range, industry, match_reason, raw jsonb)` — [supabase/migrations/20260922120000_first_campaign_setup.sql:100-139](supabase/migrations/20260922120000_first_campaign_setup.sql). Later columns: `contact_id, identity_key, linkedin_premium, location, open_profile, place_id, source_rank, tags, website` (grep of `alter table coach_lead_list_items` across migrations).
- Allowed list-item sources: `lead_finder, connections, sales_nav_csv, sales_nav, manual, search, google_maps, google_search` (check constraint) — [supabase/migrations/20261228120000_google_maps_list_source.sql:7-19](supabase/migrations/20261228120000_google_maps_list_source.sql).
- Pool dedupe key order: `li:` LinkedIn URL, then `g:` Google Place ID, then `em:` email, then `ph:` phone — no Instagram/Facebook key — [src/lib/pool/identity.ts:67-80](src/lib/pool/identity.ts); unique `(list_id, identity_key)` — [supabase/migrations/20261219120000_google_maps_pool.sql:6, 31-33](supabase/migrations/20261219120000_google_maps_pool.sql).
- Google Maps rows map to the pool with `source: "google_maps"`, company, phone, email, website, place_id; Instagram and Facebook links go only into `raw.google_maps.instagrams / facebooks` — [src/lib/googleMaps/flushPlacesToPool.ts:25-54](src/lib/googleMaps/flushPlacesToPool.ts); scraper output fields `instagrams`, `facebooks` — [src/lib/googleMaps/mapPlaceToPool.ts:24-30, 156-173](src/lib/googleMaps/mapPlaceToPool.ts).
- CSV/manual pool input accepts company, linkedin_url, email, phone, website — no Instagram/Facebook — [src/lib/pool/mapPoolPeopleInput.ts:52-56](src/lib/pool/mapPoolPeopleInput.ts).
- `contacts` (the CRM; created before the migrations folder) has LinkedIn columns `linkedin_url`, `linkedin_provider_id` (unique per coach), `headline`, `photo_url`, plus `phone`, `whatsapp_on`, `whatsapp_checked_at`, `whatsapp_checked_phone`, `prospect_source`, `prospect_status`, `prospect_tags`, `company_website` (grep of `alter table contacts`); provider id bridge — [supabase/migrations/20261110120000_linkedin_provider_id_bridge.sql:4-26](supabase/migrations/20261110120000_linkedin_provider_id_bridge.sql); WhatsApp cache — [supabase/migrations/20261109140000_contacts_whatsapp_on.sql:4-20](supabase/migrations/20261109140000_contacts_whatsapp_on.sql).
- `contacts.instagram_url` and `contacts.facebook_url` were added for Unipile DMs/likes/comments/follows — [supabase/migrations/20261220120000_campaign_instagram_messenger.sql:29-37](supabase/migrations/20261220120000_campaign_instagram_messenger.sql). Only four files reference `instagram_url` (socialUrls, campaigns, channelOutreach, startConversation) and all of them read it; no UI, import or webhook writes it (grep of `src/`).
- `prospect_source` kinds: boss_score, boss_pro, sales_navigator, linkedin, bca, manual (+ ghl, linkedin_campaign); pool import sources include google_maps and google_search — [src/lib/prospectSourceKind.ts:2-37](src/lib/prospectSourceKind.ts).
- Campaign enrolment table `linkedin_campaign_leads` has LinkedIn-shaped columns `linkedin_url`, `linkedin_provider_id`, `invitation_id`, statuses `invited/connected`, unique `(campaign_id, linkedin_url)`; channel details for other channels go into `metadata` jsonb (email, phone, instagram_url, facebook_url, *_chat_id) — [supabase/migrations/20261102120000_linkedin_outreach_campaigns.sql:84-119](supabase/migrations/20261102120000_linkedin_outreach_campaigns.sql), [src/lib/unipile/campaigns.ts:1044-1053, 1155-1163](src/lib/unipile/campaigns.ts).
- Other prospect sources: LeadRocks cache `leadrocks_leads` and admin Lead Finder — [docs/lead-finder.md:1-48](docs/lead-finder.md); Sales Nav import runs `sales_nav_import_runs`; Maps/Search runs `google_maps_import_runs`, `google_search_import_runs` (table list from migrations).
- Companies House: the only mention in code is a sales-call review prompt line ("Look up the business: website, LinkedIn, Companies House") — [src/lib/salesCall/library/review.ts:34](src/lib/salesCall/library/review.ts). No API client, table or import.

### Inferences
- A Google Maps or Google Search business fits today without schema changes (already shipping).
- An Instagram or Facebook prospect *partly* fits: name/company/website/phone/email fit list items; the profile URL would sit in `raw` (which `socialUrlsFromUnknown` already reads — see section 4), but it can't be deduped on, filtered on, shown or edited. A small migration (add `instagram_url`, `facebook_url` to `coach_lead_list_items`, new `ig:`/`fb:` identity keys, new source values in the two check constraints) would make them first-class.
- A Companies House prospect (company number, registered address, directors, SIC code, incorporation date) fits loosely: director name → full_name, company → company, SIC → industry; company number and SIC would need `raw` or new columns. No contact channel comes from Companies House itself, so it would feed postal/email/LinkedIn lookups rather than DMs.

### Gaps
- The base `contacts` DDL is not in the migrations folder, so its original columns (e.g. `email`, `full_name`, `type`) were inferred from code usage, not read from DDL.

## 4. Campaign engine: tables, step types, channel choice, limits; channel-agnostic or LinkedIn-shaped?

### Takeaway
The engine is a generic sequence runner with LinkedIn names and LinkedIn-shaped safety rules. Tables: `linkedin_campaigns`, `linkedin_campaign_steps`, `linkedin_campaign_leads`, `linkedin_send_jobs`; one worker on a 5-minute cron. Step types already include email, WhatsApp, Instagram (DM/like/comment/follow) and Messenger. But the campaign-level `channel` only allows linkedin/email/whatsapp, enrolment requires a LinkedIn URL unless the channel is email or WhatsApp, voice/video media only work on LinkedIn `message` steps, and Instagram/Messenger sends count against the LinkedIn account's quotas while email/WhatsApp have no daily quota at all.

### Cited Findings
- Core tables and original step types `invite | message | wait`, daily invite limit, min delay, quiet hours, stop_on_reply, `linkedin_send_jobs` queue — [supabase/migrations/20261102120000_linkedin_outreach_campaigns.sql:45-142](supabase/migrations/20261102120000_linkedin_outreach_campaigns.sql).
- Step types now allowed in the DB: invite, message, wait, comment, react, visit, email, whatsapp, instagram, instagram_react, instagram_comment, instagram_follow, messenger, notify, add_to_campaign, call — [supabase/migrations/20261220120000_campaign_instagram_messenger.sql:3-27](supabase/migrations/20261220120000_campaign_instagram_messenger.sql) (email/whatsapp added in [20261204120000_campaign_step_types_channels.sql:1-18](supabase/migrations/20261204120000_campaign_step_types_channels.sql)).
- TypeScript list adds `"follow"` (LinkedIn follow) — [src/lib/unipile/campaignStepTypes.ts:3-21](src/lib/unipile/campaignStepTypes.ts) — but `'follow'` appears only in the `campaign_library_steps` constraint ([20270106120000_campaign_library.sql:25-45](supabase/migrations/20270106120000_campaign_library.sql)), not in the latest `linkedin_campaign_steps` constraint above. Possible mismatch (unrelated to this research; flag only).
- Campaign `channel` column: `check (channel in ('linkedin','email','whatsapp'))` — [supabase/migrations/20271002120000_campaign_whatsapp_channel.sql:3-8](supabase/migrations/20271002120000_campaign_whatsapp_channel.sql). Code mirrors this: `CAMPAIGN_CHANNELS` (for display) includes instagram/messenger, derived from steps — [campaignStepTypes.ts:662-724](src/lib/unipile/campaignStepTypes.ts); the create modal offers only LinkedIn, Email, WhatsApp, and Templates are disabled unless LinkedIn ("Templates are LinkedIn sequences") — [src/components/campaigns/CampaignCreateModal.tsx:90-121, 144-163](src/components/campaigns/CampaignCreateModal.tsx); API `channel?: "linkedin"|"email"|"whatsapp"` — [src/app/api/coach/linkedin-outreach/campaigns/route.ts:39, 54](src/app/api/coach/linkedin-outreach/campaigns/route.ts).
- Enrolment rules by campaign channel: email → needs an email (L993-1057); whatsapp → needs a phone (L1059-1092); otherwise (LinkedIn) → skip unless a LinkedIn URL or provider id (L1094-1108) — [src/lib/unipile/campaigns.ts](src/lib/unipile/campaigns.ts). List-to-campaign applies the same three-way filter and errors "None of those people have a LinkedIn profile to add" — [src/lib/leadLists/addListToCampaign.ts:173-206](src/lib/leadLists/addListToCampaign.ts).
- Instagram/Facebook URLs reach a lead's metadata from contact columns or from `raw` (incl. `raw.google_maps.instagrams`) via `socialUrlsFromUnknown`, but only in the email and LinkedIn branches, not the WhatsApp branch — [campaigns.ts:983-991, 1044-1053, 1155-1163](src/lib/unipile/campaigns.ts); [src/lib/unipile/socialUrls.ts:27-38](src/lib/unipile/socialUrls.ts).
- Worker: `processOutreachJobsTick` takes up to 48 due `linkedin_send_jobs`, one per account, claims, loads campaign/step/lead — [src/lib/unipile/worker.ts:70, 363-445](src/lib/unipile/worker.ts); cron every 5 min — [vercel.json](vercel.json) (`/api/cron/linkedin-outreach`, `*/5 * * * *`), route [src/app/api/cron/linkedin-outreach/route.ts](src/app/api/cron/linkedin-outreach/route.ts).
- Per-step branches: LinkedIn `invite` (L734-871), `message` via `sendCampaignLinkedInMessage` (L872-890), `visit` (L891-911), `follow` (L912-931), `instagram`/`messenger` via `sendCampaignChannelMessage` (L932-952), `instagram_react`/`instagram_comment` (L953-977), `instagram_follow` (L978-993), `email` via `sendCampaignEmail` with skip-if-no-email (L994-1034), `whatsapp` via `sendCampaignWhatsApp` with skip-if-no-phone (L1035-1076), LinkedIn comment/react (L1077+), notify/add_to_campaign/call — [worker.ts](src/lib/unipile/worker.ts).
- Email-channel campaigns wait 6 h and retry when no mailbox is connected; a comment says BOSS Score emails were cancelled at this point until 20 Nov — [worker.ts:463-479](src/lib/unipile/worker.ts).
- Non-LinkedIn send code: Instagram resolves username → provider/messaging id with `GET /users/{username}`, starts a chat, stores `instagram_chat_id` in lead metadata; Messenger resolves a Facebook profile identifier; WhatsApp starts a chat with `+<digits>`; email sends from the coach's mailbox with no `reply_to` — [src/lib/unipile/channelOutreach.ts:100-248, 250-349, 351-404, 406-490](src/lib/unipile/channelOutreach.ts).
- Voice/video in campaigns: step config keeps media only for `message` steps — [campaignStepTypes.ts:190-194](src/lib/unipile/campaignStepTypes.ts); only `sendCampaignLinkedInMessage` sends `voice_message`/`video_message` — [src/lib/unipile/campaignLinkedInSend.ts:21-79](src/lib/unipile/campaignLinkedInSend.ts); palette "Voice note"/"Video message" items exist only for type `message` (LinkedIn) — [src/components/campaigns/CampaignSequenceBuilder.tsx:1953-1965](src/components/campaigns/CampaignSequenceBuilder.tsx); Instagram/Messenger/WhatsApp channel senders take `text` only — [channelOutreach.ts:153-163, 406-416](src/lib/unipile/channelOutreach.ts).
- Step palette shows "Other channels" (Email, WhatsApp, Messenger) and an Instagram group once Instagram is connected — [CampaignSequenceBuilder.tsx:1898-1900, 1993-2050](src/components/campaigns/CampaignSequenceBuilder.tsx).
- Pacing and limits: send kinds `invite = [invite, instagram_follow]`, `message = [message, instagram, messenger]`, `react = [react, instagram_react]`; everything else (email, whatsapp, visit, follow, comment) is `"other"` — [src/lib/unipile/outreachSendSafety.ts:34-36, 74-85](src/lib/unipile/outreachSendSafety.ts). Campaign daily counters only run for invite and message kinds — [outreachSendSafety.ts:291-304](src/lib/unipile/outreachSendSafety.ts). Caps: daily invites ≤ 250, messages ≤ 100, reacts ≤ 100 — [src/lib/unipile/campaignSendWindow.ts:10-14](src/lib/unipile/campaignSendWindow.ts); weekly invite target 20-200 with SSI and warm-up rules — [src/lib/unipile/accountSendSafety.ts:19-26, 55-96](src/lib/unipile/accountSendSafety.ts). The account whose quota is used is the campaign's `outreach_account_id` (normally the LinkedIn account); the worker swaps a non-LinkedIn account for LinkedIn on LinkedIn steps — [worker.ts:482-556](src/lib/unipile/worker.ts).
- Launch check warns when a list is trades-heavy or in a sector scoring ≤4/10 on LinkedIn ("Run email, phone or post alongside this campaign") — [src/lib/campaigns/launchCheck.ts:133-160](src/lib/campaigns/launchCheck.ts), sector scores in [src/lib/campaigns/sectorTiers.ts:9-29](src/lib/campaigns/sectorTiers.ts).
- Templates/playbooks: campaign library seeds (connector, nurture, positive reply, reactivation, tribe, warm network) — [src/lib/campaignLibrary/seeds/](src/lib/campaignLibrary/seeds); email playbooks (BOSS Score sequences, Pam emails) — [src/lib/unipile/playbooks/scorecardSequences.ts](src/lib/unipile/playbooks/scorecardSequences.ts), [src/lib/unipile/playbooks/pamEmails.ts](src/lib/unipile/playbooks/pamEmails.ts).

### Inferences
- The engine is channel-agnostic in structure (steps → jobs → per-type sender) but LinkedIn-shaped in three places that matter: (1) enrolment requires LinkedIn for anything that isn't an email or WhatsApp campaign, (2) safety quotas live on one account row and treat Instagram/Messenger as LinkedIn messages and Instagram follows as LinkedIn invites (including the LinkedIn pending-invite brake), and (3) WhatsApp and email have no per-day cap, only send-hours.
- Mixed sequences already work in principle, e.g. a LinkedIn campaign with an Instagram DM step for leads who also have an Instagram URL in metadata.

### Gaps
- Whether any coach campaign has actually run an Instagram, Messenger or WhatsApp step in production is unknown (no DB read).

## 5. Inbox and replies: webhooks or polling, multi-provider, voice notes and attachments?

### Takeaway
The Conversations inbox is already multi-channel (LinkedIn, WhatsApp, Instagram, Messenger, email, plus SMS via Bird) and uses both Unipile webhooks and hourly/nightly polling. Coaches can record and send voice notes and video from the inbox on any Unipile channel. But stop-on-reply for campaigns matches only on `linkedin_campaign_leads.unipile_chat_id` or LinkedIn provider id, and the Instagram/Messenger/WhatsApp campaign senders store their chat ids in lead metadata instead, so replies on those channels probably don't stop the sequence.

### Cited Findings
- Webhook handling: `message_received` derives the channel from the account provider (`providerToAppChannel(body.account_type || account.provider)`) — [src/lib/unipile/webhookHandlers.ts:226-240](src/lib/unipile/webhookHandlers.ts); `mail_received` → `handleUnipileMailReceived` with `channel: "email"` — [webhookHandlers.ts:573-703](src/lib/unipile/webhookHandlers.ts); `new_relation` matches campaign leads by LinkedIn provider id — [webhookHandlers.ts:168-217](src/lib/unipile/webhookHandlers.ts).
- Polling: `syncUnipileInboxForCoach` loops accounts; mail providers via `syncMailingAccount`, messaging providers (LinkedIn/WhatsApp/Instagram/Messenger) via `syncMessagingAccount` with the mapped channel — [src/lib/unipile/inboxSync.ts:1700-1745, 1842](src/lib/unipile/inboxSync.ts); `syncLinkedInInboxForCoach` is just an alias — [inboxSync.ts:1972-1977](src/lib/unipile/inboxSync.ts). Crons: `/api/cron/linkedin-inbox-sync` hourly and `/deep` every 10 min 03:00-04:59 — [vercel.json](vercel.json).
- `messaging_messages.channel` allows email, sms, whatsapp, voice, system, linkedin, instagram, messenger — [supabase/migrations/20261104120000_messaging_multi_channel_unipile.sql:4-20](supabase/migrations/20261104120000_messaging_multi_channel_unipile.sql).
- Composer channels: sms, whatsapp, email, linkedin, instagram, messenger (+ internal comment) with "No Instagram"/"No Messenger" blocked labels — [src/lib/messaging/composerChannels.ts:24-58](src/lib/messaging/composerChannels.ts); conversation API accepts those channels — [src/app/api/messaging/conversations/[id]/route.ts:547-563](src/app/api/messaging/conversations/[id]/route.ts).
- Voice notes and attachments: in-browser recorder (`MediaRecorder`) in [src/components/messaging/ComposerMediaTools.tsx:323-501](src/components/messaging/ComposerMediaTools.tsx); `replyUnipileConversation` turns audio into `voice_message` and video into `video_message` for any Unipile channel — [inboxSync.ts:2185-2270](src/lib/unipile/inboxSync.ts). Attachments validated in [src/lib/messaging/messageAttachments.ts](src/lib/messaging/messageAttachments.ts).
- Starting a new Instagram/Messenger chat from the inbox resolves the person from `contacts.instagram_url` / `facebook_url` — [startConversation.ts:248-281](src/lib/messaging/startConversation.ts); no caller passes `prospectInstagramUrl` (only reference is inside that file).
- Stop-on-reply: webhook looks up `linkedin_campaign_leads` by `unipile_chat_id = chatId`, marks `replied`, cancels open jobs — [webhookHandlers.ts:490-526](src/lib/unipile/webhookHandlers.ts); polling does the same and falls back to `linkedin_provider_id` — [inboxSync.ts:686-713](src/lib/unipile/inboxSync.ts). The Instagram/Messenger/WhatsApp senders save chat ids as `metadata.instagram_chat_id` / `messenger_chat_id` / `whatsapp_chat_id` — [channelOutreach.ts:241-245, 478-483](src/lib/unipile/channelOutreach.ts); those keys appear in no other file (grep). `markContactRepliedOnInbound` only updates `contacts.prospect_status` — [src/lib/prospects/markContactReplied.ts:18-37](src/lib/prospects/markContactReplied.ts).
- SMS and transactional email go through Bird ("Minimal Bird platform HTTP client (email + SMS)") — [src/lib/bird/client.ts:1-27](src/lib/bird/client.ts), inbound at [src/app/api/webhooks/bird/route.ts](src/app/api/webhooks/bird/route.ts) and `/api/cron/bird-inbound`.
- Support WhatsApp: admins link their own WhatsApp; only one-to-one chats with a number matching exactly one coach's profile phone are read; voice notes are transcribed — [src/lib/support/whatsapp.ts:1-25](src/lib/support/whatsapp.ts). Ava alert messages go out from a separate BCA WhatsApp in `platform_unipile_accounts` — [src/lib/ava/alertsWhatsApp.ts](src/lib/ava/alertsWhatsApp.ts).

### Inferences
- Likely bug, worth a test before any non-LinkedIn campaign goes live: a prospect who replies to an Instagram, Messenger or WhatsApp campaign message will show in Conversations but stay `in_sequence` and get the next step. Fix is small: also write `unipile_chat_id` on the lead (or match on the metadata keys) in `channelOutreach.ts`.
- Inbox work for new channels is mostly done; voice notes already work by hand from the inbox, which is a usable stop-gap for "voice note follow-ups" before campaign-level voice exists.

### Gaps
- Not verified at runtime whether Unipile webhooks fire for Instagram/Messenger accounts on this workspace, or whether the webhook names (`pc-linkedin-messaging`) filter by account type (spec shows no account filter — [webhooks.ts:80-136](src/lib/unipile/webhooks.ts)).

## 6. Email: is there any cold email capability, and where?

### Takeaway
Email outreach exists, but only from the coach's own connected Gmail/Outlook through Unipile, as `email` steps or `channel = 'email'` campaigns. It is used today for BOSS Score report and follow-up sequences. There is no cold email infrastructure: no separate sending domains, mailbox rotation, warm-up, address verification, daily per-mailbox cap, unsubscribe handling, or integration with Instantly/Smartlead/Resend. BCA's own cold email research says the opposite of the current setup on the main point (never send from the main domain).

### Cited Findings
- Sending: `sendCampaignEmail` looks up the contact's email, requires a connected Gmail/Outlook, and calls `sendUnipileEmail` with subject + HTML body; no `reply_to` is passed, so follow-ups are not threaded by the app — [src/lib/unipile/channelOutreach.ts:351-404](src/lib/unipile/channelOutreach.ts).
- Mailbox choice: first OK Gmail/Outlook/IMAP account — [src/lib/messaging/startConversation.ts:137-147](src/lib/messaging/startConversation.ts).
- BOSS Score emails: "BOSS Score report and follow-up emails sent by the app (job 214, 12 Nov)"; if no mailbox is connected the report still goes from support@ in the coach's name; uses an email-channel `linkedin_campaigns` row — [src/lib/scorecardFollowUp.ts:1-12, 71, 105-150](src/lib/scorecardFollowUp.ts); coach sender choice (app vs CRM) and mailbox lookup — [src/app/api/coach/scorecard-email-sender/route.ts:28-52](src/app/api/coach/scorecard-email-sender/route.ts); sequences in [src/lib/unipile/playbooks/scorecardSequences.ts](src/lib/unipile/playbooks/scorecardSequences.ts).
- No quota: `email` is send kind `"other"`, so only send hours apply — [outreachSendSafety.ts:34-36, 74-85](src/lib/unipile/outreachSendSafety.ts).
- Blacklist by email and LinkedIn URL only — [src/lib/leadLists/audienceLists.ts:341-366](src/lib/leadLists/audienceLists.ts), used at [campaigns.ts:888-919](src/lib/unipile/campaigns.ts).
- No unsubscribe/opt-out code in campaign sending: grep for `unsubscribe|opt-out|List-Unsubscribe` in `src/lib` and `src/app/api` hits only access tiers and help answers. No email-verification provider in code (grep for neverbounce/zerobounce/millionverifier/bouncer: none).
- Third-party email tools: Smartlead 0 hits; "instantly" and "resend" hits are ordinary English words, not integrations (grep of `src/`). Bird is used for transactional email + SMS — [src/lib/bird/client.ts:1-27](src/lib/bird/client.ts).
- BCA research (job 84): never send from your main domain; separate lookalike domains, Google mailboxes 30+ days old, warmed up, 20-25 emails/day per mailbox, verify every address; UK PECR/GDPR requires sender ID and an easy opt-out in every email; "the hard part is the infrastructure… a strong done-for-you piece for BCA to set up per coach (job 85)… one or two domains and about 100 emails a day" — [docs/cold-email-research/README.md:21, 80-90](docs/cold-email-research/README.md).

### Inferences
- The current email path is fit for warm/inbound email (BOSS Score, replies) and small-volume one-to-one follow-ups, not cold email at volume. Running cold sequences from a coach's main Gmail risks that coach's everyday mailbox.
- Two routes: (1) build in-app (new "sending mailbox" concept, multiple Unipile Google accounts per coach on secondary domains, rotation, per-mailbox caps, opt-out link/keyword handling, verification step on import, bounce handling) = large; (2) integrate a dedicated cold email platform's API for sending and push replies into Conversations = medium.

### Gaps
- Whether Unipile tracks opens/bounces for `/api/v1/emails` sends in this workspace was not checked.

## 7. Ava's tools and skills: which touch prospect search and campaigns, and what needs a channel option?

### Takeaway
Ava can already run Sales Nav, Google Maps and Google Search imports, manage lists, create campaigns (LinkedIn, email or WhatsApp), add lists to campaigns and write steps. But her step writer only allows invite, wait, message, email, visit and follow (no WhatsApp, Instagram or Messenger), and the automatic launch planner (`avaAuto.ts`) only plans Sales Navigator lists and LinkedIn connection campaigns. Her capability notes already tell her to warn coaches when a sector scores 4 or under on LinkedIn.

### Cited Findings
- Prospect tools: `get_blueprint_targeting`, `build_sales_nav_search`, `preview_sales_nav_search`, `start_sales_nav_import`, `google_maps_options`, `start_google_maps_import`, `google_search_options`, `start_google_search_import`, `check_import` — [src/lib/agent/tools/prospects.ts:240-644](src/lib/agent/tools/prospects.ts).
- Campaign tools: `list_campaigns`, `get_campaign`, `list_campaign_templates`, `create_campaign` (channel enum `linkedin | email | whatsapp`, line 268), `update_campaign_settings`, `set_campaign_status`, `get_sending_limits` — [src/lib/agent/tools/campaigns.ts:166-367](src/lib/agent/tools/campaigns.ts).
- People tools: `add_list_to_campaign`, `list_campaign_people`, `remove_people_from_campaign`, `pause_people`, `resume_people` — [src/lib/agent/tools/campaignPeople.ts:94-227](src/lib/agent/tools/campaignPeople.ts); list tools `list_lists`, `get_list_people`, `create_list`, `rename_list`, `add_people_to_list` — [src/lib/agent/tools/lists.ts:20-172](src/lib/agent/tools/lists.ts).
- Messaging tools: `get_coach_brain`, `use_blueprint_messaging`, `write_campaign_steps` with `WRITABLE_STEP_TYPES = ["invite","wait","message","email","visit","follow"]`; description talks only about invites and connection notes — [src/lib/agent/tools/messaging.ts:21-44, 223-245](src/lib/agent/tools/messaging.ts).
- Auto launch planner: `draftProspectSearches` prompts "You plan a Profit Coach's prospect lists for LinkedIn Sales Navigator", uses the Gyms example for Paul Hamnett, imports via `startSalesNavImport` — [src/lib/launch/avaAuto.ts:234-262, 518-563](src/lib/launch/avaAuto.ts); launch chain step "Connection campaigns" — [avaAuto.ts:750-754](src/lib/launch/avaAuto.ts).
- Sales Nav playbook is LinkedIn-only, including a gyms/sports facilities example — [src/lib/salesNavigator/prospectSearch/playbook.ts:1-60](src/lib/salesNavigator/prospectSearch/playbook.ts).
- Capability notes: find-prospects lists Sales Nav, Google Maps, Google Search, existing list, 1st-degree connections, and says "If their sector scores 4 or under on LinkedIn… say so in a line before they build a LinkedIn list" — [content/agent/capabilities/find-prospects/CONTEXT.md:20-52](content/agent/capabilities/find-prospects/CONTEXT.md); campaigns are "sequences of LinkedIn (or email) steps" — [content/agent/capabilities/campaigns/CONTEXT.md:13](content/agent/capabilities/campaigns/CONTEXT.md); add-list "adds everyone on the list who has a LinkedIn profile (or an email, for email campaigns)" — [content/agent/capabilities/campaign-people/CONTEXT.md:20](content/agent/capabilities/campaign-people/CONTEXT.md); Google Maps capability — [content/agent/capabilities/google-maps-import/CONTEXT.md:1-33](content/agent/capabilities/google-maps-import/CONTEXT.md).

### Inferences
- For new channels Ava needs: `create_campaign` enum + new channels; `write_campaign_steps` to accept whatsapp, instagram, instagram_follow/react/comment, messenger and a voice-note option; channel-aware copy rules (Instagram/WhatsApp tone vs connection note limits); a planner path in `avaAuto.ts` that can pick Google Maps (or an Instagram import) instead of Sales Nav when the sector scores low; and updated CONTEXT files. Mostly small-to-medium prompt/schema work once the engine supports the channels.

### Gaps
- Ava's copy skills for Instagram/WhatsApp messages (content/ai-knowledge) were not reviewed; `connection-campaign-skill` memory notes suggest one LinkedIn-focused skill.

## 8. Earlier research and plans already in the repo

### Takeaway
The repo holds LinkedIn data showing low-scoring sectors, an explicit (untested) recommendation of Facebook and Instagram for trades, a full cold email research pack with a done-for-you plan (jobs 84/85), and shipped Google Maps / Google Search importers. Nothing in the repo plans Companies House, Instagram discovery, or Messenger at scale.

### Cited Findings
- 110,769 LinkedIn requests from 43 coaches; sector scores: consulting 9, IT 8, recruitment/accountancy/property/education/marketing 7, retail 6, legal/charity/energy 5, construction/engineering/trades/logistics/hospitality/automotive 4, health and care 3; "Other channels first (email, phone, post, events, partners; Facebook and Instagram for trades)… Trades acceptance was 2 to 7%… The channel suggestions are our recommendation and not yet tested" — [content/ai-knowledge/outreach-research.md:1-5, 52-59](content/ai-knowledge/outreach-research.md).
- Same scores coded for the launch check (gym/fitness falls under "Health, care & wellbeing", score 3; food/drink under "Hospitality, food & drink", score 4) — [src/lib/campaigns/sectorTiers.ts:9-29](src/lib/campaigns/sectorTiers.ts).
- Lead Finder: admin-only LeadRocks via Apify plus a local UK owners CSV database; reveal gives email/phone/LinkedIn — [docs/lead-finder.md:1-48](docs/lead-finder.md).
- Apify LinkedIn profile import and Sales Nav cookie-scrape history; "cookie scrapes carry account risk" — [docs/apify-linkedin-profile.md:1-57](docs/apify-linkedin-profile.md). (Sales Nav import has since moved to Unipile search — [src/lib/unipile/salesNavImportJob.ts:382](src/lib/unipile/salesNavImportJob.ts).)
- First Campaign Setup brief: activation = LinkedIn imported, ICP, avatar, 3-4 messages, 100-250 named prospects; "Fit beats inventory… we source the list another way"; ends in CSV handoff to Connect AI / Sales Robot — [docs/first-campaign-setup.md](docs/first-campaign-setup.md) (sections 1, 3 Step 2, Step 5).
- Cold email research and done-for-you recommendation — [docs/cold-email-research/README.md:1-92](docs/cold-email-research/README.md).
- Google Maps import via Apify actor `compass/crawler-google-places` (override `APIFY_GOOGLE_MAPS_ACTOR`), optional owner enrichment (`maximumLeadsEnrichmentRecords`) and contact scraping — [src/lib/apify/googleMapsPlaces.ts:22, 50, 60-185](src/lib/apify/googleMapsPlaces.ts); job runner + cron every minute — [src/lib/googleMaps/importJob.ts](src/lib/googleMaps/importJob.ts), [vercel.json](vercel.json); coach route gated by `requireOutreachCoach` — [src/app/api/coach/google-maps-import/route.ts:12](src/app/api/coach/google-maps-import/route.ts). Google Search import mirrors it — [src/lib/googleSearch/](src/lib/googleSearch), [src/lib/apify/googleSearch.ts](src/lib/apify/googleSearch.ts).
- AI agent plan already described chains like "launch a connector campaign… asks how you want to find people (Google Maps: country, then US state or town…)" — [docs/archive/ai-agent-plan.md:9, 30, 66](docs/archive/ai-agent-plan.md).
- Instagram mentions elsewhere are in client-business playbooks (branding/visibility channel selection), not outreach plans — e.g. [content/playbooks/Source/5. Revenue & Marketing/2.5 Lead Generation/Action 02 - Channel Selection.md](content/playbooks/Source/5.%20Revenue%20%26%20Marketing/2.5%20Lead%20Generation/Action%2002%20-%20Channel%20Selection.md).
- `docs/roadmap.md` has no Instagram/WhatsApp/cold email/Maps entries; the live roadmap is the `roadmap_jobs` table ([docs/roadmap.md:1-5](docs/roadmap.md)), which was not queried.

### Inferences
- The strongest internal evidence for going beyond LinkedIn is the sector data: the coaches' typical niches (engineering, manufacturing, logistics, hospitality, food and drink, fitness) score 3-4/10 on LinkedIn.

### Gaps
- Status of roadmap jobs 84 (cold email research and design) and 85 (done-for-you cold email setup) is in the database, not read here.

## 9. Coach examples: Paul Hamnett, Bruce Alexander, and other markets that look weak on LinkedIn

### Takeaway
Paul Hamnett targets owners of commercial sports, fitness and activity facilities; Bruce Alexander targets UK food, drink and consumer brands. Using the app's own LinkedIn sector scores, most of the current new-coach markets land at 3-4/10 on LinkedIn, i.e. "other channels first".

### Cited Findings
- Paul Hamnett: owners of commercially run sports, fitness and activity facilities at £1M-£5M and 11-50 staff; test first independent gyms and specialist fitness, climbing/padel/racket-sport and activity venues, commercial pitch and multi-sport operators; later golf and leisure clubs; flagged "tricky" because few such facilities reach £1M+ — [.local/coach-targeting-2026-11-19.md:32, 193-206](.local/coach-targeting-2026-11-19.md).
- Bruce Alexander: founders and MDs of UK food, drink and consumer brands at £1M-£10M with 11-50 staff (packaged food, drinks, snacks, chilled and frozen, premium); "clean", easy to build lists for; Ava drafted his launch chain as the pilot — [.local/coach-targeting-2026-11-19.md:24, 77-89](.local/coach-targeting-2026-11-19.md).
- Other coaches' markets (summary table): owner-led engineering service and technical industrial firms; security, gate automation, access control and engineering firms (LinkedIn set to "discreet" may block outreach); IT services/MSPs/SaaS; logistics, warehousing, waste and recycling; industrial machinery, packaging, coding and automation; UK hospitality, multi-site first; boards and governance in manufacturing, property and construction; brand and marketing adviser with an open sector; UK telecoms and digital subscription businesses — [.local/coach-targeting-2026-11-19.md:22-34](.local/coach-targeting-2026-11-19.md).
- Sector scores used to judge LinkedIn fit — [src/lib/campaigns/sectorTiers.ts:9-29](src/lib/campaigns/sectorTiers.ts); [content/ai-knowledge/outreach-research.md:52-59](content/ai-knowledge/outreach-research.md).

### Inferences
- By the app's sector regexes (my mapping, not run): sports/fitness/gyms → Health, care & wellbeing **3/10** (or leisure → Hospitality **4**); FMCG food and drink brands → Hospitality, food & drink **4**; hospitality → **4**; engineering service, security/gate automation, industrial machinery/packaging → Engineering & manufacturing **4**; logistics/warehousing → **4** (waste/recycling → Energy & environment 5); manufacturing/construction governance → **4** (property 7); IT/MSP/SaaS and telecoms/digital → IT **8**; marketing → **7**. So roughly 8 of 11 coaches in the table sit in "other channels first" sectors.
- Physical, local markets (gyms, padel/climbing venues, hospitality) are a natural fit for the existing Google Maps import, and their Maps listings often carry Instagram/Facebook links that the app already scrapes but doesn't use. Food and drink brands are typically active on Instagram, but finding them there would need a new importer.

### Gaps
- Bruce's FMCG brands are scored by a regex built for hospitality; the 110k data may not have enough FMCG-brand owners to know their true LinkedIn response.

## 10. Gap list: software changes needed per channel

### Takeaway
Effort is lower than starting from scratch because Unipile connections, step types, senders and the inbox exist. The biggest single unlock is a campaign that doesn't require LinkedIn (Instagram/Messenger channels + enrolment), plus fixing reply-stop on non-LinkedIn chats. Instagram/Facebook *discovery* and *cold email infrastructure* are the two genuinely large pieces.

### Cited Findings
- Existing building blocks: provider list and hosted auth ([providers.ts:6-24](src/lib/unipile/providers.ts), [hostedAuth.ts:67-149](src/lib/unipile/hostedAuth.ts)); step types ([20261220120000_campaign_instagram_messenger.sql:3-27](supabase/migrations/20261220120000_campaign_instagram_messenger.sql)); senders ([channelOutreach.ts](src/lib/unipile/channelOutreach.ts)); voice-capable client ([client.ts:363-423](src/lib/unipile/client.ts)); multi-channel inbox ([inboxSync.ts:1700-1745, 2185-2270](src/lib/unipile/inboxSync.ts)); Maps importer ([src/lib/googleMaps/](src/lib/googleMaps)); WhatsApp number check ([src/lib/unipile/checkWhatsAppOn.ts:33-72](src/lib/unipile/checkWhatsAppOn.ts), used only from prospect/contact routes, not campaigns — grep of `whatsapp_on`).

### Inferences

**(a) Import prospects from Instagram/Facebook or Google Maps**

| Change | Effort | Files |
|---|---|---|
| Google Maps import itself | Done | `src/lib/googleMaps/*`, `src/lib/apify/googleMapsPlaces.ts`, `src/app/api/coach/google-maps-import/*`, Ava `start_google_maps_import` |
| Promote Maps-scraped Instagram/Facebook links out of `raw` into list-item columns; show/filter them in the pool | Small | migration on `coach_lead_list_items`; `src/lib/googleMaps/flushPlacesToPool.ts:25-54`; `src/lib/pool/identity.ts`; pool table views |
| Add `ig:`/`fb:` identity keys and new `source` values (`instagram`, `facebook`, `companies_house`) to both list check constraints | Small | `src/lib/pool/identity.ts:67-80`; migration replacing `20261228120000_google_maps_list_source.sql` constraints; `src/lib/prospectSourceKind.ts` |
| Let CSV/manual import and the prospect editor carry `instagram_url` / `facebook_url` (today nothing writes `contacts.instagram_url`) | Small | `src/lib/pool/mapPoolPeopleInput.ts:52-56`; `src/lib/prospects/updateProspectFields.ts`; prospect detail UI |
| Instagram/Facebook discovery importer (e.g. Apify Instagram actors by hashtag, location, follower list, or profile enrichment from a website), with run table, cron tick, cost estimate, Ava tool and capability note, copying the Maps pattern | Medium (Large if done via logged-in coach accounts, which Unipile code here does not support) | new `src/lib/instagramImport/*`, `src/lib/apify/instagram*.ts`, `src/app/api/coach/instagram-import/*`, `/api/cron/instagram-import`, migration `instagram_import_runs`; `src/lib/agent/tools/prospects.ts`; `content/agent/capabilities/` |
| Companies House importer (directors by SIC code/region) | Medium | new client + run table + mapping; no existing code |

**(b) Send Instagram/Messenger DMs, including voice notes**

| Change | Effort | Files |
|---|---|---|
| Connect Instagram/Messenger | Done | `IntegrationsSettingsTab.tsx:78-110`, hosted auth |
| DM / like / comment / follow steps and senders | Done | `worker.ts:932-993`, `channelOutreach.ts:153-349` |
| Fix stop-on-reply for Instagram/Messenger/WhatsApp campaign chats (write `unipile_chat_id` on the lead or match metadata keys) — verify first | Small | `channelOutreach.ts:241-245, 478-483`; `webhookHandlers.ts:490-526`; `inboxSync.ts:686-713` |
| New campaign channels `instagram` / `messenger` so people with only an Instagram/Facebook URL can be enrolled (DB check, enrolment branch, list filter, create modal, API, Ava enum) | Small-Medium | migration on `linkedin_campaigns_channel_check`; `campaigns.ts:993-1108` (new branch); `addListToCampaign.ts:173-206`; `CampaignCreateModal.tsx:90-121`; `campaigns/route.ts:39-54`; `agent/tools/campaigns.ts:268` |
| Voice/video notes on Instagram, Messenger (and WhatsApp) steps: keep media in config for those types, show Voice/Video palette items, pass `voice_message` through the channel senders (start chat with text, then send media, as the LinkedIn sender does) | Small-Medium | `campaignStepTypes.ts:190-194`; `CampaignSequenceBuilder.tsx:1953-1965, 2033-2050`; `channelOutreach.ts:153-248`; reuse `campaignLinkedInSend.ts:21-79`, `campaignStepMedia.ts` |
| Per-channel pacing: give Instagram/Messenger accounts their own daily DM/follow quotas and warm-up instead of using the LinkedIn account's plan and pending-invite brake | Medium | `outreachSendSafety.ts:34-36, 74-85, 235-330`; `accountSendPlan.ts`; `accountSendSafety.ts`; `worker.ts:482-556`; account settings UI (`AccountSendingModal.tsx`) |
| Instagram "followed back" detection (new_relation only matches LinkedIn ids) | Small (if Unipile emits it for Instagram) | `webhookHandlers.ts:168-217` |
| Instagram/WhatsApp-style templates (library is LinkedIn sequences only) and channel-aware copy rules | Small-Medium (content) | `src/lib/campaignLibrary/seeds/*`; `CampaignCreateModal.tsx:144-163`; Ava copy skills |
| "Ready to launch" checks that accept a non-LinkedIn channel | Small | `src/lib/gettingLive.ts`, `src/lib/coachHealth.ts`, `CoachSetupBar.tsx`, `linkedinSetupState.ts` |

**(c) Send WhatsApp**

| Change | Effort | Files |
|---|---|---|
| Connect WhatsApp, `whatsapp` campaign channel and step, phone-based enrolment, inbox | Done | `20271002120000_campaign_whatsapp_channel.sql`; `campaigns.ts:1059-1092`; `channelOutreach.ts:406-490`; `worker.ts:1035-1076` |
| Check the number is on WhatsApp before enrolling/sending (Maps phones are often landlines); reuse `checkWhatsAppNumberOnUnipile` | Small | `checkWhatsAppOn.ts:35-72`; `campaigns.ts:1059-1092`; `worker.ts:1035-1076` |
| Daily WhatsApp send cap and spacing (today `"other"` kind = send hours only) | Small-Medium | `outreachSendSafety.ts:34-36, 74-85`; `campaignSendWindow.ts`; campaign settings |
| Stop-on-reply fix (same as b) and voice notes on WhatsApp steps (same as b) | Small | as above |
| Carry Instagram/Facebook URLs into WhatsApp-channel lead metadata (missing in that branch) | Small | `campaigns.ts:1086-1089` |
| Opt-out handling (e.g. "STOP" reply → blacklist phone); blacklist today covers email and LinkedIn URL only | Small | `audienceLists.ts:341-366`; `webhookHandlers.ts` |
| Ava: allow `whatsapp` in `write_campaign_steps` | Small | `agent/tools/messaging.ts:21` |

**(d) Send cold email**

| Change | Effort | Files |
|---|---|---|
| Email step, email campaign channel, send from coach's Gmail/Outlook, inbound sync, BOSS Score sequences | Done | `channelOutreach.ts:351-404`; `worker.ts:463-479, 994-1034`; `scorecardFollowUp.ts` |
| Thread follow-ups (pass `reply_to` / same subject) | Small | `channelOutreach.ts:396-401`; `client.ts:1117-1146` |
| Opt-out line + reply/keyword unsubscribe → email blacklist; sender identity (UK PECR) | Small | `channelOutreach.ts`; `audienceLists.ts`; `webhookHandlers.ts:573-703` |
| Per-mailbox daily cap and spacing (today none) | Small-Medium | `outreachSendSafety.ts`; `accountSendPlan.ts` |
| Email verification on import (bought/scraped lists are 70-80% valid per research) | Medium | pool import (`flushPlacesToPool.ts`, `startImport.ts`), new verifier client |
| Separate sending mailboxes per coach (secondary domains), several Unipile Google accounts per coach, rotation, warm-up, bounce handling — or integrate a dedicated cold email platform API and pipe replies into Conversations | Large in-house / Medium via a platform | `startConversation.ts:137-155` (one account per channel today); `linkedin_outreach_accounts` (needs a "purpose: cold sending" flag); new integration module; Settings UI |
| Ava: email copy rules from the cold email research; `create_campaign` already supports email | Small | `content/agent/capabilities/campaign-messaging/CONTEXT.md`; copy skills |

**Cross-cutting (any channel)**
- Ava launch planner picks the source by sector (Maps for local/physical, Instagram import for consumer brands, Sales Nav otherwise) and drafts a non-LinkedIn first campaign — Medium — `src/lib/launch/avaAuto.ts:234-262, 518-563, 750-754`; `src/lib/salesNavigator/prospectSearch/playbook.ts`; `content/agent/capabilities/find-prospects/CONTEXT.md`.
- Rename debt: every table is `linkedin_*` though it holds all channels. Renaming is optional and Large (183+ `from("contacts")`/109 `linkedin_campaign_leads` call sites); leave names, add channel columns.

### Gaps
- Runtime confirmation of the stop-on-reply bug, of Unipile Instagram/Messenger cold-DM and voice-note support, and of Instagram/WhatsApp account ban thresholds is outside a read-only code review.
