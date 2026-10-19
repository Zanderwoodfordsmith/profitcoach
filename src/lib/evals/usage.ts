import { AsyncLocalStorage } from "node:async_hooks";

import Anthropic from "@anthropic-ai/sdk";

import type { ModelUsage } from "./types";

/**
 * Token use and cost for every Claude call an eval makes, including calls the
 * production code makes on its own client (the writers, triage, the copilot).
 * Messages.create is wrapped once per process; calls are attributed to the
 * case that is running through AsyncLocalStorage. Eval scripts only.
 */

/** $ per million tokens: input, output. Cache reads 0.1x input, writes 1.25x. */
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25],
  "claude-opus-4-8": [5, 25],
  "claude-opus-4-7": [5, 25],
  "claude-opus-4-6": [5, 25],
  "claude-sonnet-5-5": [2, 10],
  "claude-sonnet-5": [2, 10],
  "claude-sonnet-4-6": [3, 15],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-haiku-4-5": [1, 5],
  "claude-fable-5-1": [10, 50],
};

export function priceFor(model: string): [number, number] {
  const key = Object.keys(PRICES).find((k) => model === k || model.startsWith(`${k}-`));
  return key ? PRICES[key]! : [5, 25];
}

export function usageFromResponse(model: string, response: Anthropic.Messages.Message, ms: number): ModelUsage {
  const u = response.usage;
  const [inPrice, outPrice] = priceFor(response.model || model);
  const input = u.input_tokens ?? 0;
  const output = u.output_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const cost = (input * inPrice + output * outPrice + cacheRead * inPrice * 0.1 + cacheWrite * inPrice * 1.25) / 1e6;
  return {
    model: response.model || model,
    input_tokens: input,
    output_tokens: output,
    cache_read_input_tokens: cacheRead,
    cache_creation_input_tokens: cacheWrite,
    cost_usd: Number(cost.toFixed(6)),
    stop_reason: response.stop_reason ?? null,
    ms,
  };
}

export type CapturedCall = ModelUsage & {
  requested_model: string;
  system: string;
  user: string;
  output: string;
};

const store = new AsyncLocalStorage<CapturedCall[]>();
let patched = false;

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b && typeof b === "object" && "text" in b ? String((b as { text: unknown }).text ?? "") : ""))
      .join("\n");
  }
  return "";
}

/** Wrap Messages.create so production calls report their usage. Safe to call more than once. */
export function installUsageCapture(): void {
  if (patched) return;
  patched = true;
  const proto = Anthropic.Messages.prototype as unknown as {
    create: (this: unknown, body: Record<string, unknown>, options?: unknown) => Promise<unknown>;
  };
  const original = proto.create;
  proto.create = function patchedCreate(this: unknown, body: Record<string, unknown>, options?: unknown) {
    const started = Date.now();
    const result = original.call(this, body, options);
    const calls = store.getStore();
    if (!calls || body?.stream) return result;
    return Promise.resolve(result).then((response) => {
      const message = response as Anthropic.Messages.Message;
      if (message && typeof message === "object" && "usage" in message) {
        const messages = Array.isArray(body.messages) ? (body.messages as { content: unknown }[]) : [];
        calls.push({
          ...usageFromResponse(String(body.model ?? ""), message, Date.now() - started),
          requested_model: String(body.model ?? ""),
          system: textOf(body.system),
          user: messages.map((m) => textOf(m.content)).join("\n\n---\n\n"),
          output: textOf(message.content),
        });
      }
      return response;
    });
  };
}

/** Run fn and return the Claude calls it made, in order. */
export async function withCapture<T>(fn: () => Promise<T>): Promise<{ result: T; calls: CapturedCall[] }> {
  installUsageCapture();
  const calls: CapturedCall[] = [];
  const result = await store.run(calls, fn);
  return { result, calls };
}

export function totalCost(calls: { cost_usd: number }[]): number {
  return Number(calls.reduce((sum, c) => sum + (c.cost_usd || 0), 0).toFixed(6));
}
