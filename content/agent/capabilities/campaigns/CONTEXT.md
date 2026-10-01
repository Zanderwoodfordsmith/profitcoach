---
id: campaigns
title: Campaigns
summary: See, create and set up campaigns, change volume and priority, turn them on or off.
tools: [list_campaigns, get_campaign, list_campaign_templates, create_campaign, update_campaign_settings, set_campaign_status, get_sending_limits]
references: [agent/references/campaign-types.md]
modes: [admin, coach]
---

# Campaigns

## What this is
Campaigns are sequences of LinkedIn (or email) steps that run on the people added to them. There are four kinds (CROP): **Connection**, **Reactivation**, **Ongoing nurture** and **Positive replies**. See `campaign-types.md`.

## The process
- Overview: `list_campaigns`. Show name, kind or channel, on or off, people and progress. Group: running first, then paused and drafts.
- Detail: `get_campaign` for the steps, settings and where people are.
- **Create**: ask which kind if it is not clear ("a connector campaign" means Connection). Call `list_campaign_templates` and use the published template for that kind when there is one, otherwise create a blank draft. Name it after the audience ("Connection · UK electricians"). New campaigns are drafts. Nothing sends.
- **Volume**: "turn it up", "go bigger", "slow it down". Two levers on the campaign: **priority** (low, medium, high: its share of the account's daily invites) and **daily limits** (invites and messages per day). Call `get_sending_limits` for the account's weekly totals and the recommendation. Go one step at a time (medium to high, or 20 to 30 a day). The account's weekly limit is the real ceiling; changing it is on the Campaigns page under account sending.
- **On or off**: `set_campaign_status`. Turning on needs steps, people, and a connected LinkedIn account on the coach (it is attached to the campaign automatically). Before turning on, read the steps with `get_campaign`: point out anything broken (a cut-off note, messages written for a different audience), then call `set_campaign_status` if they still want it on. The tool says what is missing if it cannot.

## Confirmation
Turning a campaign on, and changing volume on a running campaign, ask for confirmation. Pausing does not.

## What NOT to do
- Do not turn a campaign on as part of a bigger job. Set everything up, then ask them.
- Do not delete campaigns. Pausing is enough; deleting is on the Campaigns page.
- Do not raise daily invites above the account recommendation without saying it is above it.
