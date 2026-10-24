import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { averageReports } from "./ai";
import { CLIENTS } from "./clients";
import { DIFFICULTIES, PUSHBACK_HELP } from "./difficulty";
import { clientFirstMessage, clientPrompt } from "./prompt";
import { POWER, SITUATIONS } from "./situations";
import type { SimReport } from "./types";

const unique = (ids: string[]) => new Set(ids).size === ids.length;

describe("client simulator content", () => {
  it("every situation has five uniquely named parts", () => {
    for (const s of SITUATIONS) {
      assert.equal(s.stages.length, 5, s.id);
      assert.ok(unique(s.stages.map((x) => x.id)), s.id);
    }
    assert.equal(POWER.length, 5);
    assert.ok(unique(SITUATIONS.map((s) => s.id)));
  });

  it("every client has a face, a voice, unique facts and pushback help", () => {
    for (const c of CLIENTS) {
      assert.ok(existsSync(path.join(process.cwd(), "public", c.face)), c.face);
      assert.ok(c.voiceId.length > 10, c.id);
      assert.ok(c.facts.length >= 6, c.id);
      assert.ok(unique(c.facts.map((f) => f.id)), c.id);
      assert.ok(c.facts.every((f) => f.hint.length > 3), `${c.id} needs a hint on every fact`);
      assert.ok(PUSHBACK_HELP[c.pushback.kind], c.id);
    }
  });

  it("builds a clean prompt for every client, situation and level", () => {
    for (const client of CLIENTS) {
      for (const situation of SITUATIONS) {
        for (const d of DIFFICULTIES) {
          const prompt = clientPrompt({ client, situation, difficulty: d.id, mode: "practice", coachName: "Sam", previous: null });
          const first = clientFirstMessage({ client, situation, difficulty: d.id, coachName: "Sam" });
          const where = `${client.id}/${situation.id}/${d.id}`;
          assert.ok(!/undefined|null|\[object/.test(prompt + first), where);
          assert.ok(prompt.includes(situation.title), where);
          assert.ok(first.length > 0, where);
        }
      }
    }
  });

  it("follows the writing rules: no em dashes anywhere", () => {
    const all = JSON.stringify({ CLIENTS, SITUATIONS, POWER, DIFFICULTIES, PUSHBACK_HELP });
    assert.ok(!all.includes("—"), "em dash found");
  });
});

describe("certification scoring", () => {
  const report = (scores: number[]): { report: SimReport; score: number } => {
    const area = (id: string, score: number) => ({ id, label: id, score, evidence: "e", better: "b" });
    const r: SimReport = {
      summary: "s",
      stages: scores.slice(0, 5).map((n, i) => area(`s${i}`, n)),
      power: scores.slice(5).map((n, i) => area(`p${i}`, n)),
      strongest: "",
      focus: [],
      moments: [],
      oneThing: "",
      agreedActions: [],
      found: [],
    };
    return { report: r, score: scores.reduce((a, b) => a + b, 0) };
  };

  it("averages two examiners area by area, halves to the nearest even, and flags big splits", () => {
    const a = report([3, 3, 2, 4, 4, 3, 3, 3, 4, 4]);
    const b = report([4, 3, 4, 4, 2, 3, 4, 3, 4, 5]);
    const { report: r, score } = averageReports(a, b);
    assert.deepEqual(
      [...r.stages, ...r.power].map((x) => x.score),
      [4, 3, 3, 4, 3, 3, 4, 3, 4, 4]
    );
    assert.equal(score, 35);
    assert.deepEqual(r.passes, [33, 36]);
    assert.match(r.stages[2].evidence, /differed here: 2 and 4/);
    assert.doesNotMatch(r.stages[0].evidence, /differed/);
  });
});
