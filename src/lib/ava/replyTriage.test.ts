import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatThread, parseTriage } from "./replyTriage";

describe("reply triage parsing", () => {
  it("reads the model's JSON and clamps unknown values", () => {
    const out = parseTriage('Sure: {"disposition":"interested","situation":"interested","next_step":"calendar","confidence":0.9,"reason":"Asked for times."}');
    assert.deepEqual(out, { disposition: "interested", situation: "interested", nextStep: "calendar", confidence: 0.9, reason: "Asked for times." });
    const bad = parseTriage('{"disposition":"yes please","next_step":"send everything","confidence":7}');
    assert.equal(bad?.disposition, "neutral");
    assert.equal(bad?.nextStep, "human");
    assert.equal(bad?.confidence, 1);
    assert.equal(parseTriage("no json here"), null);
  });

  it("labels who said what and keeps the last ten messages", () => {
    const thread = Array.from({ length: 12 }, (_, i) => ({ direction: (i % 2 ? "inbound" : "outbound") as "inbound" | "outbound", text: `m${i}` }));
    const text = formatThread(thread);
    assert.equal(text.split("\n").length, 10);
    assert.ok(text.endsWith("PROSPECT: m11"));
  });
});
