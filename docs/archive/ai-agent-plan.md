# AI Agent: plan

Built on branch `ai-agent` (from `practice-blueprint`). This is the plan written before the build. The morning review (`docs/ai-agent-morning-review.md`) says what actually shipped.

## The ask

1. An admin AI that does things in the app, like the Stryv assistant does for goals and actions. "Import this list for this coach with this Sales Navigator search." "Create a Connection campaign and write the messages." "Add this list to that campaign." "Remove these people." "Turn it up."
2. Possibly the same for members, or a guided version of it.
3. Get Clients first: add people, add a list to a campaign, remove people, campaign volume, and later chains like "launch a connector campaign to my avatar", where it asks how you want to find people and walks you through it (Google Maps: country, then US state or town, then what to search for).
4. Organise it with the Interpretable Context Methodology (ICM), not one big prompt.

## Architecture: ICM mapped onto an agent

The paper's layers, applied to a live app instead of a folder pipeline:

| Layer | In the paper | Here |
|---|---|---|
| 0 | `CLAUDE.md`: where am I | `content/agent/AGENT.md`: who the agent is, modes, the confirmation rule. Always loaded. |
| 1 | `CONTEXT.md`: where do I go | `content/agent/ROUTER.md`: task to capability table. Always loaded. |
| 2 | Stage `CONTEXT.md`: the contract | `content/agent/capabilities/<id>/CONTEXT.md`: when to use it, what to ask for, which tools, what not to do. Loaded only when the agent opens it. |
| 3 | Reference material | `content/agent/references/*.md` plus existing canon (the Sales Navigator playbook in code, `writing-rules.md`, connector knowledge). Listed per capability. |
| 4 | Working artifacts | The coach's live data from tools (lists, campaigns, import jobs), and the conversation. |

**Scoped tools.** The paper notes that loading every tool up front costs tokens and focus. The Claude API now supports this directly: every capability tool is declared with `defer_loading: true`, and when the agent calls `open_capability`, the server appends a `tool_addition` system message for that capability's tools (beta `mid-conversation-tool-changes-2026-07-01`). The tool list never changes between requests, so the prompt cache and preserved thinking stay valid. Tested against the API before building.

**Capability frontmatter is the wiring.** Each `CONTEXT.md` starts with frontmatter: `id`, `title`, `tools`, `references`, `modes`. Editing the Markdown changes what the agent loads. A test checks every listed tool exists.

**Review gates.** The paper's human review between stages becomes confirm cards. Rule: anything that could contact people, spend money, or delete or remove data waits for a click. Drafts and reads run straight away.

- Confirm: start a Sales Navigator or Google Maps import, turn a campaign on, add people to a running campaign, remove or move people, change volume on a running campaign, rewrite messages on a running campaign, give a coach access to the agent.
- No confirm: reads, create a draft campaign, write messages on a draft, add people to a draft or paused campaign, create a list, pause.

A gated tool call stores a pending action (server side, input frozen) and returns "waiting for confirmation". The card's Confirm button executes that stored action, then the chat continues with the result.

## Capabilities (v1)

| Capability | Tools |
|---|---|
| core (always) | `open_capability`, `get_account_overview`; admin: `find_coach`, `switch_coach` |
| find-prospects | chooser only: asks how they want to find people, then opens one of the below |
| sales-navigator-import | `build_sales_nav_search`, `start_sales_nav_import` (confirm), `check_import` |
| google-maps-import | `google_maps_options`, `start_google_maps_import` (confirm), `check_import` |
| google-search-import | `google_search_options`, `start_google_search_import` (confirm), `check_import` |
| lists | `list_lists`, `get_list_people`, `create_list` |
| campaigns | `list_campaigns`, `get_campaign`, `list_campaign_templates`, `create_campaign`, `update_campaign_settings`, `set_campaign_status` |
| campaign-people | `add_list_to_campaign`, `list_campaign_people`, `remove_people_from_campaign`, `pause_people`, `resume_people` |
| campaign-messaging | `get_campaign`, `write_campaign_steps`, `get_coach_brain` |
| guide | `link_to_page` (how-to and "take me there") |
| coach-access (admin) | `set_agent_access` (confirm) |

## Modes

- **Admin**: an admin can act on any coach. The chat has one active coach at a time, shown on every confirm card. If the admin is viewing as a coach, that coach is the default.
- **Coach**: the coach's own account only, no coach switching. Off by default per coach (`coaches.ai_agent_enabled`). Admins can switch it on.

## Data

Migration `20270116120000_ai_agent.sql` (additive): `ai_agent_chats` (append-only API transcript, active coach, opened capabilities) and `ai_agent_actions` (pending and finished gated actions). Row level security on, no client policies: only the server reads and writes them, so nobody can forge a pending action. Plus `coaches.ai_agent_enabled`.

## Code

- `content/agent/`: the ICM folder.
- `src/lib/agent/`: context loader, tool registry and executors, gate logic, the streaming loop, pending actions.
- `src/app/api/agent/`: chat (NDJSON stream), chat history, actions (confirm or cancel), status.
- `src/components/agent/AgentChat.tsx`: messages, tool chips, confirm cards, coach chip. Mounted as an "Agent" view in the existing Profit Coach AI panel.
- Shared cores: the Google Maps import, Sales Navigator import and list-to-campaign logic move out of their route handlers into `src/lib` so the routes and the agent run the same code.

## Model

`claude-opus-5-5` with adaptive thinking (always on for this model), effort `medium`, server-side refusal fallback on. `AGENT_ANTHROPIC_MODEL` overrides.

## Testing

Unit tests for the context loader, frontmatter wiring, gate rules and the Sales Navigator criteria builder. Live runs against the dev server on **Zander Demo** only (draft campaigns and lists). No paid imports and no LinkedIn sends without you.
