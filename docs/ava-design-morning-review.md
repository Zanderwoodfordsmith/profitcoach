# Ava's look: morning review (overnight 23 to 24 Oct)

**Where to look:** http://localhost:3002/admin/ava?tab=design (Admin → Ava → Design). Seven tabs. Every screen has **Full size** under it; judge them there.

Roadmap: job 132, "Ava's look: design options for her face, symbol and screens", in Review.

## What's there

| Tab | Options |
|---|---|
| **Symbol** | A Pearl (liquid drop of light, after your bubble clip), B Orbit (star and crossed rings; your numbers spin inside when she works, after the Aristotle clip), C Halo (ring of light dots that builds itself, after HyperOS), D Sunrise (a sun rising over a line), E today's orb for comparison. Switch Resting / Listening / Working / Talking. Plus her name set with the symbol, with a light sweep (HyperOS). |
| **Face** | Seven women: Morning mist, First light, A hint of made (fine mesh at the neck), Ex Machina light (glass neck), Navy mist, Rim light, Ex Machina navy. |
| **Start screen** | A Sunrise (pale sky, light rising from the bottom, glass chat box, pills). B Beam (your black reference in navy: shaft of light, streaks, square buttons). C Ava in the room (her face fading into mist on the right). D Daylight (the sky follows the time of day; she opens with three things ready). Any symbol on any screen. |
| **In chat** | A One calm column (no bubbles for Ava, glass cards). B Ava beside you (the Doer layout: history, chat, her face on the right). C Build it together (chat on navy, the campaign filling in live on the right). |
| **Sidebar and phone** | Beside a page: glass panel, spotlight bar, Ava in the sidebar. Phone: sunrise home with Hold to speak, in a chat, voice call with her face, quick sheet. |
| **What she shares** | Prospect card (3 options, one a boarding pass layout), list of people, campaign card (3 options, one is hold to turn on), message to approve, her plan ticking off, a question with cards, "It's on", a nudge. All play again, sunrise and navy. |
| **More screens** | Voice call with her face, voice call with her symbol, first meeting, while you were away, past chats, when things go wrong (thinking, LinkedIn down, offline, daily limit), waking up. |

All the data is one made-up story (a Leeds manufacturers campaign) so the screens compare like for like.

## I checked

- Typecheck: correction (24 Oct): the overnight typecheck never ran (macOS has no `timeout` command, so the check failed silently). A real full typecheck on 24 Oct found 6 errors in the Face tab, now fixed; it passes with exit code 0.
- Design checker (impeccable detect): no findings.
- No em or en dashes in the copy.
- Looked at every tab in a browser at 1440 wide (and 900 for "What she shares"), light and navy, and fixed what I saw: a seam across the pearl, the orbit flattening into an X, glow cut into squares, a light sweep showing a box, faces cropped at the neck.

## You check

- Taste: which symbol, which face, which start screen. Mix freely.
- The faces on your screen at full size, especially whether the Ex Machina ones feel right or creepy.
- The motion: watch each symbol for a few seconds, and press Play again in "What she shares".
- The light glass may look solid to you: your Mac has "Reduce transparency" on (found in October). The screens don't fall back to solid, so you should see the glass.

## Decisions I made (overturn any of these)

1. **Faces came from Gamma, not Cloudflare.** Cloudflare's free image allowance was already used up for the day. You said spending a bit was fine, so I used Gamma AI images: 11 images at 70 credits each (770 of your 8,000; 7,160 left). Two weak ones (a glass bust, a face behind a glass wall) were thrown away. The Cloudflare quota also powers the simulator's speech-to-text, so that may be paused until it resets.
2. **The faces are seven different women.** One model can't keep the same woman across pictures. Once you pick, I'll make more of her (other angles, a talking version for calls), probably with HeyGen.
3. **It lives in Ava's Design tab** (your call, 24 Oct). The old /admin/ava/design link forwards there.
4. **Brand blues only.** No purple from the Doer shots. A faint warm tint appears only at sunrise and in the phone's edge glow.
5. **Daylight (start screen D) came from the design tool's dice roll.** It picked my sixth idea rather than my first, and I built it as a full option. The rest follow your brief.
6. **End call buttons are white, not red**, to stay in brand colours.
7. **Ava never sends without a yes.** Every screen that could send says so, and campaigns need "Turn it on" (one option uses a hold to turn on).
8. **The daily limit shown is LinkedIn's 15 invites**, not a cap on using Ava (that would be a pricing decision).
9. **Small pearls (under 40px) are drawn in CSS**, not the live shader, so a page full of them stays light. They look slightly simpler than the big one.

## Not done, and what's next

- Nothing in the live Ava has changed. Once you pick, building it means changing the shared kit in `src/components/ava/` (AvaKit, AvaStage, AvaDock, ava.css) so every Ava picks it up.
- The design tool's choice page (it normally waits for your pick) wasn't used, because you were asleep. This board is that choice.
- Code is committed on branch `ava-design` (my files only). It's also in the working tree, so 3002 shows it now.
- I added one design checker exception (`.impeccable/config.json`): the moving light on Ava's current step counts as a state, not decorative gradient text. That file already had another session's changes, so I didn't commit it.
