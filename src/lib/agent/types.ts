import type Anthropic from "@anthropic-ai/sdk";

/**
 * Shared types for the AI Agent: tool definitions, the per-call context, and
 * the NDJSON events the chat route streams to the panel.
 */

export type AgentMode = "admin" | "coach";

export type AgentCoach = { id: string; name: string };

export type AgentToolContext = {
  mode: AgentMode;
  actorUserId: string;
  chatId: string;
  /** Who the agent is acting on. Null in admin mode until a coach is chosen. */
  coach: AgentCoach | null;
  /** Admin mode only: change the active coach for the rest of the chat. */
  setCoach: (coach: AgentCoach) => void;
  /** The page the person had open when they sent the message. */
  screenPath: string | null;
};

/** A row on a confirmation card. */
export type ActionDetail = { label: string; value: string };

export type GateDecision =
  | { confirm: false }
  | {
      confirm: true;
      title: string;
      details: ActionDetail[];
      /** Shown on the card, e.g. "Adds people to a running campaign: invites start today." */
      warning?: string;
    }
  /** The input is not valid: tell the model instead of making a card. */
  | { error: string };

export type AgentToolInput = Record<string, unknown>;

export type AgentToolDef = {
  name: string;
  /** Short label for the activity chip, e.g. "Looking at campaigns". */
  label: string;
  description: string;
  input_schema: Anthropic.Messages.Tool.InputSchema;
  /** Default: both modes. */
  modes?: AgentMode[];
  /** Always loaded. Everything else is deferred until a capability opens it. */
  core?: boolean;
  /** Most tools act on the active coach and fail without one. */
  needsCoach?: boolean;
  /**
   * Called before run. Returning confirm makes a pending action instead of
   * running; the person confirms it from a card.
   */
  gate?: (
    input: AgentToolInput,
    ctx: AgentToolContext
  ) => Promise<GateDecision> | GateDecision;
  run: (input: AgentToolInput, ctx: AgentToolContext) => Promise<unknown>;
};

export type AgentActionStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export type AgentActionView = {
  id: string;
  tool: string;
  title: string;
  details: ActionDetail[];
  warning?: string | null;
  coachName: string | null;
  status: AgentActionStatus;
  result: unknown;
  error: string | null;
};

export type AgentLink = { href: string; label: string };

/** One line of the NDJSON stream from POST /api/agent/chat. */
export type AgentStreamEvent =
  | { type: "chat"; chatId: string; coach: AgentCoach | null; mode: AgentMode }
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; label: string }
  | { type: "tool_end"; id: string; name: string; ok: boolean; note?: string }
  | { type: "capability"; id: string; title: string }
  | { type: "action"; action: AgentActionView }
  | { type: "link"; link: AgentLink }
  | { type: "coach"; coach: AgentCoach }
  | { type: "error"; message: string }
  | { type: "done" };

/** The chat as the panel renders it (live and from history). */
export type AgentDisplayItem =
  | { type: "user"; text: string }
  | { type: "assistant"; text: string }
  | { type: "app_event"; text: string }
  | { type: "tool"; id: string; name: string; label: string; ok: boolean | null }
  | { type: "capability"; id: string; title: string }
  | { type: "action"; action: AgentActionView }
  | { type: "link"; link: AgentLink };
