---
id: sales-navigator-import
title: Import from Sales Navigator
summary: Turn targeting into a Sales Navigator search, then import the people into a new list.
tools: [get_blueprint_targeting, build_sales_nav_search, preview_sales_nav_search, start_sales_nav_import, check_import]
references: [code:prospect-search-playbook, agent/references/list-kpis.md]
modes: [admin, coach]
---

# Import from Sales Navigator

## What this is
Build a Sales Navigator people search from plain-English criteria (or use a search URL they paste), then import the results into a new list in the coach's pool. Imports run through the coach's own LinkedIn account.

## What you need
| Need | Default | Ask when |
|---|---|---|
| Location | The coach's country (usually United Kingdom) | Always confirm. US: ask for the state or states. |
| Industry or business type | From the blueprint if there is one | Not known |
| Size of company | 1 to 10, 11 to 50, 51 to 200 (the classroom base search) | They mention bigger or smaller firms |
| Connection degree | 2nd and 3rd (for connector campaigns) | They want their own connections (1st) |
| How many people | 1,000 | Offer 250, 500, 1,000, 2,500 or "all" (2,500 max) |
| List name | "Sales Nav · <industry> · <location>" | Never, just tell them |

If they paste a `linkedin.com/sales/search/people` URL, pass it to `preview_sales_nav_search` instead of building one. Use the cleaned link it returns.

## The process
1. If you have not already, call `get_blueprint_targeting`. Suggest the narrowing from what they help with. Company-name words in Current Company come first, with variations (engineering, engineers, engineer). One idea per search. Keywords only when company names do not work. The playbook is the ladder.
2. Build the search with `build_sales_nav_search`, or take the link they pasted. The base search (owner and founder titles, coach and consultant exclusions) is applied when you build.
3. Call `preview_sales_nav_search`. Tell them the number it reports ("about 2,400 people on your account"). If it cleaned the link, say what it changed in one sentence: a session id or someone else's saved search makes Sales Navigator show an empty page. If the link cannot be imported (a company search, a lead list, or a link with no filters), explain that and either ask for a people-search link or build the search from their criteria.
4. When the count is over 2,500, say LinkedIn only returns the first 2,500 from one search, and offer to narrow it (one company size, or a smaller area) before importing.
5. Show the criteria in a short list. They can open the cleaned link and spot-check (aim for 8 out of 10 good matches).
6. When they are happy, call `start_sales_nav_import` with the cleaned URL and the suggested list name (they can rename it). It asks for confirmation. It uses their LinkedIn account, takes a few minutes, and replaces any import already running.
7. After it is confirmed, use `check_import` when they ask how it is going. When it finishes, the people are on the new list, ready for a campaign.

## What NOT to do
- Do not stack company names and keywords in one search. The playbook explains why.
- Do not use the Industry filter. Company names and keywords work better.
- Do not guess the result count. Use the number from `preview_sales_nav_search`, and say it is the count on their Sales Navigator.
- Do not start a second import while one is running without saying it will replace the first.
- Do not import a link that preview said cannot be imported. Fix it or build a new search.
