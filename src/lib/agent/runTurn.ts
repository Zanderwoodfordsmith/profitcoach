import Anthropic from "@anthropic-ai/sdk";
import { helpAnswersAsMarkdown } from "@/lib/help/helpAnswers";

import { createPendingAction } from "./actions";
import type { AgentActor } from "./auth";
import {
  APP_EVENT_TAG,
  saveChat,
  WORKING_STATE_TAG,
  type AgentChatRow,
  type StoredMessage,
} from "./chatStore";
import { refreshAgentContextOverrides } from "./agentOverrides";
import { coachCard } from "./coachCard";
import { loadAgentCoach } from "./coaches";
import { addUsage, emptyTally, logAiUsage, type UsageTally } from "@/lib/ai/usageLog";
import { bcaPageWork, blueprintPageFromPath } from "./pageWork";

import {
  capabilitiesForActor,
  capabilityContract,
  loadIdentity,
  loadRouter,
  parseFrontmatter,
  resolveReference,
  type Capability,
} from "./context";
import {
  agentModel,
  DEFAULT_FALLBACK_BETA,
  modelSupportsDefaultFallback,
  modelSupportsEffort,
  modelSupportsToolChanges,
  TOOL_CHANGES_BETA,
} from "./model";
import { anthropicToolsForMode, getAgentTool, toolAllowedForActor } from "./tools";
import { OPEN_CAPABILITY_TOOL } from "./tools/core";
import { AgentToolError } from "./tools/util";
import type {
  AgentActionView,
  AgentCoach,
  AgentShow,
  AgentStreamEvent,
  AgentToolContext,
  AgentToolInput,
} from "./types";

/**
 * One turn of the agent: the person's message (or a confirmed/cancelled
 * action) in, a streamed reply out. Context follows the Interpretable Context
 * Methodology: identity and router always; a capability's contract and tools
 * only after the agent opens it.
 */

const MAX_MODEL_CALLS = 16;
const TOOL_RESULT_MAX_CHARS = 12_000;

export type AgentTurnInput =
  | { kind: "message"; text: string }
  | { kind: "action"; action: AgentActionView };

type Emit = (event: AgentStreamEvent) => void;

const VOICE_FILE = "agent/VOICE.md";

function systemPrompt(mode: AgentChatRow["mode"], limited: boolean): string {
  const ids = capabilitiesForActor(mode, limited).map((cap) => cap.id);
  const session = [
    `# This session`,
    `Mode: ${mode}. Capabilities you can open: ${ids.join(", ")}.`,
    ...(limited
      ? [
          "This coach doesn't have every skill switched on yet. If they ask for something outside the capabilities above (campaigns, lists, imports), say BCA can switch it on for them, and carry on with what you can do.",
        ]
      : []),
  ].join("\n");
  // Ava's voice (card 180) sits right after who she is, in every chat. Editable in Admin → Ava.
  const raw = resolveReference(VOICE_FILE)?.text;
  const voice = raw ? parseFrontmatter(raw).body : null;
  // Help centre answers (job 211): how the app works, in the words coaches read on Support → Help.
  const help = `# Help centre answers\nWhen the coach asks how something in the app works, or where to find something, answer from these. Keep the link in the answer so they can open the page.\n\n${helpAnswersAsMarkdown()}`;
  return [loadIdentity(), ...(voice ? [voice] : []), loadRouter(), help, session].join("\n\n---\n\n");
}

/** "Offer (offer)" when the page open is a Blueprint page, coach or admin view. */
function blueprintPageOpen(screenPath: string | null): string | null {
  const page = blueprintPageFromPath(screenPath);
  return page ? `${page.title} (${page.slug})` : null;
}

const TITLE_MODEL = "claude-haiku-5-5";
/** Ava retitles the chat after these many messages from the person, as it moves on. */
const TITLE_AFTER = new Set([1, 3, 6, 10, 16]);

/** Messages the person typed (not tool results, not confirm or cancel events). */
function personTurns(messages: StoredMessage[]): number {
  return messages.filter(
    (m) =>
      m.role === "user" &&
      Array.isArray(m.content) &&
      (m.content as Array<{ type?: string; text?: string }>).some(
        (b) =>
          b.type === "text" &&
          !b.text?.startsWith(`<${WORKING_STATE_TAG}>`) &&
          !b.text?.startsWith(`<${APP_EVENT_TAG}>`)
      )
  ).length;
}

/** The visible conversation as plain text, newest last, for writing a title. */
function plainTranscript(messages: StoredMessage[], max = 6_000): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role === "system" || !Array.isArray(m.content)) continue;
    for (const block of m.content as Array<{ type?: string; text?: string }>) {
      if (block.type !== "text" || !block.text?.trim()) continue;
      const text = block.text.trim();
      if (text.startsWith(`<${WORKING_STATE_TAG}>`) || text.startsWith(`<${APP_EVENT_TAG}>`)) continue;
      lines.push(`${m.role === "user" ? "Person" : "Ava"}: ${text}`);
    }
  }
  const all = lines.join("\n");
  return all.length > max ? all.slice(-max) : all;
}

/**
 * A chat title as plain words: its first line, without markdown (bold stars,
 * backticks, heading or list marks), so the list never shows "**Profile...".
 */
function plainTitle(text: string): string {
  const line = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line
    .replace(/^(#{1,6}|[-*>]|\d+[.)])\s+/, "")
    .replace(/[*`]|__/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A short title naming what the chat covered, or null if the model is unavailable. */
async function writeTitle(
  client: Anthropic,
  messages: StoredMessage[],
  tally: UsageTally
): Promise<string | null> {
  const transcript = plainTranscript(messages);
  if (!transcript) return null;
  try {
    const reply = await client.messages.create({
      model: TITLE_MODEL,
      max_tokens: 200,
      // A title needs no reasoning; Haiku thinks by default and would spend the budget on it.
      thinking: { type: "disabled" },
      system:
        "Write a title for this conversation in 2 to 6 words, naming what it covered, like \"Results and offer\" or \"Connection message rewrite\". Sentence case, UK English. Plain text on one line: no markdown, no quotes, no full stop, no em dashes.",
      messages: [{ role: "user", content: transcript }],
    });
    addUsage(tally, reply.model || TITLE_MODEL, reply.usage);
    const text = plainTitle(
      reply.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .replace(/["\u201c\u201d.]/g, "")
        .replace(/\s*\u2014\s*/g, ", ")
    );
    return text ? text.slice(0, 72) : null;
  } catch (err) {
    console.error("agent title failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

function workingState(opts: {
  mode: AgentChatRow["mode"];
  coach: AgentCoach | null;
  screenPath: string | null;
  opened: string[];
  /** Admin on a coach's Blueprint page: the page's work for BCA. */
  pageWork?: string[];
}): string {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
  const blueprint = blueprintPageOpen(opts.screenPath);
  const lines = [
    `Mode: ${opts.mode}`,
    `Active coach: ${opts.coach ? opts.coach.name : opts.mode === "admin" ? "none chosen yet" : "you (the coach)"}`,
    `Page open: ${opts.screenPath ?? "unknown"}`,
    ...(blueprint ? [`Blueprint page open: ${blueprint}`] : []),
    ...(opts.pageWork ?? []),
    `Capabilities already open: ${opts.opened.length ? opts.opened.join(", ") : "none"}`,
    `Today: ${today}`,
  ];
  return `<${WORKING_STATE_TAG}>\n${lines.join("\n")}\n</${WORKING_STATE_TAG}>`;
}

function turnText(input: AgentTurnInput): string {
  if (input.kind === "message") return input.text;
  const { action } = input;
  const what = `"${action.title}"${action.coachName ? ` for ${action.coachName}` : ""}`;
  const body =
    action.draft && action.status === "cancelled"
      ? `The person pressed Change it on the draft ${what}. Nothing was saved. Ask what they want changed in one short question (unless they already said), then write a new draft with their changes.`
      : action.draft && action.status === "done"
        ? `The person saved the draft ${what} to the Blueprint. Result: ${JSON.stringify(action.result ?? null).slice(0, 2_000)}`
        : action.status === "done"
      ? `The person confirmed ${what}. It ran. Result: ${JSON.stringify(action.result ?? null).slice(0, 4_000)}`
      : action.status === "failed"
        ? `The person confirmed ${what}, but it failed: ${action.error ?? "unknown error"}.`
        : `The person cancelled ${what}. Nothing changed.`;
  return `<${APP_EVENT_TAG}>${body} Carry on from here.</${APP_EVENT_TAG}>`;
}

function capText(text: string): string {
  return text.length > TOOL_RESULT_MAX_CHARS
    ? `${text.slice(0, TOOL_RESULT_MAX_CHARS)}\n[Truncated.]`
    : text;
}

/** Tools the transcript has already revealed with tool_addition messages. */
function revealedTools(messages: StoredMessage[]): Set<string> {
  const names = new Set<string>();
  for (const message of messages) {
    if (message.role !== "system" || !Array.isArray(message.content)) continue;
    for (const block of message.content as Array<Record<string, unknown>>) {
      const tool = block.tool as { name?: unknown } | undefined;
      if (block.type === "tool_addition" && typeof tool?.name === "string") names.add(tool.name);
    }
  }
  return names;
}

export async function runAgentTurn(opts: {
  actor: AgentActor;
  chat: AgentChatRow;
  input: AgentTurnInput;
  screenPath: string | null;
  emit: Emit;
}): Promise<void> {
  const { actor, chat, emit } = opts;
  await refreshAgentContextOverrides();
  const mode = chat.mode;
  const limited = actor.limited;
  const capabilityFor = (id: string): Capability | null =>
    capabilitiesForActor(mode, limited).find((cap) => cap.id === id) ?? null;
  const model = agentModel();
  const toolChanges = modelSupportsToolChanges(model);

  // Coach mode always acts on the actor. Admin mode on the chat's coach.
  let coach: AgentCoach | null =
    mode === "coach"
      ? await loadAgentCoach(actor.actorUserId)
      : chat.coach_id
        ? await loadAgentCoach(chat.coach_id)
        : null;
  const revealed = revealedTools(chat.api_messages);
  // A capability counts as open only if it is still allowed (Admin → Ava → Skills) and its tools are still revealed.
  const opened = new Set(
    (chat.opened_capabilities ?? []).filter(
      (id) =>
        capabilityFor(id) !== null &&
        (!toolChanges ||
          (capabilityFor(id)?.tools ?? []).every((name) => {
            const tool = getAgentTool(name);
            return !tool || tool.core || !toolAllowedForActor(tool, mode, limited) || revealed.has(name);
          }))
    )
  );
  // Every non-core tool belongs to a skill. A skill switched off mid-chat takes its tools with it.
  const skillTools = new Set(capabilitiesForActor(mode, limited).flatMap((cap) => cap.tools));

  emit({ type: "chat", chatId: chat.id, coach, mode });

  const pageWork = mode === "admin" && coach ? await bcaPageWork(coach, opts.screenPath) : [];

  const messages: StoredMessage[] = [...chat.api_messages];
  messages.push({
    role: "user",
    content: [
      {
        type: "text",
        text: workingState({ mode, coach, screenPath: opts.screenPath, opened: [...opened], pageWork }),
      },
      { type: "text", text: turnText(opts.input) },
    ],
  });
  let committed = messages.length;

  const ctx: AgentToolContext = {
    mode,
    actorUserId: actor.actorUserId,
    chatId: chat.id,
    coach,
    screenPath: opts.screenPath,
    setCoach: (next) => {
      if (mode !== "admin") return;
      coach = next;
      ctx.coach = next;
      emit({ type: "coach", coach: next });
    },
  };

  const tools = anthropicToolsForMode(mode, limited).map((tool) =>
    toolChanges ? tool : { ...tool, defer_loading: undefined }
  );
  const betas = [
    ...(toolChanges ? [TOOL_CHANGES_BETA] : []),
    ...(modelSupportsDefaultFallback(model) ? [DEFAULT_FALLBACK_BETA] : []),
  ];
  const system = systemPrompt(mode, limited);
  // What Ava knows about the coach before the first word (card 178): their About You and launch jobs.
  const card = coach ? await coachCard(coach).catch((err) => {
    console.error("agent coach card failed:", err instanceof Error ? err.message : err);
    return null;
  }) : null;
  const tally = emptyTally();
  const client = new Anthropic();

  async function runTool(block: Anthropic.Beta.Messages.BetaToolUseBlock): Promise<{
    content: string;
    isError: boolean;
    additions: string[];
  }> {
    // Keys starting with "_" are frozen on a card by a gate (a written draft). The model never sets them.
    const input = Object.fromEntries(
      Object.entries((block.input ?? {}) as AgentToolInput).filter(([key]) => !key.startsWith("_"))
    ) as AgentToolInput;

    if (block.name === OPEN_CAPABILITY_TOOL) {
      const id = typeof input.id === "string" ? input.id.trim() : "";
      const capability = capabilityFor(id);
      if (!capability) {
        const ids = capabilitiesForActor(mode, limited).map((cap) => cap.id).join(", ");
        return { content: `No capability "${id}". Open one of: ${ids}.`, isError: true, additions: [] };
      }
      const additions = capability.tools.filter((name) => {
        const tool = getAgentTool(name);
        return tool && !tool.core && toolAllowedForActor(tool, mode, limited) && !revealed.has(name);
      });
      additions.forEach((name) => revealed.add(name));
      const wasOpen = opened.has(capability.id);
      opened.add(capability.id);
      emit({ type: "capability", id: capability.id, title: capability.title });
      return {
        content: wasOpen && additions.length === 0
          ? `${capabilityContract(capability)}\n\n(Already open. Its tools are available.)`
          : capabilityContract(capability),
        isError: false,
        additions,
      };
    }

    const tool = getAgentTool(block.name);
    if (!tool || !toolAllowedForActor(tool, mode, limited)) {
      return { content: `Unknown tool ${block.name}.`, isError: true, additions: [] };
    }
    if (!tool.core && !skillTools.has(tool.name)) {
      return {
        content: `${tool.name} belongs to a skill that is switched off. Say you can't do that here, and offer hand_to_bca.`,
        isError: true,
        additions: [],
      };
    }
    if (!tool.core && toolChanges && !revealed.has(tool.name)) {
      return {
        content: `Open the capability that has ${tool.name} first.`,
        isError: true,
        additions: [],
      };
    }
    if (tool.needsCoach && !ctx.coach) {
      return {
        content: "No active coach. Ask who this is for, then use find_coach and switch_coach.",
        isError: true,
        additions: [],
      };
    }

    emit({ type: "tool_start", id: block.id, name: tool.name, label: tool.label });
    try {
      if (tool.gate) {
        const decision = await tool.gate(input, ctx);
        if ("error" in decision) {
          emit({ type: "tool_end", id: block.id, name: tool.name, ok: false, note: decision.error });
          return { content: decision.error, isError: true, additions: [] };
        }
        if (decision.confirm) {
          const action = await createPendingAction({
            chatId: chat.id,
            actorUserId: actor.actorUserId,
            coachId: ctx.coach!.id,
            coachName: ctx.coach!.name,
            tool: tool.name,
            input: decision.input ?? input,
            title: decision.title,
            details: decision.details,
            warning: decision.warning,
            preview: decision.preview,
            before: decision.before,
            draft: decision.draft,
          });
          emit({ type: "tool_end", id: block.id, name: tool.name, ok: true });
          emit({ type: "action", action });
          return {
            content: capText(
              JSON.stringify({
                status: "awaiting_confirmation",
                action_id: action.id,
                card: action.title,
                ...(decision.forModel ?? {}),
              })
            ),
            isError: false,
            additions: [],
          };
        }
      }
      const result = await tool.run(input, ctx);
      const note = (result as { _note?: unknown } | null)?._note;
      emit({ type: "tool_end", id: block.id, name: tool.name, ok: true, ...(typeof note === "string" ? { note } : {}) });
      const link = (result as { _link?: { href?: unknown; label?: unknown } } | null)?._link;
      if (link && typeof link.href === "string") {
        emit({ type: "link", link: { href: link.href, label: String(link.label ?? "Open") } });
      }
      const show = (result as { _show?: AgentShow } | null)?._show;
      if (show && typeof show.href === "string") emit({ type: "show", show });
      return { content: capText(JSON.stringify(result ?? { ok: true })), isError: false, additions: [] };
    } catch (err) {
      const message =
        err instanceof AgentToolError
          ? err.message
          : `That did not work: ${err instanceof Error ? err.message : "unknown error"}`;
      if (!(err instanceof AgentToolError)) console.error("agent tool failed:", tool.name, err);
      emit({ type: "tool_end", id: block.id, name: tool.name, ok: false, note: message });
      return { content: message, isError: true, additions: [] };
    }
  }

  try {
    for (let call = 0; call < MAX_MODEL_CALLS; call++) {
      const params = {
        model,
        max_tokens: 16_000,
        // Two cached blocks: the shared prompt (same for everyone), then this coach's card.
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
          ...(card ? [{ type: "text", text: card, cache_control: { type: "ephemeral" } }] : []),
        ],
        tools,
        messages,
        ...(betas.length ? { betas } : {}),
        ...(modelSupportsDefaultFallback(model) ? { fallbacks: "default" } : {}),
        ...(modelSupportsEffort(model) ? { output_config: { effort: "medium" } } : {}),
        cache_control: { type: "ephemeral" },
      };
      const stream = client.beta.messages.stream(
        params as unknown as Parameters<typeof client.beta.messages.stream>[0]
      );
      stream.on("text", (delta) => emit({ type: "text", delta }));
      const final = await stream.finalMessage();
      addUsage(tally, final.model || model, final.usage);
      messages.push({ role: "assistant", content: final.content as Anthropic.Beta.Messages.BetaContentBlockParam[] });

      if (final.stop_reason === "refusal") {
        emit({ type: "text", delta: "\n\nI can't help with that one." });
        committed = messages.length;
        break;
      }
      if (final.stop_reason !== "tool_use") {
        if (final.stop_reason === "max_tokens") {
          emit({ type: "text", delta: "\n\n(I ran out of room there. Ask me to carry on.)" });
        }
        committed = messages.length;
        break;
      }

      const toolUses = final.content.filter(
        (block): block is Anthropic.Beta.Messages.BetaToolUseBlock => block.type === "tool_use"
      );
      const results: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
      const additions: string[] = [];
      // Sequential on purpose: writes depend on earlier reads and switches.
      for (const block of toolUses) {
        const outcome = await runTool(block);
        additions.push(...outcome.additions);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: outcome.content,
          ...(outcome.isError ? { is_error: true } : {}),
        });
      }
      messages.push({ role: "user", content: results });
      committed = messages.length;
      // A system message must be followed by an assistant turn (or be last
      // in the request), so it only counts as saved once a reply follows it.
      // If the turn ends first, it is dropped and the agent reopens the
      // capability next time.
      if (toolChanges && additions.length) {
        messages.push({
          role: "system",
          content: additions.map((name) => ({
            type: "tool_addition",
            tool: { type: "tool_reference", name },
          })),
        });
      }

      if (call === MAX_MODEL_CALLS - 1) {
        emit({ type: "text", delta: "\n\nI've stopped there to check in. Want me to keep going?" });
      }
    }
  } catch (err) {
    console.error("agent turn failed:", err);
    emit({
      type: "error",
      message:
        err instanceof Anthropic.APIError
          ? "The AI service had a problem. Try again in a moment."
          : "Something went wrong. Try again.",
    });
  } finally {
    // Keep only complete steps, so the next turn sends a valid transcript.
    const kept = messages.slice(0, committed);
    const firstUserText = opts.input.kind === "message" ? opts.input.text : "";
    // Ava names the chat from what it covered, and renames it as it moves on.
    // A chat the person renamed keeps their name.
    const title =
      opts.input.kind === "message" && !chat.renamed_at && TITLE_AFTER.has(personTurns(kept))
        ? await writeTitle(client, kept, tally)
        : null;
    const firstLine = plainTitle(firstUserText);
    const fallback =
      chat.api_messages.length === 0 && firstLine
        ? firstLine.slice(0, 72) + (firstLine.length > 72 ? "…" : "")
        : null;
    const coachId = mode === "admin" ? (coach?.id ?? null) : actor.actorUserId;
    await Promise.all([
      saveChat(chat.id, {
        api_messages: kept,
        opened_capabilities: [...opened],
        coach_id: coachId,
        model,
        ...(title || fallback ? { title: (title || fallback)! } : {}),
      }).catch((err) => console.error("agent saveChat failed:", err)),
      // What this turn cost (card 177), shown per coach on Coaches → Projects.
      logAiUsage({
        surface: "ava",
        mode,
        actorUserId: actor.actorUserId,
        coachId,
        chatId: chat.id,
        skills: [...opened],
        model,
        tally,
      }),
    ]);
    if (title || fallback) emit({ type: "title", title: (title || fallback)! });
    emit({ type: "done" });
  }
}
