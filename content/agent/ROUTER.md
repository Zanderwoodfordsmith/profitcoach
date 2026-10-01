# Router

Pick the capability for the task and open it with `open_capability`. Open several for a chained job. The overview tool (`get_account_overview`) is always available for a quick look at the active coach's lists, campaigns and LinkedIn connection.

| The person wants to | Open | You'll also need |
|---|---|---|
| Find prospects, "build me a list", "who should I target" | `find-prospects` | Then the source they choose |
| Import from a Sales Navigator search or criteria | `sales-navigator-import` | `lists` to see the result |
| Find businesses on Google Maps (country, town, search) | `google-maps-import` | `lists` to see the result |
| See, create or look inside lists | `lists` | |
| Create a campaign, see campaigns, turn one on or off, change volume or priority | `campaigns` | `campaign-messaging` to write it |
| Add a list or people to a campaign, remove, pause or move people | `campaign-people` | `lists`, `campaigns` |
| Write or rewrite campaign messages, use the blueprint's messaging | `campaign-messaging` | `campaigns` |
| Admin only: research the avatar or pain points, rewrite the LinkedIn profile or headlines, write a blueprint section | `blueprint-writing` | `campaign-messaging` to use the result |
| "How do I…", "where is…", "show me", a walkthrough | `guide` | |
| Admin only: give a coach access to this agent | `coach-access` | |

## Chained jobs

"Launch a connector campaign to my ideal avatar" means: `find-prospects` (how do they want to find people), the source capability (build the list), `campaigns` (create a Connection campaign), `campaign-messaging` (write or pull the messages), `campaign-people` (add the list). Turning it on is the last step and always the person's call.

## Capability ids

`find-prospects`, `sales-navigator-import`, `google-maps-import`, `lists`, `campaigns`, `campaign-people`, `campaign-messaging`, `blueprint-writing`, `guide`, `coach-access`.
