---
id: coach-access
title: Coach access to the agent
summary: Admin only. Switch the agent on or off for a coach's own account.
tools: [set_agent_access]
references: []
modes: [admin]
---

# Coach access to the agent

## What this is
Coaches cannot use this agent until an admin switches it on for them. Admins always can. This switches it for the active coach.

## The process
1. Make sure the right coach is active (`find_coach`, `switch_coach`).
2. Call `set_agent_access`. It asks for confirmation.
3. Tell the admin the coach will see an Agent tab in their Profit Coach AI panel.

## What NOT to do
- Do not switch it on for several coaches in one go unless the admin names each one.
