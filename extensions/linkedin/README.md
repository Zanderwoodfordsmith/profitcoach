# Profit Coach for LinkedIn (Chrome extension)

Save LinkedIn profiles into your Profit Coach pipeline, score ICP fit, draft connect notes / DMs / feed comments / message replies, send connection requests (single profile or Sales Nav batch), and sync Sales Navigator cookies for lead imports.

Lives under `extensions/linkedin/`. Separate Chrome build artifact — not part of the Next.js bundle.

Side panel uses bottom tabs: **Profile** · **Connect** · **Tools** · **Settings**.

## Load unpacked (dev)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder (`extensions/linkedin`)
4. Sign into Profit Coach (same browser). Local default: `http://localhost:3002`
5. Open a LinkedIn profile (`/in/…`) or Sales Nav lead (`/sales/lead/…`) → side panel **Profile** tab shows ICP fit + Save / draft notes
6. **Test Connect:** open a 2nd/3rd-degree profile → **Connect** tab → **Connect this profile** (optional note). Or draft a connection note on Profile → **Use for Connect**
7. **Sales Nav batch:** open a people search or lead list → Connect tab → set a low **Max this run** → **Start**. Keep that tab open; daily cap defaults to 25
8. On the feed: **PC comment** on a post → Insert → you click Post
9. In Messaging: **PC reply** → Insert → you click Send
10. **Tools** tab: sync recent LI Messaging threads to admin inbox

After editing extension files, hit **Reload** on the extension card.

## Auth & membership

- The extension reads your Supabase access token from an open Profit Coach tab.
- Save / Draft call `/api/coach/extension/*` and require `nav.marketing` (programme / Premium / VIP when tier enforcement is on).
- Soft launch: `EXTENSION_LINKEDIN_ALLOWED_EMAILS` (default Zander only). Set to `*` or `all` to open to every entitled coach.

Sales Nav session save still uses `/api/sales-nav-session` (Lead Finder admin allowlist).

## Chrome Web Store

See **[PUBLISH.md](./PUBLISH.md)**. Listing copy: **[STORE_LISTING.md](./STORE_LISTING.md)**.

```bash
npm run pack:linkedin-extension
# → extensions/dist/profit-coach-linkedin-<version>.zip
```

## How it works

- Content scripts on `linkedin.com/in/*` and Sales Nav `sales/lead|people/*` extract visible profile fields
- `content-profile-connect.js` sends a single invite from the open profile / lead page
- `content-sales-nav-connect.js` on `sales/search/people` and `sales/lists/people` paces More → Connect → Send
- Side panel → `POST /api/coach/extension/save-profile` / `draft-note`
- Popup can still collect LinkedIn cookies via `chrome.cookies` for Sales Nav imports
