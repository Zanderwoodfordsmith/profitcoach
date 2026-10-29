/**
 * The old Retell simulators (Jun 2025 to Oct 2026) and the in-app client each
 * became. Their calls are in retell_practice_calls (scripts/retell-import.ts).
 * The transcripts use the Retell client's name, so pages show that name.
 */
export const RETELL_AGENTS: { match: RegExp; clientId: string; oldName: string; business: string }[] = [
  { match: /Time-management/i, clientId: "jess", oldName: "Sarah", business: "Marketing agency" },
  { match: /Management Consultant/i, clientId: "sarah", oldName: "Sarah Chen", business: "Management consultancy" },
  { match: /Chiropractor/i, clientId: "marcus", oldName: "Marcus", business: "Chiropractic clinics" },
  { match: /Manufacturing/i, clientId: "david", oldName: "David", business: "Manufacturing" },
  { match: /Thai Restaurant/i, clientId: "kit", oldName: "Anna", business: "Thai restaurant" },
  { match: /Trophy/i, clientId: "helen", oldName: "Helen", business: "Trophy business (certification)" },
  { match: /Legal SaaS/i, clientId: "priya", oldName: "Alex", business: "Legal services and software" },
];

export function retellAgent(clientId: string | null) {
  return RETELL_AGENTS.find((a) => a.clientId === clientId) ?? null;
}

export type RetellCallSummary = {
  call_id: string;
  client_id: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  started_at: string;
  duration_seconds: number;
  coach_id: string | null;
  coach_name_heard: string | null;
  score: number | null;
  /** Area scores only, for the averages. */
  areas: { label: string; score: number }[];
};
