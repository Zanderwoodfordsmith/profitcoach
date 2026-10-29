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

/** Brand canon in content/ai-knowledge, editable in Admin → Brand → Core brain. */
export type BrandFileName =
  | "methodology.md"
  | "icp.md"
  | "business-profile.md"
  | "brand-voice.md"
  | "offer-stack.md"
  | "writing-rules.md"
  | "avatar-profile.md"
  | "copywriter-knowledge.md"
  | "copywriting-method.md";

export type KnowledgeRef =
  | { type: "playbook"; path: string }
  | { type: "ai-knowledge"; file: string }
  | { type: "legacy-knowledge"; file: string }
  /** A method file under content/practice-skills (shared with the Blueprint and Ava). */
  | { type: "practice-skill"; file: string };

/** DB-backed prompt editors in Admin → Brand → Core brain → Skills. */
export type ProfitCoachPromptEditor =
  | "coach-ai"
  | "linkedin-optimizer"
  | "reply-copilot";

export type ProfitCoachOutputDefinition = {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  /** Skill-specific system instructions */
  systemInstructions: string;
  knowledgeRefs: KnowledgeRef[];
  /** The brand canon files (content/ai-knowledge) this skill reads; nothing else loads. */
  brandFiles: BrandFileName[];
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
