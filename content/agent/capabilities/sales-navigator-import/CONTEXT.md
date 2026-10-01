---
id: sales-navigator-import
title: Import from Sales Navigator
summary: Turn targeting into a Sales Navigator search, then import the people into a new list.
tools: [build_sales_nav_search, start_sales_nav_import, check_import]
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

If they paste a `linkedin.com/sales/search/people` URL, skip building and use it as it is.

## The process
1. Build the search with `build_sales_nav_search`. The base search (owner and founder titles, coach and consultant exclusions) is applied for you. Your job is the narrowing: follow the playbook's ladder. Company-name terms first, with variations (engineering, engineers, engineer), one idea per search. Keywords only when company names do not work.
2. Show the criteria in a short list and the search link, so they can open it in Sales Navigator and spot-check (aim for 8 out of 10 good matches).
3. When they are happy, call `start_sales_nav_import`. It asks for confirmation. Mention that it uses their LinkedIn account and takes a few minutes, and that it replaces any import already running.
4. After it is confirmed, use `check_import` when they ask how it is going. When it finishes, the people are on the new list, ready for a campaign.

## What NOT to do
- Do not stack company names and keywords in one search. The playbook explains why.
- Do not use the Industry filter. Company names and keywords work better.
- Do not promise a number of results. Sales Navigator decides that; say "up to".
- Do not start a second import while one is running without saying it will replace the first.
