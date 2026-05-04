/** Stored on profiles.ai_context (jsonb) */
export type CoachAiContext = {
  superpowers?: string;
  hobbies_and_recent?: string;
  client_results?: Array<{ title: string; story: string }>;
};

export type AiContextKey = keyof CoachAiContext;

export type KnowledgeRef =
  | { type: "playbook"; path: string }
  | { type: "ai-knowledge"; file: string }
  | { type: "legacy-knowledge"; file: string };

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
};

export type ProfitCoachRoleDefinition = {
  id: string;
  label: string;
  description: string;
  outputIds: string[];
};
