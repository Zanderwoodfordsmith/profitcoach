/** Stored on profiles.ai_context (jsonb) */
export type CoachAiContext = {
  superpowers?: string;
  hobbies_and_recent?: string;
  client_results?: Array<{ title: string; story: string }>;
  /** First Campaign / ICP — confirmed by coach */
  ideal_client?: string;
  industry_vocabulary?: string;
  pain_language?: string;
  messaging_hooks?: string;
  proof_framing?: string;
};

export type AiContextKey = keyof CoachAiContext;

export type KnowledgeRef =
  | { type: "playbook"; path: string }
  | { type: "ai-knowledge"; file: string }
  | { type: "legacy-knowledge"; file: string };

/** DB-backed prompt editors in Admin → Brand → Core brain → Skills. */
export type ProfitCoachPromptEditor = "coach-ai" | "linkedin-optimizer";

export type ProfitCoachOutputDefinition = {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  /** Skill-specific system instructions */
  systemInstructions: string;
  knowledgeRefs: KnowledgeRef[];
  /** If true, load tier-2 marketing ICP extract */
  useMarketingIcpTier2?: boolean;
  /** Which ai_context keys improve this skill; model nudges when empty */
  contextHints?: {
    keys: AiContextKey[];
    encouragement: string;
  };
  /** Shown in coach Create / AI panel skill picker. Default true. */
  coachPicker?: boolean;
  /** Instructions live in the DB; edited in admin instead of code. */
  promptEditor?: ProfitCoachPromptEditor;
};

export type ProfitCoachRoleDefinition = {
  id: string;
  label: string;
  description: string;
  outputIds: string[];
};
