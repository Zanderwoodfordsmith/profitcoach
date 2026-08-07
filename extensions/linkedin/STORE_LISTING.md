# Chrome Web Store listing copy

Use these fields in the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Listing

| Field | Value |
|-------|--------|
| **Name** | Profit Coach for LinkedIn |
| **Summary** (132 chars max) | Save LinkedIn prospects to Profit Coach, draft personalized notes, and sync Sales Nav sessions. |
| **Category** | Productivity (or Workflow & Planning) |
| **Language** | English |
| **Visibility** | Unlisted (recommended at first) or Public |

### Detailed description

```
Profit Coach for LinkedIn helps Business Coach Academy coaches work faster on LinkedIn — without auto-sending anything.

What you can do
• Save a LinkedIn profile to your Profit Coach pipeline with one click
• See ICP fit score + talking points on any profile
• Draft personalized connection notes, DMs, feed comments, and message replies (you review and click Send)
• Optionally sync your Sales Navigator browser session for lead imports in Profit Coach

How to use
1. Install this extension
2. Sign in to Profit Coach in Chrome (keep a tab open)
3. Open a LinkedIn profile
4. Click the floating “Profit Coach” button (or Open side panel from the extension)
5. Save the prospect or draft a note — then send it yourself on LinkedIn

Membership
Save & Draft require a Profit Coach membership that includes marketing tools (programme / Premium / VIP). If you cancel or your tier no longer includes marketing, the extension APIs stop working.

This extension is only for Profit Coach / Business Coach Academy users. It does not auto-connect, auto-comment, or send messages on your behalf.
```

## Privacy policy URL (required)

`https://www.businesscoachacademy.com/legal/linkedin-extension-privacy`

Fallback local file: `privacy.html` in this folder.

## Permission justifications

| Permission | Justification |
|------------|----------------|
| **cookies** | Read LinkedIn session cookies only when the user clicks Save Sales Nav session / Copy cookies, so Profit Coach can run Sales Navigator imports they initiate. |
| **host_permissions: linkedin.com** | Read cookies for session sync; inject the coach assistant UI and read visible profile fields the user is viewing; insert draft text into LinkedIn composers when asked. |
| **host_permissions: businesscoachacademy.com** (+ localhost for dev) | Call Profit Coach APIs and detect an open signed-in Profit Coach tab. |
| **tabs** | Find an open Profit Coach tab for auth; open the side panel on the active LinkedIn tab. |
| **scripting** | Read the Profit Coach auth token from an open app tab when the user acts. |
| **sidePanel** | Show Save & Draft UI beside LinkedIn without leaving the profile. |
| **clipboardWrite** | Copy draft messages or session JSON when the user chooses Copy. |
| **storage** | Remember preferred Profit Coach site and last scraped profile context. |

## Single purpose

“Help Profit Coach members save LinkedIn prospects into their pipeline and draft personalized outreach they send themselves; optionally sync a Sales Navigator session for in-app lead imports.”

## Package

From repo root:

```bash
npm run pack:linkedin-extension
# → extensions/dist/profit-coach-linkedin-<version>.zip
```
