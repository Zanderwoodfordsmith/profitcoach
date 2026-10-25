# Profit Coach app design rules

The member and admin app (not the marketing pages). Agreed with Zander on
24 Oct 2026 on Admin → Brand → Design, where every live piece is listed
(`scripts/design-inventory.ts`). Product and brand context: `PRODUCT.md`.

Feel: modern, premium, crisp. BCA navy, light weights, calm pages.

## Buttons

Use `Button` or `buttonClass()` from `src/components/ui/Button.tsx`. Always pills.

| Kind | When |
| --- | --- |
| `main` | The one action that matters on a screen. Navy #0C5290. One per area. |
| `second` | Sits beside main, or any normal action. White, thin border. |
| `quiet` | Small extras: "See all", "Cancel", "Edit". Navy text, no box. |
| `delete` | Things you can't undo. Red. |

Sizes: `normal` (40px tall, 14px text) and `small` (32px, 12px text). Text
is medium weight. An icon goes before the words.

Not buttons: tabs, chips you toggle, icon-only buttons, menu rows, links in a
sentence. Leave those alone, or give them their own rule here first.

## Text

One font (Geist). Eight sizes, set in `src/app/globals.css`:

| Class | Size | For |
| --- | --- | --- |
| `text-kicker` | 11px, semibold, capitals | The small line above a heading |
| `text-caption` | 12px | Dates, hints, badges, table headings |
| `text-ui` | 14px | Menus, buttons, labels, lists. Most of the app |
| `text-read` | 16px, roomy lines | Scripts, lessons, the Blueprint, anything read for a while |
| `text-subhead` | 18px, semibold | Section and card headings |
| `text-title` | 24px, semibold | Page titles |
| `text-heading` | 30px, light then semibold | Big headings on overview pages |
| `text-display` | 40px, light then semibold | Showpieces: assessment headlines, scores, reports |

Tailwind's `text-xs` (12), `text-sm` (14), `text-base` (16), `text-lg` (18)
and `text-2xl` (24) are on the scale and can stay. Nothing below 11px. No
other sizes: 10px, 10.4px, 11px plain text and 13px are off the scale.

Weights: normal for text, medium for buttons and emphasis, semibold for
headings. Bold only for numbers, scores and the one thing that must stand
out. Light only for the first half of a two-weight heading.

Showpieces keep their punch: a one-off big style that looks good moves to
`text-heading` or `text-display` rather than shrinking.

## Cards

Use `Card` or `cardClass()` from `src/components/ui/Card.tsx`. All `rounded-2xl`.

| Kind | When |
| --- | --- |
| `plain` | Most things: a list, a form, a summary. White, thin border, no shadow. |
| `raised` | Things you click into, and pop-ups. Light shadow. |
| `soft` | A quiet panel inside a page or another card. Light grey, no border. |

Padding is the card's own choice (`p-4` to `p-6`), passed as the extra class.

## Still to decide

Form fields, badges, tables, empty states and pop-up backdrops. Until they
have a rule here, keep them as they are.
