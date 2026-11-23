# Unipile capabilities beyond LinkedIn (Instagram, Facebook/Messenger, WhatsApp, Telegram, email, X), as of 21 Nov 2026

Research date: 21 Nov 2026. Main source: Unipile's developer docs, pulled as raw markdown (v1 index `developer.unipile.com/llms.txt`, v2 index `developer.unipile.com/v2.0/llms.txt`). Each doc page shows an `updatedAt` stamp, quoted where it matters. Evidence labels used throughout:
- **[Docs]**: stated in Unipile developer docs or the API reference.
- **[Changelog]**: Unipile changelog.
- **[Vendor marketing]**: unipile.com marketing pages.
- **[Meta docs]**: Meta developer documentation.
- **[Press]**: news coverage.
- **[User report]**: community posts.
- **[Inferred]**: my own reasoning from the cited facts, not stated by any source.

**Most important structural fact: Unipile now runs two API versions.**
- **v1:** base `https://{DSN}/api/v1/...`, dashboard dashboard.unipile.com.
- **v2:** base `https://api.unipile.com/v2/{account_id}/...`, dashboard dashboardv2.unipile.com. Needs a separate sign-up.

Facebook/Messenger works **only in v2**. Instagram works in both, but has more features in v2. X/Twitter works in neither ("coming soon in v2"). A platform built on v1 for LinkedIn (most likely, if it was built before late 2026) would have to adopt v2 to add Facebook.

---

## 1. At a glance: what does Unipile do on each channel, compared with LinkedIn?

### Takeaway
Unipile has **no people or business search on Instagram or Facebook**. LinkedIn is the only channel with search (Classic, Sales Navigator, Recruiter). Instagram and Facebook do support the rest of an outreach loop:
- Look up a profile by ID or username.
- List the followers or following of an account (Instagram, and Facebook profiles).
- List a post's commenters and reactors.
- Follow, like and comment.
- Start a new DM (cold), send media and voice, and get webhooks.

Lead lists for Instagram and Facebook would therefore come from seed accounts and posts, or from an outside scraper, not from a search box.

### Cited Findings
- **[Docs] v2 matrix ("Provider features & availability", updatedAt 2026-11-13).**
  - Covers LinkedIn, WhatsApp, Telegram, Instagram and Facebook.
  - "Start a new conversation" is 🟢 for all five. LinkedIn's note says "(from an inbox)".
  - "Read receipts (webhook)" is 🟢 for LinkedIn (Classic and Sales Navigator), WhatsApp, Instagram and Facebook, and 🔴 for Telegram.
  - "Delete conversations" is 🔴 for Instagram and Telegram.
  - "Presence & typing indicator" is 🟠 for Instagram (presence only).
  - Source: [Unipile v2 provider features](https://developer.unipile.com/v2.0/docs/list-provider-features)
- **[Docs] v2 matrix, Users & relations.**
  - Instagram: user profiles 🟢; invitations & follow requests 🟢; followers, follow & unfollow 🟢; "Report a profile visit" 🔴; "Relations (connections)" ⚫ (not relevant).
  - Facebook: relations (friends) 🟢; invitations 🟢; followers, follow & unfollow 🟢.
  - "New relations & followers (webhook)" is 🔴 for both Instagram and Facebook.
  - Source: [Unipile v2 provider features](https://developer.unipile.com/v2.0/docs/list-provider-features)
- **[Docs] v2 matrix, Posts & comments.** Instagram and Facebook both have: read posts; create, edit and delete posts; comments and replies; reactions on posts and comments; "A user's comments & reactions". Stories are 🟢 on Instagram and 🔴 on Facebook. Source: [Unipile v2 provider features](https://developer.unipile.com/v2.0/docs/list-provider-features)
- **[Docs] v2 search is LinkedIn-only.**
  - All search methods sit under "LinkedIn-specific API": Classic People, Companies, Posts and Jobs search; search from URL; Recruiter search.
  - The Instagram and Facebook columns contain no search method.
  - Sources: [Unipile v2 provider features](https://developer.unipile.com/v2.0/docs/list-provider-features); [v2 docs index](https://developer.unipile.com/v2.0/llms.txt)
- **[Docs] The older v1 matrix (updatedAt 2026-10-02) is ambiguous on Instagram search.**
  - It marks Instagram "Search by URL or parameters → People" and "Posts" as 🟠 (partial).
  - No Instagram search endpoint or guide exists anywhere in the v1 docs. The search guide and reference cover LinkedIn only.
  - The same v1 matrix shows no Facebook column at all.
  - Sources: [Unipile v1 provider features](https://developer.unipile.com/docs/list-provider-features); [v1 LinkedIn search guide](https://developer.unipile.com/docs/linkedin-search)
- **[Docs] v1 messaging matrix.** Instagram is 🟢 for: hosted and custom auth; send and reply messages; list messages, chats and attendees; sync history; reactions; read receipts; send and receive files; **send voice notes**; retrieve user and own profiles; account-status, new-message and reaction/read webhooks. "Send embed video" is blank (unsupported) for Instagram and Telegram. Source: [Unipile v1 provider features](https://developer.unipile.com/docs/list-provider-features)
- **[Docs] v1 "LinkedIn/Instagram Specific" table.**
  - Instagram 🟢: Invite Users; Delete Pending Invitation; Following someone; list posts; add reaction; send comments; list post comments and reactions; create and retrieve post; visit and retrieve profiles; List of Followers; List of Followed accounts.
  - Not available for Instagram: InMail; outreach sequence; list pending invitations; detecting accepted invitations; companies; Sales Navigator.
  - Source: [Unipile v1 provider features](https://developer.unipile.com/docs/list-provider-features)
- **[Docs] LinkedIn baseline for comparison.**
  - Search: Classic, Sales Navigator and Recruiter, people and companies. Capped at 1,000 results per query (2,500 on Sales Navigator or Recruiter).
  - Invitations: 80–100 per day on paid accounts.
  - InMail, profile views, Sales Navigator lead saving, company pages, job postings, and the raw-data proxy route.
  - Source: [Unipile v2 provider limits](https://developer.unipile.com/v2.0/docs/provider-limits-and-restrictions)

**Compact matrix.** Built from the cited docs. "—" means not offered.

| Capability | LinkedIn | Instagram | Facebook | WhatsApp | Telegram |
|---|---|---|---|---|---|
| API versions | v1 + v2 | v1 + v2 | **v2 only** | v1 + v2 | v1 + v2 |
| Connect | creds / cookies / UniLogin | creds / `sessionid` cookie / UniLogin | creds / cookies (`xs`, `c_user`, `datr`) / UniLogin | QR or pairing code | QR (+2FA) |
| People/business search | Yes (Classic, Sales Nav, Recruiter) | **No** (v1 matrix "partial", nothing documented) | **No** | — (check whether a number is on WhatsApp) | — (check whether a number is on Telegram, v1) |
| Get a profile | Yes | Yes, by ID or username | Yes | Yes | Yes |
| List followers or following | Yes | Yes (any public account) | Yes | — | — |
| List friends or connections | Yes | — | Own friends only | — | — |
| Read posts, comments, reactions | Yes | Yes | Yes | — | — |
| Follow / react / comment | Yes | Yes | Yes (+ friend request, no note) | — | — |
| Cold DM (new chat) | Yes (connections, InMail, open profiles) | Yes (`startChat`) | Yes from a personal profile; **a Page cannot** | Yes, any number | Yes |
| Voice notes | Yes | Yes | Not stated explicitly | Yes | Yes |
| Read-receipt webhook | Yes | Yes | Yes (+ delivery receipts) | Yes | No |
| New-follower webhook | Yes | No | No | — | — |

### Inferences
- [Inferred] For Instagram, the closest thing to "search" is building lists from seed accounts. For example: competitors' or UK business influencers' followers (`listUserFollowers`), commenters and likers on niche posts (`getPostCommentsList`, `getPostReactionsList`), then enriching each with `getUserProfile`. That works through Unipile. Hashtag, keyword and location discovery do not.
- [Inferred] For Facebook there is no workable list-building inside Unipile. You can only list your own friends, plus followers of profiles you already know. Group members are not covered. A separate scraper would be needed to find prospects.

### Gaps
- What the 🟠 "partial" Instagram People/Posts search in the v1 matrix actually means is undocumented. It may be a leftover. I found no endpoint for it.
- Facebook group-member listing is never mentioned. "Groups" in the Facebook docs means group chats, not Facebook Groups.

---

## 2. How is each account connected? Official Meta API or private access? Business account needed?

### Takeaway
None of Instagram, Facebook or WhatsApp uses Meta's official APIs. Each is a **session-based connection to the user's own account**:
- Instagram: username and password, the `sessionid` cookie, or the UniLogin browser extension.
- Facebook: credentials, cookies, or UniLogin.
- WhatsApp: "Link a Device", by QR code or pairing code.

There is no Facebook Login, app review, Meta Business verification or Page requirement. The docs never require a business or creator account. Unipile says on its own site that it is "not a Meta Partner".

### Cited Findings
- **[Docs] Instagram (v2, updatedAt 2026-09-17).**
  - Two methods. "Using credentials (username & password) – A dedicated Instagram session is created for Unipile." "Using cookies (`sessionid`) – The session is shared from an existing browser session."
  - If Instagram invalidates the session, the account status becomes `disconnected`.
  - Hosted auth shows credentials only by default. Cookies must be enabled with `allow_methods: ["credentials","cookies"]`.
  - Source: [Unipile v2: Link Instagram accounts](https://developer.unipile.com/v2.0/docs/link-instagram-accounts)
- **[Docs] Instagram (v1).**
  - Endpoint `POST /api/v1/accounts` with `"provider":"INSTAGRAM"`, username and password. SDK method `client.account.connectInstagram`.
  - 2FA returns 202 with a checkpoint. Solve it via `POST /api/v1/accounts/checkpoint` within a **5-minute** intent; after that you get 408, then 400.
  - "Authentication via Facebook credentials is not supported at the moment."
  - Source: [Unipile v1 Instagram guide](https://developer.unipile.com/docs/instagram)
- **[Changelog] UniLogin.**
  - v1 recent update: "Connect the Instagram account already signed in to your browser with UniLogin (browser extension), without sharing your password." Available in hosted and custom auth. Source: [v1 changelog](https://developer.unipile.com/changelog/last-months-update-v1-1)
  - v2.20261113.1 (13 Nov 2026): "Added number-matching codes to in-app approval checkpoints" for Instagram. Source: [v2 changelog 13 Nov 2026](https://developer.unipile.com/changelog/v2202611131-better-onboarding-disappearing-messages-controls-additional-auth-checkpoints)
- **[Docs] Facebook (v2, updatedAt 2026-11-13).**
  - Methods: credentials (email or username, plus password); cookies `xs`, `c_user`, `datr` (optional `sb`, `fr`, and the exact browser user agent); UniLogin (hosted auth only).
  - A connected account has products `messaging` (the personal Messenger inbox, always on) and `page_<page_id>` for each Page the user administers.
  - Checkpoints to handle: `2FA` (authenticator app, SMS or WhatsApp), `OTP`, `CAPTCHA`, `IN_APP_VALIDATION`, `CONSENT_SCREEN` (Page selection), `ENCRYPTED_HISTORY`.
  - Source: [Unipile v2: Link Facebook accounts](https://developer.unipile.com/v2.0/docs/facebook-link-accounts)
- **[Docs] Facebook login errors.**
  - `403 provider/access_restricted` "can notably mean that Facebook asks the user to choose between a subscription and using it for free with ads. This choice can only be made on facebook.com."
  - `502 api/proxy_error`: "Facebook… is blocking the login from this IP."
  - Source: [Unipile v2: Link Facebook accounts](https://developer.unipile.com/v2.0/docs/facebook-link-accounts)
- **[Docs] Facebook encrypted chats.**
  - Personal 1:1 and group Messenger chats are end-to-end encrypted. Page chats are not.
  - New messages always flow. Past messages need the 40-character Messenger recovery code or the PIN at link time (`ENCRYPTED_HISTORY` checkpoint); otherwise only messages received after linking can be read.
  - Source: [Unipile v2: Facebook encrypted chats](https://developer.unipile.com/v2.0/docs/facebook-encrypted-chats)
- **[Docs] Messenger in v1.** "Facebook Messenger is deprecated in v1 and available in v2. This guide is retained for historical v1 reference." The v1 flow was `provider: "MESSENGER"` with username and password. Source: [Unipile v1 Messenger guide](https://developer.unipile.com/docs/messenger)
- **[Docs] WhatsApp.**
  - "users must use the Link a Device feature provided by WhatsApp", by QR code or a pairing code (`pairing_phone_number`, E.164 digits).
  - Removing the Unipile device from WhatsApp's linked devices disconnects the account.
  - "Keep the primary device… powered on and connected to the internet."
  - Sources: [Unipile v2: Link WhatsApp](https://developer.unipile.com/v2.0/docs/link-whatsapp-accounts); [v1 WhatsApp guide](https://developer.unipile.com/docs/whatsapp)
- **[Docs] Telegram.** QR code, with 2FA via an authenticator. Username and password is 🔴 (not supported). Sources: [v1 connection methods](https://developer.unipile.com/docs/connect-accounts); [v1 Telegram guide](https://developer.unipile.com/docs/telegram) (updatedAt 2025-08-31)
- **[Docs] Proxies.**
  - "Unipile automatically assigns fixed proxies to accounts… By default, Unipile pick a proxy located near the user's IP, but you can choose a specific country or provide your own proxy."
  - The country list includes `gb` (United Kingdom).
  - Source: [v1 connection methods](https://developer.unipile.com/docs/connect-accounts)
- **[Vendor marketing]** Unipile says it is "not a Meta Partner". It frames its API as messaging interoperability under the EU Digital Markets Act, and tells clients to follow Meta's Terms and avoid "spam, mass automation, and unauthorized scraping". Source: [Unipile: Instagram API endpoints](https://www.unipile.com/instagram-api-endpoints-available-with-unipile/)
- **[Meta docs] The official route is much narrower.**
  - Meta's Instagram Messaging API works only for an "Instagram professional account".
  - An app can message someone "Only after an Instagram user has sent your app user's Instagram professional account a message."
  - Source: [Meta: Instagram Messaging API](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api)

### Inferences
- [Inferred] Because the Instagram connection is a username/password or cookie session, it should work with **personal, creator or business** Instagram accounts alike. The docs never restrict account type. Unipile's v1 profile schema classifies *target* profiles as `PERSONNAL` / `BUSINESS` / `PROFESSIONNAL` (Unipile's spelling), which suggests it reads all three.
- [Inferred] This is a private, unofficial connection: it emulates the user's own app or web session. It therefore carries terms-of-service and restriction risk that the official Meta APIs (ManyChat, Inro) do not, and it can break when Meta changes its login or encryption. See the Nov 2026 bug-fix entries in section 8.
- [Inferred] UK and EU Facebook users may hit the "subscription or ads" choice screen (`403`) at first connection. That needs a clear instruction in the coach-facing connect flow.

### Gaps
- No doc says whether Instagram accounts need to be a minimum age, or warmed up, before connecting. The only guidance is "new or inactive accounts" should ramp slowly (section 6).
- The docs don't say whether Unipile's Instagram session is a mobile-app or a web session.

---

## 3. SEARCH and IMPORT on Instagram and Facebook: what can you read?

### Takeaway
**Instagram.** You can:
- Fetch a profile by username or ID. It returns bio, follower, following and post counts, external links, and business category, email, phone and address when the account publishes them.
- Page through the followers and following of any public account (25 per page in v1).
- Read a user's posts, each post's comments and reactions, and a user's own comments and reactions.
- Import the full DM inbox and history.

You cannot search by keyword, hashtag or location.

**Facebook.** You can:
- Fetch profiles.
- List your own friends.
- List followers and following of a profile.
- Read posts, comments and reactions (as yourself or your Page).
- Import Messenger chats (past encrypted history only with the recovery code or PIN).

There is no search and no group-member listing.

### Cited Findings
- **[Docs] Instagram endpoints (v2).**
  - Profile: `getUserProfile`, `GET /v2/{account_id}/users/{user_id}`.
  - Followers: `listUserFollowers`, `GET /v2/{account_id}/users/{user_id}/followers`. Following: `listUserFollowing`.
  - "Visibility depends on Instagram privacy settings."
  - Source: [Unipile v2: Instagram users & followers](https://developer.unipile.com/v2.0/docs/instagram-users)
- **[Docs] Instagram endpoints (v1).**
  - `GET /api/v1/users/{identifier}`. The identifier "Can be the provider's internal id OR the provider's public id".
  - `GET /api/v1/users/followers` with `user_id` = "provider_id or username". `limit`: "`Instagram` 25 max… This is a ceiling, not a guarantee". `GET /api/v1/users/following`.
  - [Changelog] "Configurable followers pagination limit".
  - Sources: [v1 Retrieve a profile](https://developer.unipile.com/reference/userscontroller_getprofilebyidentifier); [v1 List followers](https://developer.unipile.com/reference/userscontroller_getfollowers); [v1 changelog](https://developer.unipile.com/changelog/last-months-update-v1-1)
- **[Docs] Instagram profile fields (v1 response schema).**
  - `provider_id`, `provider_messaging_id`, `public_identifier`, `full_name`, `biography`, `category`, `followers_count`, `mutual_followers_count`, `following_count`, `posts_count`, `profile_type` (PERSONNAL / BUSINESS / PROFESSIONNAL), `is_verified`, `is_private`, `external_links[]`.
  - `relationship_status` {following, followed_by, has_sent_invitation, has_received_invitation}.
  - `business` {category, address_street, address_city, address_zipcode, phone_number, email}.
  - Source: [v1 Retrieve a profile](https://developer.unipile.com/reference/userscontroller_getprofilebyidentifier)
- **[Docs] v2 unified profile schema.**
  - Generic fields: `type` (individual / organization), `bio`, `followers_count`, `following_count`, `emails`, `phone_numbers`, `addresses`, `websites`, `social_handles`, `is_verified`, `location`, `is_following`.
  - The Instagram-specific block holds only `messaging_identifier`. Which generic fields Instagram fills in is not stated per field.
  - Source: [v2 Get a User Profile](https://developer.unipile.com/v2.0/reference/getuserprofile)
- **[Docs] Instagram posts and activity.**
  - `getPostsList` (`GET /v2/{account_id}/users/{user_id}/posts`), `getPost`, `getPostCommentsList`, `getPostReactionsList`, `getUserCommentsList`, `getUserReactionsList`.
  - "Visibility remains subject to the connected account's access."
  - Sources: [Unipile v2: Instagram list user posts](https://developer.unipile.com/v2.0/docs/instagram-list-user-posts); v1 equivalent `GET /api/v1/users/{identifier}/posts` (identifier = "provider_id or the username"): [v1 List posts](https://developer.unipile.com/reference/userscontroller_listallposts)
- **[Changelog] Instagram reading features** were added in 2025–26:
  - "List followers, posts, and comments".
  - "get post reactions".
  - "Post data enrichment (`created_at`, `shortcode`, `url`)".
  - "Story mention parsing and `STORY_MENTION` message/event mapping".
  - Sources: [changelog](https://developer.unipile.com/changelog/last-months-update-2); [changelog](https://developer.unipile.com/changelog/last-months-update-3); [changelog](https://developer.unipile.com/changelog/last-months-update-v1)
- **[Docs] Instagram unsupported list.** "Listing sent follow requests is not supported"; profile updates limited to bio and picture; "Downloading a user picture… is not supported". Source: [Unipile v2: Instagram unsupported features](https://developer.unipile.com/v2.0/docs/instagram-unsupported-features)
- **[Docs] Instagram inbox import.**
  - `getChatsList`, `getMessagesList`, `getMessage`, and attachment download.
  - "All conversations are grouped into a single inbox."
  - Sources: [Unipile v2: Instagram chats & messages](https://developer.unipile.com/v2.0/docs/instagram-retrieve-chats-messages). v1 "Sync History" 🟢: [v1 matrix](https://developer.unipile.com/docs/list-provider-features)
- **[Changelog] Conflict on Instagram message requests.**
  - The v2.20261104.1 changelog says "Instagram — List inboxes and message requests, accept requests". Source: [v2 changelog 4 Nov 2026](https://developer.unipile.com/changelog/v2-oulook-categories-blocked-users-message-mentions)
  - But the v2 matrix (updated 13 Nov) still marks `List all Inboxes` and `Start a Chat from an Inbox` as ⚫ for Instagram. Source: [v2 provider features](https://developer.unipile.com/v2.0/docs/list-provider-features)
- **[Docs] Facebook friends and follows.**
  - "Facebook only lists the friends of the account owner, so set `me` as `user_id`. Pagination… up to 50 friends per page."
  - Followers and followings of a profile via `listUserFollowers` / `listUserFollowing`.
  - Unsupported: "Listing the friends of anyone other than the account itself", "Visiting a profile".
  - Sources: [Unipile v2: Facebook users](https://developer.unipile.com/v2.0/docs/facebook-users); [Facebook unsupported features](https://developer.unipile.com/v2.0/docs/facebook-unsupported-features)
- **[Docs] Facebook Pages.**
  - Each Page the user administers shows up as inbox `PAGE_<page_id>_INBOX`. Read it with `getInboxChatsList`.
  - Posts and comments can be read for a Page ID via `getPostsList` and others.
  - Source: [Unipile v2: Facebook Pages](https://developer.unipile.com/v2.0/docs/facebook-pages)
- **[Docs] Facebook message requests.** Message requests sit in the `PENDING` inbox. Accept one with `acceptChatRequest`: `POST /v2/{account_id}/inboxes/PENDING/chats/{chat_id}/accept`. Source: [Unipile v2: Facebook manage chats](https://developer.unipile.com/v2.0/docs/facebook-manage-chats)
- **[Docs] Reading limits on the v2 Posts API.** The `getPostsList` and comment endpoints carry "LIMITATIONS: On Facebook, the page size i[s]…" notes; the full text is truncated in the index. Source: [v2 docs index](https://developer.unipile.com/v2.0/llms.txt)

### Inferences
- [Inferred] With the `business` block (email, phone, category, city), Instagram profile lookups can qualify UK business owners: category, a public business email, and a UK city. But only for accounts that publish those fields, and only after a seed list exists.
- [Inferred] At 25 followers per page and a guide of 100 actions a day, pulling large follower lists through one coach's account is slow and risky. A 5,000-follower seed account is about 200 calls. Followers are better pulled with a dedicated scraper (section 10), keeping Unipile for messaging.

### Gaps
- Whether each Instagram follower or following call counts toward the "100 actions/day" guide. The guide names "following, outreach, liking and commenting" but is silent on reads.
- Facebook page sizes and visibility limits for followers and posts are truncated in the index; I did not open each reference page.
- There are no Instagram hashtag or location endpoints. `Find locations for Instagram posts` only resolves location IDs for *publishing*: [Unipile v2: Instagram search locations](https://developer.unipile.com/v2.0/docs/instagram-search-locations).

---

## 4. SEND: cold DMs, media, follow/like/comment, message requests

### Takeaway
**Instagram.**
- Unipile can start a brand-new DM with someone who has never messaged you (`startChat` with the recipient's `messaging_identifier`).
- It can send text, images, video, files, voice notes and replies, and edit within 15 minutes.
- It can follow and unfollow, like, comment and reply to comments.
- **Instagram's own rule still applies** (Meta change, Aug 2023): someone who doesn't follow you gets **one text-only message request**. Further messages, images, video or voice notes are blocked until they accept.

**Facebook.**
- A personal profile can start a DM. It fails with `provider/access_restricted` if Facebook doesn't allow it.
- A **Page cannot** start a conversation; it can only reply.
- Friend requests can't carry a note. Follows, comments and reactions are supported.

### Cited Findings
- **[Docs] Instagram start chat and send.**
  - "You do not yet have a conversation with the recipient, so you create a new chat and send the first message with Start a Chat." Use `users_ids: ["<messaging_identifier>"]`.
  - "use the recipient's `messaging_identifier` rather than the profile `id`."
  - "Instagram conversations supported by this integration are individual conversations."
  - Endpoints: `startChat` = `POST /v2/{account_id}/chats/send`; `sendMessage` = `POST /v2/{account_id}/chats/{chat_id}/messages/send`.
  - Source: [Unipile v2: Instagram send messages](https://developer.unipile.com/v2.0/docs/instagram-send-messages) (updatedAt 2026-11-13)
- **[Docs] v1 equivalent.**
  - `POST /api/v1/chats` (`ChatsController_startNewChat`). For `instagram`, attendees use "the 'provider_messaging_id'".
  - Voice: "Instagram: use the attachment field and prefer .m4a".
  - Send in an existing chat: `POST /api/v1/chats/{chat_id}/messages`.
  - Source: [v1 Start a new chat](https://developer.unipile.com/reference/chatscontroller_startnewchat)
- **[Docs] Instagram attachments.**
  - "Any file with a MIME type starting with `image/` or `video/` will be sent as media with an inline preview."
  - Replies with `quote_id`; forward messages.
  - "Message editing is only available within 15 minutes after the original send time."
  - v2 attachment options: `send_mode: "native"` for voice notes, with optional `waveform` metadata.
  - Sources: [Unipile v2: Instagram send messages](https://developer.unipile.com/v2.0/docs/instagram-send-messages); [v2 Start a Chat reference](https://developer.unipile.com/v2.0/reference/startchat)
- **[Changelog] Instagram send features.** "More supported attachment types (voice/video/link/carousel/story/PDF/video)". Source: [changelog](https://developer.unipile.com/changelog/last-months-update-3)
- **[Docs] Instagram follow, like and comment.**
  - v2: `followUser` = `POST /v2/{account_id}/users/me/follow/{user_id}`. "If the User has a private profile, this will create a Follow Request." Also `unfollowUser`, `addPostReaction`, `addPostComment`, `replyToComment`, `createPost`, `createStory`.
  - v1: follow = `POST /api/v1/users/invite` ("`Instagram`: You can use the provider_id or the username… The provider_messaging_id dont work on this route"). Unfollow = `DELETE /api/v1/users/invite/sent/{invitation_id}` ("`Instagram`: You can also use this route to unfollow"). Comment = `POST /api/v1/posts/{post_id}/comments` ("`Instagram`: You can mention users by inserting their username… like @username").
  - Sources: [v2 Follow a User](https://developer.unipile.com/v2.0/reference/followuser); [v1 Send invitation](https://developer.unipile.com/reference/userscontroller_adduserbyidentifier); [v1 Cancel invitation](https://developer.unipile.com/reference/userscontroller_cancelinvitation); [v1 Comment a post](https://developer.unipile.com/reference/postscontroller_sendcomment)
- **[Docs] Small doc conflict on v1 invites.** The v1 "Invite users" guide header says "Feature available for: Linkedin", while the v1 matrix and the invite reference both cover Instagram. Source: [v1 Invite users guide](https://developer.unipile.com/docs/invite-users) (updatedAt 2026-03-16)
- **[Press] Instagram's cold-DM rule (Aug 2023, older than 2025, may have changed).**
  - For non-followers, "you will now only be able to send them one message… only be able to continue to send them DMs once they accept your request to chat."
  - "DM invites are now limited to text only… you can only send images, videos or voice notes to someone who doesn't follow you after they've accepted."
  - Sources: [TechCrunch, 3 Aug 2023](https://techcrunch.com/2023/08/03/instagrams-new-feature-protects-users-from-unwanted-images-and-videos-in-dms); [Engadget](https://www.engadget.com/instagram-fights-dm-spam-with-limits-on-text-and-photos-165013992.html)
- **[Meta docs] Message requests folder (official API).** "All new conversations from Instagram users who aren't followers of your app user will appear in the Requests folder." "Messages in the Requests folder that have not been active for 30 days will not be returned in API calls." Source: [Meta: Instagram Messaging API](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api)
- **[Docs] Facebook start chat.**
  - "use Start a Chat and pass the ID of a person or a Page in `users_ids`." "If Facebook does not allow the account to message this person, the request fails with `provider/access_restricted`."
  - "A Facebook Page can't start a conversation: it can only reply in its existing chats." `startChatFromInbox` on a Page inbox returns `501 api/not_implemented`.
  - "A `200` response means that the message was accepted, not that Facebook delivered it… wait for the matching message.new webhook."
  - On encrypted chats, "each file is sent as a separate message".
  - Sources: [Unipile v2: Facebook send messages](https://developer.unipile.com/v2.0/docs/facebook-send-messages); [Facebook Pages](https://developer.unipile.com/v2.0/docs/facebook-pages)
- **[Docs] Facebook friend requests.**
  - Sent with `createRelationRequest` (`POST /v2/{account_id}/users/me/relation-requests`). "Facebook friend requests carry no message: setting `message` returns `400`."
  - "The `relation.new` event is not available on Facebook. To detect new friends, poll" `getUserRelations`.
  - Source: [Unipile v2: Facebook users](https://developer.unipile.com/v2.0/docs/facebook-users)
- **[Docs] Facebook posting as a user or a Page.** Use `post_as`, `comment_as`, `react_as`. Unsupported: Facebook stories, "Mixing photos and a video in a post", GIFs in comments. Sources: [Facebook Pages](https://developer.unipile.com/v2.0/docs/facebook-pages); [Facebook unsupported features](https://developer.unipile.com/v2.0/docs/facebook-unsupported-features)
- **[Docs] Sending several messages in a row.**
  - Nothing in the API blocks back-to-back sends.
  - Unipile's general advice on both Instagram and Facebook: "Incorporate realistic delays between outbound messages to mimic human behavior."
  - Unipile's v2 rate limiter caps volume per route (section 6).
  - Sources: [Instagram send messages](https://developer.unipile.com/v2.0/docs/instagram-send-messages); [Facebook send messages](https://developer.unipile.com/v2.0/docs/facebook-send-messages)
- **[Vendor marketing] Voice in outreach.** Unipile markets sending "pre-recorded audio messages to leads as part of your outreach sequence" on Instagram. Source: [Unipile: Instagram API endpoints](https://www.unipile.com/instagram-api-endpoints-available-with-unipile/)

### Inferences
- [Inferred] A workable Instagram cold sequence is:
  1. Optionally follow and like a post (warm-up).
  2. Send **one short text-only DM** with `startChat`.
  3. Wait for acceptance or a reply (the `message.new` webhook, or the chat appearing in the main inbox).
  4. Only then send the voice note, Loom-style video or link follow-ups.

  Sending a voice note or a second message to a non-follower who hasn't accepted will probably fail or be dropped. Unipile's docs don't describe the error, so test before relying on it.
- [Inferred] On Facebook, cold DMs from a non-friend land in the recipient's message requests. Prospecting from a coach's **business Page is impossible** through Unipile, because Pages can't initiate. Only the coach's personal profile can.
- [Inferred] Unipile's "voice note" marketing applies cleanly only *inside* accepted threads on Instagram.

### Gaps
- The exact error Unipile returns when Instagram rejects a second or media message to a non-accepting non-follower is undocumented.
- Whether the 2023 Instagram rule has changed since then: no 2025–26 source checked, flagged as possibly outdated.
- Facebook voice notes are not explicitly documented. Attachments are generic. The v1 matrix that lists voice notes has no Facebook column.
- How the recipient sees a Facebook message request from a non-friend (the "Message requests" vs "Spam" folder) is not described by Unipile. I found no Meta source for this in this pass.

---

## 5. WhatsApp, Telegram, email and X: specifics

### Takeaway
**WhatsApp.**
- Works on any normal WhatsApp or WhatsApp Business **app** number, linked as a device. It is not the WhatsApp Business (Cloud) API.
- It **can message any number that has never messaged first**, send voice notes, and check whether a number is on WhatsApp.
- It **cannot send Business API templates** or use WhatsApp Business features apart from Labels.

**Telegram.** QR login, cold DMs, voice notes. No read-receipt webhook.

**Email.** Gmail and Outlook use OAuth, other providers use IMAP. Send, reply, list, drafts, open and click tracking.

**X/Twitter.** Not available: deprecated in v1, "coming soon" in v2.

### Cited Findings
- **[Docs] WhatsApp cold messaging.**
  - "For a new WhatsApp recipient known only by phone number… `+33 44 55 66 77 88` → `334455667788@s.whatsapp.net`."
  - "Check whether a phone number uses WhatsApp": `getUserProfile` returns `200` (exists) or `404`.
  - "WhatsApp allows only one individual chat per user."
  - Source: [Unipile v2: WhatsApp send messages](https://developer.unipile.com/v2.0/docs/whatsapp-send-messages) (updatedAt 2026-11-13)
- **[Docs] WhatsApp attachments.**
  - "WhatsApp only allows a single attachment per message"; several attachments are sent as separate messages.
  - Formatting is supported.
  - [Changelog] "Send voice messages"; "Improved voice-note compatibility through automatic OGG/Opus conversion"; native contact cards (vCard).
  - Sources: [WhatsApp send messages](https://developer.unipile.com/v2.0/docs/whatsapp-send-messages); [changelog](https://developer.unipile.com/changelog/last-months-update-2); [v2 changelog 13 Nov](https://developer.unipile.com/changelog/v2202611131-better-onboarding-disappearing-messages-controls-additional-auth-checkpoints); [v2 changelog 4 Nov](https://developer.unipile.com/changelog/v2-oulook-categories-blocked-users-message-mentions)
- **[Docs] WhatsApp unsupported.**
  - "Any business related features as mentioned in [WhatsApp Business FAQ] is not supported (Products, Quick replies...) except Labels."
  - Channels, Communities and Broadcasts are not listed. You cannot start calls.
  - Source: [Unipile v2: WhatsApp unsupported](https://developer.unipile.com/v2.0/docs/whatsapp-unsupported-features)
- **[Changelog] Templates.** "WhatsApp — Fixed the mapping of Business templates sent as interactive messages", meaning templates *received* from businesses are mapped. Sending templates is not documented. Source: [v2 changelog 4 Nov 2026](https://developer.unipile.com/changelog/v2-oulook-categories-blocked-users-message-mentions)
- **[Changelog] WhatsApp account restrictions.** "Credentials webhook can expose reachout time-lock info (`reachoutTimeLock`)"; "Better public errors for account restriction / send failures". Source: [v1 changelog](https://developer.unipile.com/changelog/last-months-update-v1)
- **[Docs] WhatsApp migration to v2.** "Existing sessions are preserved during the migration, except for WhatsApp accounts. WhatsApp accounts must be reconnected in V2." Source: [Unipile: Transfer accounts & subscription](https://developer.unipile.com/v2.0/docs/transfer-accounts-subscription)
- **[Press] WhatsApp Business API AI policy.**
  - The Business Solution terms barred "general-purpose AI assistants" and LLM providers.
  - Applied to new Business API users from 15 Oct 2025 and to all users from **15 Jan 2026**.
  - Support, sales and notification bots remain allowed.
  - Sources: [TechCrunch, 18 Oct 2025](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform); [respond.io](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban)
- **[Docs] Telegram.**
  - Feature matrix: send, start chat, voice notes, profiles, "Is number on?" 🟢. Retrieve own profile 🔴 (v1). Read-receipt webhook 🔴 and `message.delete` 🔴 (v2).
  - Unsupported: channels and broadcasts, secret chats, archiving.
  - The provider limits pages (v1 and v2) have **no Telegram section**.
  - Sources: [v1 matrix](https://developer.unipile.com/docs/list-provider-features); [v2 matrix](https://developer.unipile.com/v2.0/docs/list-provider-features); [Telegram unsupported](https://developer.unipile.com/v2.0/docs/telegram-unsupported-features) (updatedAt 2026-02-06)
- **[Docs] Email.**
  - Google and Microsoft: OAuth (Unipile's Google OAuth app included at no extra fee). IMAP: credentials.
  - Send and reply, list, drafts, move and delete, folders.
  - Webhooks: new email, open and click tracking, plus `mail_moved` and `email.update` (Outlook categories).
  - Contacts listing for Gmail and Microsoft.
  - Unsupported: permanently deleting individual emails; managing the Outlook master category list.
  - Sources: [v1 matrix](https://developer.unipile.com/docs/list-provider-features); [v2 billing](https://developer.unipile.com/v2.0/docs/billing); [v2 email unsupported](https://developer.unipile.com/v2.0/docs/email-unsupported-features)
- **[Docs] X/Twitter.** "X/Twitter is deprecated in v1 and is no longer maintained in this version. X/Twitter support is coming soon in v2." Source: [Unipile v1 X guide](https://developer.unipile.com/docs/twitter-x-guide) (updatedAt 2026-10-30). The pricing page lists X as "Coming soon": [Unipile pricing](https://www.unipile.com/pricing/)

### Inferences
- [Inferred] Unipile's WhatsApp is an unofficial linked-device session, not the Business API. The Jan 2026 Business API rules (templates, the 24-hour window, the AI-chatbot ban) therefore don't technically govern it. Instead it carries WhatsApp's own anti-spam enforcement on the personal or Business app account (section 6). For UK B2B cold outreach to mobile numbers, PECR and GDPR also apply.
- [Inferred] A coach's AI assistant (Ava) drafting messages a human approves is closer to the allowed "sales/support" use. But on an unofficial session, ban risk depends on behaviour (unanswered new chats, block reports), not policy text.

### Gaps
- Unipile publishes no Telegram rate limits or safe volumes.
- Whether WhatsApp Business *app* accounts behave differently from personal accounts through Unipile beyond Labels is not documented.

---

## 6. Limits, safe volumes and ban risk

### Takeaway
Unipile's guidance:
- **Instagram:** at most **100 actions a day and 10 an hour**, spaced randomly; replies to inbound messages are unlimited.
- **Facebook:** **10–50 requests a day**. DMs ramp from **15 a day, plus 5 a week, to 50 a day**. Friend requests only to people with more than 10 mutual friends.
- **WhatsApp:** aged real accounts only. Fresh accounts are "blocked after only 2–3 new chats". Wait up to 24 hours after connecting, and leave 10–20 seconds between messages.

v2 adds a configurable Unipile-side rate limiter that rejects calls with a 429 before they reach the provider. I found **no independent user reports** quantifying Unipile ban rates on Instagram or Facebook.

### Cited Findings
- **[Docs] Instagram limits (v2, updatedAt 2026-11-20).**
  - "Any action (following, outreach, likes, comments…): 100 per day and 10 per hour." "Replies to inbound messages: No limit."
  - "For new or inactive accounts, begin with lower activity levels." "space out all actions randomly… across multiple time slots during working hours."
  - Source: [Unipile v2 provider limits](https://developer.unipile.com/v2.0/docs/provider-limits-and-restrictions)
- **[Docs] Unipile's claim about Instagram warnings (vendor opinion, unverified).** Instagram may show "We suspect automated behavior on your account." "You can ignore this message and continue using automation: we have not observed additional account restrictions or negative consequences." Sources: [Unipile v2 provider limits](https://developer.unipile.com/v2.0/docs/provider-limits-and-restrictions); same wording in [v1 limits](https://developer.unipile.com/docs/provider-limits-and-restrictions)
- **[Docs] Facebook limits.**
  - "All requests: 10 to 50 per day."
  - "Friend requests: Up to 50 per day, only to people with more than 10 mutual connections."
  - "DMs: Start at 15 per day, add 5 each week, up to 50 per day."
  - "Never retry a failed login automatically."
  - "going over 50 per day puts the account at risk."
  - Source: [Unipile v2 provider limits](https://developer.unipile.com/v2.0/docs/provider-limits-and-restrictions)
- **[Docs] WhatsApp limits.**
  - "Fresh accounts: Can be blocked after only 2–3 new chats: warm them up over several days."
  - "After connecting or reconnecting: Wait up to 24 hours before creating new chats."
  - "At least 10–20 seconds" between messages.
  - "Too many new chats without replies, or many spam/block reports, can temporarily restrict the account."
  - Source: [Unipile v2 provider limits](https://developer.unipile.com/v2.0/docs/provider-limits-and-restrictions)
- **[Docs] LinkedIn, for comparison.**
  - Unipile's default rate limiter: "All methods… 10 per minute and 100 per day"; Get a User Profile 1 per second; Send a Relation request "1 every 10 seconds and 50 per day".
  - LinkedIn's own recommended limits: 80–100 invitations a day (paid), about 100 profile retrievals a day, up to 1,000 or 2,500 search results a day.
  - Source: [Unipile v2 provider limits](https://developer.unipile.com/v2.0/docs/provider-limits-and-restrictions)
- **[Docs] v2 rate limiter mechanics.**
  - "Unipile enforces its own rate limiting at the Methods API level." Rejections return `429 api/too_many_requests` with `retry-after` and `x-ratelimit-*` headers.
  - `provider/too_many_requests` means the provider throttled the call.
  - Defaults are "recommended" per provider, adjustable under Dashboard → Configuration → Rate limits. Up to two time windows per rule. Cached reads don't count.
  - Source: [Unipile v2 rate limits](https://developer.unipile.com/v2.0/docs/rate-limits) (updatedAt 2026-11-18)
- **[Docs] Account status.**
  - v1: the "most critical status is CREDENTIALS, which requires user action to reconnect"; set up an account-status webhook. Source: [v1 connection methods](https://developer.unipile.com/docs/connect-accounts)
  - [Changelog] "Public credentials/account-status reasons for Instagram, including rate-limit cases". Source: [v1 changelog](https://developer.unipile.com/changelog/last-months-update-v1)
- **[User report] Independent evidence is thin.**
  - My web search found no Reddit or indie-hacker threads about Unipile on Instagram or Messenger.
  - The closest evidence is ManyChat community threads: users blame an official-API tool for Instagram bans, and moderators reply that user behaviour, not the tool, broke policy.
  - Source: [ManyChat community: account disabled due to automation](https://community.manychat.com/general-q-a-43/instagram-business-account-disabled-due-to-automation-10161)

### Inferences
- [Inferred] Per coach account, a safe Instagram outbound budget is roughly 30–60 *new* conversations a day. That counts follows and likes against the same 100-a-day, 10-an-hour cap: one prospect costs about 2–3 actions (follow + like + DM). Facebook is lower still, at about 15 DMs a day in the first weeks. Both are far below LinkedIn's invitation volumes.
- [Inferred] A central model where BCA runs lead gen *for* coaches would need each coach's own aged Instagram or Facebook account connected. Pooling volume through a few BCA-owned accounts would concentrate ban risk.

### Gaps
- v2's *default* rate-limiter values for Instagram and Facebook are only shown in the Dashboard, not published in the docs. The docs publish LinkedIn's only.
- No figures for ban or restriction rates, or for how often Instagram or Facebook sessions disconnect through Unipile.

---

## 7. Webhooks

### Takeaway
New messages, edits, deletes, reactions and read receipts are covered on Instagram, Facebook, WhatsApp and LinkedIn. Facebook alone adds delivery receipts. Telegram has no read receipts. Account-status and lifecycle events cover disconnections on every channel. **There are no new-follower or new-friend webhooks on Instagram or Facebook**, unlike LinkedIn's `relation.new`, so acceptance has to be detected by polling or from replies.

### Cited Findings
- **[Docs] v2 event matrix.**

  | Event | Instagram | Facebook | WhatsApp | Telegram | LinkedIn C/S/R |
  |---|---|---|---|---|---|
  | `message.new` | 🟢 | 🟢 | 🟢 | 🟢 | all three |
  | `message.update` | 🟢 | 🟢 | 🟢 | 🟢 | all three |
  | `message.delete` | 🟢 | 🟢 | 🟢 | 🔴 | all three |
  | `message.receipt.read` | 🟢 | 🟢 | 🟢 | 🔴 | Classic, Sales Navigator |
  | `message.receipt.delivery` | 🔴 | 🟢 only | 🔴 | 🔴 | — |
  | `message.reaction.new` | 🟢 | 🟢 | 🟢 | 🟢 | — |
  | `chat.update`, `chat.delete` | 🟢 | 🟢 | 🟢 | 🔴 | — |

  - Users API events: `blocked.new` for Instagram, WhatsApp, Telegram and LinkedIn (🔴 Facebook). `relation.new` and `follower.new` are LinkedIn only (🔴 Instagram and Facebook).
  - Source: [Unipile v2 provider features](https://developer.unipile.com/v2.0/docs/list-provider-features)
- **[Docs] Instagram events.** Realtime events to listen for: "`message.new`, `message.update`, `message.delete`, `message.reaction.new`". Source: [Instagram chats & messages](https://developer.unipile.com/v2.0/docs/instagram-retrieve-chats-messages)
- **[Docs] Facebook Page events.** "Webhook events of a Page carry the Page-scoped `chat_id`." Each Page has its own connection status under `metadata.products_connection_status`, and the account status becomes `partial` or `degraded` if a Page drops. Source: [Facebook Pages](https://developer.unipile.com/v2.0/docs/facebook-pages)
- **[Docs] Account lifecycle.**
  - Billing locks emit `account.locked` and `account.unlocked`. Source: [v2 billing](https://developer.unipile.com/v2.0/docs/billing)
  - WhatsApp emits `account.initial_sync.completed`. Source: [v2 Link WhatsApp](https://developer.unipile.com/v2.0/docs/link-whatsapp-accounts)
  - v1 has an "Account status" webhook for WhatsApp, LinkedIn, Instagram and Telegram. Source: [v1 matrix](https://developer.unipile.com/docs/list-provider-features)
- **[Docs] Migration and signing.**
  - Webhooks are not copied when migrating from v1 to v2 and must be recreated. Source: [Transfer accounts & subscription](https://developer.unipile.com/v2.0/docs/transfer-accounts-subscription)
  - v2 adds "Webhooks signatures" and debugging tools. Source: [Migration from v1](https://developer.unipile.com/v2.0/docs/migration-from-v1)

### Inferences
- [Inferred] For an Instagram sequence, the trigger for "they accepted or replied" is `message.new` from that person's `chat_id`. There is no follow-back event, so poll `getUserProfile` (`relationship_status.followed_by` in v1) sparingly.

### Gaps
- I found no explicit list of v2 `account.*` status event names for disconnection beyond those above. A `status-lifecycle` page exists but was not fetched.

---

## 8. Pricing, versions, and changes or deprecations in 2025–2026

### Takeaway
**Pricing:**
- One per-account price for every channel. **€49 a month (US$55) covers up to 10 accounts.**
- Beyond that, €5.00 per account per month for 11–50 accounts, falling to €3.00 above 5,000.
- No usage fees. A 7-day trial with no card needed. Billing is post-paid on the peak number of connected accounts.

**Biggest 2026 change:** the v2 API (beta mid-2026; GA changelog entries in Nov 2026). It holds all new features. Facebook/Messenger lives only there. And for LinkedIn, v2 **stops storing chats**, so message reads count against rate limits. v1 has no deprecation date.

### Cited Findings
- **[Vendor marketing] Price tiers.** Up to 10 accounts €49 total; 11–50 €5.00 each; 51–200 €4.50; 201–1,000 €4.00; 1,001–5,000 €3.50; 5,001+ €3.00 (USD $55 / 5.50 / 5.00 / 4.50 / 4.00 / 3.50).
  - "Same price for every provider."
  - The worked example implies the tier rate applies to *all* accounts: 60 accounts × €4.50 = €270.
  - Ex-VAT, post-paid, billed on the peak number of simultaneously linked accounts.
  - A Gmail or Outlook account with mail and calendar counts as one.
  - Source: [Unipile pricing](https://www.unipile.com/pricing/)
- **[Docs] v2 billing.**
  - "Pricing is based solely on the number of accounts connected… no usage-based fees."
  - Development and test accounts are billed the same as production.
  - Trial organisations are capped at 10 accounts.
  - An account limit can be set as a safety cap.
  - Source: [Unipile v2 billing](https://developer.unipile.com/v2.0/docs/billing) (updatedAt 2026-11-18)
- **[Docs] Running v1 and v2 together.**
  - "We bill only the highest usage peak between V1 and V2", if you transfer the subscription.
  - Migrated accounts get new IDs (`metadata.v1_account_id`). Migration is a copy, not a move. WhatsApp must be reconnected.
  - Source: [Transfer accounts & subscription](https://developer.unipile.com/v2.0/docs/transfer-accounts-subscription)
- **[Docs] v1 status.** "Unipile V1 is not deprecated… there is no deprecation date. Of course, new features will only be added to V2." Source: [Migration from v1](https://developer.unipile.com/v2.0/docs/migration-from-v1)
- **[Docs] LinkedIn behaviour change in v2 (matters for the existing integration).** "In API v1, Unipile synchronized all the chats and messages of LinkedIn accounts and stored them… In API v2, Unipile doesn't store this data anymore… Reading chats and messages therefore counts toward the rate limits." The default is 10 per minute and 100 per day per route. Source: [Unipile v2 provider limits](https://developer.unipile.com/v2.0/docs/provider-limits-and-restrictions)
- **[Docs] Deprecations.** Messenger: "deprecated in v1 and available in v2". X: "deprecated in v1… coming soon in v2". Sources: [v1 Messenger guide](https://developer.unipile.com/docs/messenger); [v1 X guide](https://developer.unipile.com/docs/twitter-x-guide)
- **[Changelog] 2025–26 Instagram timeline.**
  - "Revamped connection and synchronization"; create post; list followers, posts and comments (around late 2025, alongside "SOC II certification official as of October 18").
  - Then: invitations list, accept and decline; post reactions; story posts.
  - Then: UniLogin; edit bio and picture.
  - v2 4 Nov 2026: inboxes and message requests; block and unblock.
  - v2 13 Nov 2026: number-matching checkpoints; "Correctly requests owner action on instagram.com when an inbox checkpoint cannot be resolved automatically".
  - Sources: [changelog](https://developer.unipile.com/changelog/last-months-update-2); [changelog](https://developer.unipile.com/changelog/last-months-update-3); [changelog](https://developer.unipile.com/changelog/last-months-update-v1); [changelog](https://developer.unipile.com/changelog/last-months-update-v1-1); [v2 4 Nov](https://developer.unipile.com/changelog/v2-oulook-categories-blocked-users-message-mentions); [v2 13 Nov](https://developer.unipile.com/changelog/v2202611131-better-onboarding-disappearing-messages-controls-additional-auth-checkpoints)
- **[Changelog] Fragility signals on Facebook (13 Nov 2026).**
  - "Fixed encrypted-history access and PIN recovery failures after Facebook updates its encryption components."
  - "Corrected account status when a session expires while the connection still appears active."
  - "Restored connections after routine socket closures."
  - 4 Nov: "Facebook, Instagram — Fixed account connection and checkpoint handling in several login flows."
  - Sources: [v2 13 Nov](https://developer.unipile.com/changelog/v2202611131-better-onboarding-disappearing-messages-controls-additional-auth-checkpoints); [v2 4 Nov](https://developer.unipile.com/changelog/v2-oulook-categories-blocked-users-message-mentions)
- **[Meta docs] Official-API rules, for contrast.**
  - The window is "For most user actions, it lasts 24 hours", or up to 7 days after a Click-to-Direct or Click-to-Messenger ad.
  - HUMAN_AGENT gives "a separate 7-day period" for manual replies.
  - Automated chats must disclose automation where the law requires it.
  - Automated bots must respond "within 30 seconds".
  - Sources: [Meta Messenger Platform & IG Messaging policy](https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy); [Meta Instagram Messaging API](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api)
- **[Press] WhatsApp Business API** general-purpose AI-chatbot ban, effective 15 Jan 2026 for existing users. Source: [TechCrunch](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform)

### Inferences
- [Inferred] Cost is not the constraint. If each coach connects LinkedIn plus Instagram plus Facebook, that is 3 accounts per coach at about €4–5 each, so roughly £11–13 per coach per month at 51–200 accounts. The real constraints are the v2 migration work and per-account ban risk.
- [Inferred] Adding Facebook means opening a v2 organisation. The cleanest path is to transfer the subscription (billed on peak) and run v1 LinkedIn alongside v2 Instagram and Facebook during migration. Migrating LinkedIn to v2 later changes inbox-read economics: webhooks stop being optional.
- [Inferred] Meta's 24-hour window and HUMAN_AGENT rules apply to the official APIs. Unipile sidesteps them by acting as the user's own session. That is exactly why it can cold DM, and also why it carries account risk the official tools don't.

### Gaps
- The pricing page is undated. There was no sign of channel surcharges, but the page could change.
- No published Unipile policy on what happens to customers if Meta takes legal or technical action against private access.

---

## 9. Competitors and alternatives if Unipile falls short on Instagram or Facebook

### Takeaway
**Official-API tools: ManyChat, Inrō.**
- Safe and Meta-approved for professional accounts.
- **Inbound only**: comment-to-DM, story replies, mentions, ads, incoming DMs, within the 24-hour and 7-day windows. They cannot cold DM.

**Scraping tools: Apify actors, PhantomBuster.**
- They fill Unipile's real gap, **discovery**: hashtag and keyword search, follower lists with emails, and Facebook group members (PhantomBuster, about 4–5k per group).
- They carry terms-of-service and scraping risk.

**Practical pairing:** scraper for list-building → Unipile for follow, like and DM from the coach's own account → official tools for inbound comment-to-DM.

Competitor facts below come mostly from search-result snippets of the vendors' own pages. I did not open each page in full, so treat them as unverified vendor claims.

### Cited Findings
- **ManyChat.**
  - The Human Agent tag "allows you to continue conversations… after the standard 24-hour window has closed, as long as the message is sent manually by a human agent", for up to 7 days. "Automated messages are not allowed during the 7-day window." Source: [ManyChat help: Human Agent tag](https://help.manychat.com/hc/en-us/articles/14281199732892)
  - [User report] HUMAN_AGENT via API returned "Unsupported message tag" (June 2025). Source: [ManyChat community](https://community.manychat.com/general-q-a-43/instagram-api-issue-getting-unsupported-message-tag-for-human-agent-and-silent-delivery-failure-with-other-tags-any-ideas-6434)
  - ManyChat is described by its moderators as an official Meta partner working inside Meta's API guidelines. Source: [ManyChat community thread](https://community.manychat.com/general-q-a-43/instagram-business-account-disabled-due-to-automation-10161)
- **Meta's rule that limits all official-API tools.** Messages can be sent "Only after an Instagram user has sent your app user's Instagram professional account a message." Source: [Meta Instagram Messaging API](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api)
- **Inrō.**
  - Instagram-first DM automation and AI agent. Triggers: comments, story replies, mentions, incoming DMs, ads. Built-in CRM. Integrations: Calendly, Zapier, Make, Shopify, Stripe.
  - Markets itself as "Meta-approved".
  - No evidence found of cold outbound to people who haven't engaged.
  - Sources: [Inrō site](https://inro.social); [Product Hunt: Inrō](https://www.producthunt.com/products/inro); [ColdIQ listing](https://coldiq.com/tools/inro)
- **PhantomBuster.**
  - Instagram Follower Collector exports an account's followers to CSV, through PhantomBuster's browser extension session. Also an Instagram Following Collector.
  - Facebook Group Members Export works on groups you're in or public groups. "Facebook only displays about 4,000–5,000 members per group."
  - Search results also list Instagram Auto Follow, Auto Liker and Auto Commenter phantoms. I found no Instagram auto-DM phantom.
  - Sources: [PhantomBuster Instagram Follower Collector](https://phantombuster.com/automations/instagram/7175/instagram-follower-collector); [PhantomBuster Facebook Group Members Export help](https://support.phantombuster.com/hc/en-us/articles/26971138918802-How-to-Use-the-Facebook-Group-Members-Export); [PhantomBuster automation store](https://phantombuster.com/api-store)
- **Apify actors** (community-built, vendor claims):
  - Profile scraper with parsed email and phone at "$0.004 per profile".
  - Actors surfacing `business_email`, `business_phone_number` and `category` "only when Instagram publishes those fields".
  - Follower scrapers that keep only profiles with a public email.
  - Hashtag-to-email discovery.
  - An all-in-one actor noting "Instagram blocks datacenter IPs. Residential proxies are required."
  - Sources: [Apify khadinakbar/instagram-profile-scraper](https://apify.com/khadinakbar/instagram-profile-scraper); [Apify dltik/instagram-scraper](https://apify.com/dltik/instagram-scraper); [Apify afanasenko/instagram-followers-scraper](https://apify.com/afanasenko/instagram-followers-scraper); [Apify instaprism/instagram-hashtag-to-emails](https://apify.com/instaprism/instagram-hashtag-to-emails); [Apify get-leads/all-in-one-instagram-scraper](https://apify.com/get-leads/all-in-one-instagram-scraper)

**What each can do that Unipile cannot:**

| Tool | Can do that Unipile can't | Can't do that Unipile can |
|---|---|---|
| ManyChat / Inrō (official Meta API) | Comment-to-DM and story-reply automations; Click-to-DM ad flows; compliant at scale on professional accounts; no password sharing | Cold DM non-engagers; work on personal accounts; follow, like and comment as the user |
| PhantomBuster | Facebook group member export; packaged Instagram follower and following CSV exports | Real-time inbox, webhooks, a unified messaging API |
| Apify actors | Hashtag, keyword and location discovery; email and phone extraction at scale; no coach account needed for public data | Sending anything; acting as the coach |

### Inferences
- [Inferred] For BCA's model, the best fit is:
  1. Build lists with Apify or PhantomBuster, run outside coach accounts where possible.
  2. Qualify with Unipile `getUserProfile`: UK city, business category, follower count.
  3. Run a low-volume, human-paced follow → like → one text DM → voice-note-after-accept sequence through Unipile on each coach's own account.
  4. Optionally add ManyChat or Inrō for inbound comment-to-DM on coaches' posts.
- [Inferred] Facebook prospecting is the weakest link everywhere: no search in Unipile, group exports capped at about 5k, Pages unable to initiate, and DMs capped at about 15–50 a day. Instagram is the more viable second channel after LinkedIn.

### Gaps
- I did not verify current pricing, uptime or terms for PhantomBuster, Apify actors, Inrō or ManyChat in this pass.
- I found no head-to-head reports from builders comparing Unipile's Instagram DM delivery or ban rates with other private-API tools.
