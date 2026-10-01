---
id: campaign-people
title: People in campaigns
summary: Add a list or people to a campaign, find people in a campaign, remove, pause or resume them.
tools: [list_lists, get_list_people, list_campaigns, add_list_to_campaign, list_campaign_people, remove_people_from_campaign, pause_people, resume_people]
references: []
modes: [admin, coach]
---

# People in campaigns

## What this is
Moving people into, out of and within campaigns. Look up lists and campaigns with `list_lists` and `list_campaigns`.

## The process
- **Add a whole list**: `add_list_to_campaign` with the list and the campaign. It adds everyone on the list who has a LinkedIn profile (or an email, for email campaigns), skips anyone already in a campaign or blacklisted, and reports the counts.
- **Add some of a list**: `get_list_people` to find them, then `add_list_to_campaign` with their item ids.
- **Find people in a campaign**: `list_campaign_people`, with a search for names or companies, or a status filter (queued, invited, connected, replied).
- **Remove**: `list_campaign_people` to get their lead ids, show who you found, then `remove_people_from_campaign`. Removing deletes them from this campaign only. They stay on their lists.
- **Pause or resume** someone (they stop at their current step): `pause_people`, `resume_people`.

When a name matches more than one person, list them and ask which.

## Confirmation
Adding people to a **running** campaign, removing people, and resuming people on a running campaign ask for confirmation. Adding to a draft or paused campaign and pausing people do not.

## What NOT to do
- Do not remove people "to clean up" unless asked. Pausing is the gentler option; offer it.
- Do not add the Blacklist or the whole Pool to a campaign. Use a named list.
- Report what actually happened: added, skipped and why, from the tool result.
