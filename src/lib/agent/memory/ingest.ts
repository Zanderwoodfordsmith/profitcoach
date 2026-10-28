import {
  ingestAvaChats,
  ingestLinkedInPosts,
  ingestNewsletters,
  ingestSalesCalls,
  ingestZoomCalls,
  type ConnectorResult,
  type NotesBudget,
} from "./connectors";
import { saveState, type MemorySource } from "./store";

/**
 * Runs every memory connector once. One failing never stops the others: its
 * error is logged and kept on its ava_memory_state row. maxNotes caps the
 * Haiku calls (and so the cost and time) of one run.
 */

const CONNECTORS: Array<{ source: MemorySource; run: (budget: NotesBudget) => Promise<ConnectorResult> }> = [
  { source: "ava_chat", run: ingestAvaChats },
  { source: "sales_call", run: ingestSalesCalls },
  { source: "zoom_call", run: ingestZoomCalls },
  { source: "linkedin_post", run: ingestLinkedInPosts },
  { source: "newsletter", run: ingestNewsletters },
];

export type IngestReport = {
  results: ConnectorResult[];
  errors: Array<{ source: MemorySource; error: string }>;
  costUsd: number;
  more: boolean;
};

export async function ingestAll(opts: { maxNotes?: number; only?: MemorySource[] } = {}): Promise<IngestReport> {
  const budget: NotesBudget = { left: opts.maxNotes ?? 20, costUsd: 0 };
  const results: ConnectorResult[] = [];
  const errors: IngestReport["errors"] = [];
  for (const connector of CONNECTORS) {
    if (opts.only && !opts.only.includes(connector.source)) continue;
    try {
      results.push(await connector.run(budget));
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`ava memory ${connector.source}:`, error);
      errors.push({ source: connector.source, error });
      await saveState(connector.source, { lastError: error.slice(0, 500) }).catch(() => {});
    }
  }
  return { results, errors, costUsd: budget.costUsd, more: results.some((r) => r.more) };
}
