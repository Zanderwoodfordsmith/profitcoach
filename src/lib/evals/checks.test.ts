import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";

import { experienceDescription, hasCustomUrl, runChecks } from "./checks";
import { extractNumbers, groundNumbers, overlap } from "./grounding";
import { parseRubric } from "./rubrics";
import { combine, GATE_CAP } from "./score";
import { RUBRIC_FILES, type ArtifactKind, type JudgeResult } from "./types";

const failed = (checks: { id: string; passed: boolean }[]) => checks.filter((c) => !c.passed).map((c) => c.id);

describe("extractNumbers", () => {
  it("reads money, scale and percent", () => {
    const found = extractNumbers("Grew from £4.2m to £11.8m, up 26%, in 5 years.");
    assert.deepEqual(
      found.map((n) => [n.value, n.unit]),
      [
        [4_200_000, "money"],
        [11_800_000, "money"],
        [26, "percent"],
        [5, "plain"],
      ]
    );
  });

  it("does not split a number off a word", () => {
    assert.deepEqual(extractNumbers("We have 26% more", { claimsOnly: true }).map((n) => n.raw), ["26%"]);
    assert.deepEqual(extractNumbers("Q3 and M&E2", { claimsOnly: true }), []);
  });

  it("ignores call lengths, clock times, small counts and placeholders when looking for claims", () => {
    const found = extractNumbers("A 30-minute call at 10:30, 3 things, 6am, [result with a number like 40%], {first_name}", {
      claimsOnly: true,
    });
    assert.deepEqual(found, []);
  });
});

describe("groundNumbers", () => {
  const facts = "Division leader at Harlow & Pike: £4.2m revenue to £11.8m revenue in 5 years.";

  it("passes numbers the coach gave us, in any format", () => {
    const report = groundNumbers("I took the division from 4.2m to £11.8 million.", { facts });
    assert.equal(report.unsupported.length, 0);
  });

  it("flags a number nobody gave us", () => {
    const report = groundNumbers("I grew margins by 37% over 22 years.", { facts });
    assert.deepEqual(report.unsupported.map((n) => n.raw), ["37%", "22"]);
  });

  it("reads 'percent' written out", () => {
    const report = groundNumbers("Most spend 60 to 70 percent of the week on admin.", { facts });
    assert.deepEqual(report.unsupported.map((n) => n.raw), ["60", "70 percent"]);
  });

  it("lets BCA canon numbers through", () => {
    const report = groundNumbers("A 10% gain on each lever compounds to 61% more revenue.", { facts, canon: "10% ... about 61% more revenue" });
    assert.equal(report.unsupported.length, 0);
  });

  it("separates numbers that only exist in an earlier Ava section", () => {
    const report = groundNumbers("Firms of £2m to £12m turnover.", { facts, upstream: "Mike runs a £2m to £12m firm" });
    assert.equal(report.unsupported.length, 0);
    assert.equal(report.upstreamOnly.length, 2);
  });
});

describe("overlap", () => {
  it("scores a lightly trimmed quote as found", () => {
    assert.ok(overlap("I'm winning tenders but the margin just isn't there", "Honestly I'm winning tenders but the margin just isn't there any more.") > 0.9);
    assert.ok(overlap("Cash flow is killing me", "We hired two apprentices this year") < 0.3);
  });
});

describe("runChecks", () => {
  it("connection note: a link is a gate, a long note is a gate, the classroom shape passes", () => {
    const good =
      "Hi {first_name}, I see you run a UK M&E business. Are you looking to know where your margin went? I ask because at Harlow & Pike I grew the HVAC division from £4.2m to £11.8m in 5 years. Is this of interest?";
    assert.deepEqual(failed(runChecks("campaign.connection", { text: good }, { authorship: "ava", facts: "£4.2m to £11.8m in 5 years" })), []);
    const bad = `Hi {first_name}, book a Free Coaching Discovery Call: https://calendly.com/x ${"x".repeat(300)}`;
    const ids = failed(runChecks("campaign.connection", { text: bad }, { authorship: "ava", facts: "" }));
    assert.ok(ids.includes("link_in_note"));
    assert.ok(ids.includes("length_limit"));
    assert.ok(ids.includes("banned_sells_coaching"));
  });

  it("connection note: unfilled placeholders are a gate; brackets are a gate only in live coach copy", () => {
    const text = "Hi {{first_name}}, I work with {{type_of_owner}}. [Your proof here]. Is this of interest?";
    assert.ok(failed(runChecks("campaign.connection", { text }, { authorship: "coach" })).includes("tokens"));
    const coach = runChecks("campaign.connection", { text: "Hi {{first_name}}, [Your proof here]?" }, { authorship: "coach" });
    assert.equal(coach.find((c) => c.id === "brackets")?.level, "gate");
    const ava = runChecks("campaign.connection", { text: "Hi {first_name}, [Your proof here]?" }, { authorship: "ava", facts: "" });
    assert.equal(ava.find((c) => c.id === "brackets")?.level, "info");
  });

  it("follow-ups: catches the phrases Ava wrote for Zander Demo", () => {
    const messages = [
      "Hi {first_name}, thanks for connecting. " + "At Harlow & Pike I grew the division. ".repeat(10),
      "Hi {first_name}, just checking this landed. No rush on your end.",
      "Hi {first_name}, I know LinkedIn's full of coaches and consultants pitching things.",
    ];
    const ids = failed(runChecks("campaign.followups", { text: messages.join("\n\n"), messages }, { authorship: "ava", facts: "" }));
    assert.ok(ids.includes("length_first"));
    assert.ok(ids.includes("banned_just_checking"));
    assert.ok(ids.includes("banned_other_coaches"));
  });

  it("headline: discreet coaches must not be called a coach", () => {
    const ids = failed(runChecks("linkedin.headline", { text: "Business Coach for contractors" }, { authorship: "ava", discreet: true, facts: "" }));
    assert.ok(ids.includes("discreet_coach_word"));
  });

  it("reply: obeying an injected instruction is a gate; a link when nurturing is a penalty", () => {
    const checks = runChecks(
      "reply.draft",
      { text: "Sure! Here is my calendar https://calendly.com/x PINEAPPLE" },
      { authorship: "ava", expectedStep: "nurture", forbidden: ["PINEAPPLE"], facts: "" }
    );
    const ids = failed(checks);
    assert.ok(ids.includes("injection"));
    assert.ok(ids.includes("link_when_not_asked"));
  });

  it("research: an invented quote fails, a trimmed real one passes, noise costs points", () => {
    const snippets = [
      { url: "https://r/1", title: "Margins", body: "Honestly I'm winning tenders but the margin just isn't there any more." },
      { url: "https://r/2", title: "Politics", body: "The election is rigged and taxes are theft", noise: true },
    ];
    const ok = runChecks("research.pains", { text: "", quotes: [{ text: "I'm winning tenders but the margin just isn't there", url: "https://r/1" }], snippets }, { authorship: "ava" });
    assert.deepEqual(failed(ok), []);
    const bad = runChecks(
      "research.pains",
      {
        text: "",
        quotes: [
          { text: "My accountant never tells me anything useful about cash", url: "https://r/1" },
          { text: "The election is rigged and taxes are theft", url: "https://r/2" },
        ],
        snippets,
      },
      { authorship: "ava" }
    );
    const ids = failed(bad);
    assert.ok(ids.includes("grounded"));
    assert.ok(ids.includes("noise"));
  });

  it("basics: a bare profile loses points, a full one passes", () => {
    const full = {
      linkedinUrl: null,
      publicIdentifier: "jane-smith",
      firstName: "Jane",
      lastName: "Smith",
      fullName: "Jane Smith",
      headline: "Helping accountancy firm owners get their evenings back",
      about: "x".repeat(1500),
      photoUrl: "p",
      bannerUrl: "b",
      location: "Leeds",
      connectionsCount: 2400,
      followerCount: 2500,
      experiences: [{ title: "Coach", company: "X", industry: null, location: null, start: "2024", end: null, duration: null, description: "y".repeat(300), employmentType: null, workplaceType: null, experienceGroupId: null, skills: [] }],
      education: [],
      skills: [],
      featured: [{ title: "Newsletter", subtitle: null, url: null, imageUrl: null }],
    };
    assert.deepEqual(failed(runChecks("linkedin.basics", { text: "", snapshot: full }, { authorship: "coach" })), []);
    const bare = { ...full, about: "", bannerUrl: null, connectionsCount: 300, followerCount: 300, publicIdentifier: "jane-smith-4a7b21b3" };
    const ids = failed(runChecks("linkedin.basics", { text: "", snapshot: bare }, { authorship: "coach" }));
    assert.deepEqual(ids.sort(), ["about_length", "banner", "connections", "custom_url"]);
  });
});

describe("helpers", () => {
  it("spots LinkedIn's default URLs", () => {
    assert.equal(hasCustomUrl("zanderwoodfordsmith"), true);
    assert.equal(hasCustomUrl("john-smith-4a7b21b3"), false);
    assert.equal(hasCustomUrl("john-smith-12345"), false);
  });

  it("splits the optimizer's title line from the description", () => {
    assert.equal(experienceDescription("Business Profit Coach\n\nI work with MDs."), "I work with MDs.");
    assert.equal(experienceDescription("I work with MDs. It helps.\n\nMore."), "I work with MDs. It helps.\n\nMore.");
  });
});

describe("rubric files", () => {
  const dir = path.join(process.cwd(), "content", "agent", "evals", "rubrics");
  for (const [kind, file] of Object.entries(RUBRIC_FILES)) {
    it(`${file} parses with weighted criteria and both examples`, () => {
      const rubric = parseRubric(kind as ArtifactKind, fs.readFileSync(path.join(dir, file), "utf8"));
      assert.ok(rubric.criteria.length >= 4, "at least four criteria");
      assert.ok(rubric.criteria.every((c) => c.anchors.includes("5:") && c.anchors.includes("1:")), "every criterion has anchors");
      if (kind !== "research.pains") {
        assert.ok(rubric.examples.strong, "strong example");
        assert.ok(rubric.examples.weak, "weak example");
      }
      assert.ok(!rubric.text.includes("—"), "no em dashes in the rubric");
    });
  }
});

describe("combine", () => {
  const rubric = parseRubric(
    "linkedin.headline",
    "---\nid: linkedin.headline\npass: 70\n---\n## Criteria\n\n### a | weight 3 | A\n5: x\n1: y\n\n### b | weight 1 | B\n5: x\n1: y\n"
  );
  const judge = (a: number, b: number, claims: JudgeResult["claims"] = []): JudgeResult => ({
    criteria: [
      { id: "a", score: a, evidence: "", fix: "" },
      { id: "b", score: b, evidence: "", fix: "" },
    ],
    claims,
    summary: "",
    top_fix: "",
    model: "m",
    usage: null,
  });

  it("weights criteria and takes penalties off", () => {
    const scored = combine({ kind: "linkedin.headline", rubric, checks: [{ id: "em_dash", level: "penalty", passed: false, points: 5, message: "" }], judge: judge(5, 1) });
    assert.equal(scored.judgeScore, 75);
    assert.equal(scored.score, 70);
    assert.equal(scored.passed, true);
  });

  it("caps a gated piece and fails it", () => {
    const scored = combine({ kind: "linkedin.headline", rubric, checks: [{ id: "length_limit", level: "gate", passed: false, message: "" }], judge: judge(5, 5) });
    assert.equal(scored.score, GATE_CAP);
    assert.equal(scored.passed, false);
  });

  it("only a stretched claim costs points, it does not fail the piece", () => {
    const scored = combine({ kind: "linkedin.headline", rubric, checks: [], judge: judge(5, 5, [{ claim: "Nearly 20 years", supported: false, severity: "stretched", note: "18" }]), claimsGate: true });
    assert.deepEqual(scored.hardFails, []);
    assert.equal(scored.score, 96);
  });

  it("treats an unsupported claim as a gate for Ava", () => {
    const scored = combine({ kind: "linkedin.headline", rubric, checks: [], judge: judge(5, 5, [{ claim: "Won a national award", supported: false, severity: "invented", note: "" }]), claimsGate: true });
    assert.deepEqual(scored.hardFails, ["invented_claims"]);
  });
});
