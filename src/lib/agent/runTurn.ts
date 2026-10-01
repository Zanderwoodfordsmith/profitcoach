import Anthropic from "@anthropic-ai/sdk";

import { createPendingAction } from "./actions";
import type { AgentActor } from "./auth";
import {
  APP_EVENT_TAG,
  saveChat,
  WORKING_STATE_TAG,
  type AgentChatRow,
  type StoredMessage,
} from "./chatStore";
import { loadAgentCoach } from "./coaches";
import {
  capabilitiesForMode,
  capabilityContract,
  getCapability,
  loadIdentity,
  loadRouter,
} from "./context";
import {
  agentModel,
  DEFAULT_FALLBACK_BETA,
  modelSupportsDefaultFallback,
  modelSupportsEffort,
  modelSupportsToolChanges,
  TOOL_CHANGES_BETA,
} from "./model";
import { anthropicToolsForMode, getAgentTool, toolAllowedInMode } from "./tools";
import { OPEN_CAPABILITY_TOOL } from "./tools/core";
import { AgentToolError } from "./tools/util";
import type {
  AgentActionView,
  AgentCoach,
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

function systemPrompt(mode: AgentChatRow["mode"]): string {
  const ids = capabilitiesForMode(mode).map((cap) => cap.id);
  return [
    loadIdentity(),
    loadRouter(),
    `# This session\nMode: ${mode}. Capabilities you can open: ${ids.join(", ")}.`,
  ].join("\n\n---\n\n");
}

function workingState(opts: {
  mode: AgentChatRow["mode"];
  coach: AgentCoach | null;
  screenPath: string | null;
  opened: string[];
}): string {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
  const lines = [
    `Mode: ${opts.mode}`,
    `Active coach: ${opts.coach ? opts.coach.name : opts.mode === "admin" ? "none chosen yet" : "you (the coach)"}`,
    `Page open: ${opts.screenPath ?? "unknown"}`,
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
    action.status === "done"
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
  const mode = chat.mode;
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
  // A capability counts as open only if its tools are still revealed.
  const opened = new Set(
    (chat.opened_capabilities ?? []).filter(
      (id) =>
        !toolChanges ||
        (getCapability(id, mode)?.tools ?? []).every((name) => {
          const tool = getAgentTool(name);
          return !tool || tool.core || !toolAllowedInMode(tool, mode) || revealed.has(name);
        })
    )
  );

  emit({ type: "chat", chatId: chat.id, coach, mode });

  const messages: StoredMessage[] = [...chat.api_messages];
  messages.push({
    role: "user",
    content: [
      {
        type: "text",
        text: workingState({ mode, coach, screenPath: opts.screenPath, opened: [...opened] }),
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

  const tools = anthropicToolsForMode(mode).map((tool) =>
    toolChanges ? tool : { ...tool, defer_loading: undefined }
  );
  const betas = [
    ...(toolChanges ? [TOOL_CHANGES_BETA] : []),
    ...(modelSupportsDefaultFallback(model) ? [DEFAULT_FALLBACK_BETA] : []),
  ];
  const system = systemPrompt(mode);
  const client = new Anthropic();

  async function runTool(block: Anthropic.Beta.Messages.BetaToolUseBlock): Promise<{
    content: string;
    isError: boolean;
    additions: string[];
  }> {
    const input = (block.input ?? {}) as AgentToolInput;

    if (block.name === OPEN_CAPABILITY_TOOL) {
      const id = typeof input.id === "string" ? input.id.trim() : "";
      const capability = getCapability(id, mode);
      if (!capability) {
        const ids = capabilitiesForMode(mode).map((cap) => cap.id).join(", ");
        return { content: `No capability "${id}". Open one of: ${ids}.`, isError: true, additions: [] };
      }
      const additions = capability.tools.filter((name) => {
        const tool = getAgentTool(name);
        return tool && !tool.core && toolAllowedInMode(tool, mode) && !revealed.has(name);
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
    if (!tool || !toolAllowedInMode(tool, mode)) {
      return { content: `Unknown tool ${block.name}.`, isError: true, additions: [] };
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
            input,
            title: decision.title,
            details: decision.details,
            warning: decision.warning,
          });
          emit({ type: "tool_end", id: block.id, name: tool.name, ok: true });
          emit({ type: "action", action });
          return {
            content: JSON.stringify({
              status: "awaiting_confirmation",
              action_id: action.id,
              card: action.title,
            }),
            isError: false,
            additions: [],
          };
        }
      }
      const result = await tool.run(input, ctx);
      emit({ type: "tool_end", id: block.id, name: tool.name, ok: true });
      const link = (result as { _link?: { href?: unknown; label?: unknown } } | null)?._link;
      if (link && typeof link.href === "string") {
        emit({ type: "link", link: { href: link.href, label: String(link.label ?? "Open") } });
      }
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
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
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
    const firstUserText = opts.input.kind === "message" ? opts.input.text : "";
    await saveChat(chat.id, {
      api_messages: messages.slice(0, committed),
      opened_capabilities: [...opened],
      coach_id: mode === "admin" ? (coach?.id ?? null) : actor.actorUserId,
      model,
      ...(chat.api_messages.length === 0 && firstUserText
        ? { title: firstUserText.slice(0, 72) + (firstUserText.length > 72 ? "…" : "") }
        : {}),
    }).catch((err) => console.error("agent saveChat failed:", err));
    emit({ type: "done" });
  }
}
