import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkCampaign, unknownTokens } from "./launchCheck";

const codes = (issues: { code: string }[]) => issues.map((i) => i.code).sort();

describe("campaign launch check", () => {
  it("blocks tokens that won't fill in and glued greetings", () => {
    assert.deepEqual(unknownTokens("Hi {{first_name}}, {{market_observation}}"), ["{{market_observation}}"]);
    const issues = checkCampaign({
      steps: [
        { position: 0, step_type: "invite", body: "" },
        { position: 2, step_type: "message", body: "Hi{{first_name}}, I work with {{type_of_owner}}." },
      ],
      leads: [],
    });
    assert.ok(issues.some((i) => i.level === "blocker" && i.code === "unknown_token"));
    assert.ok(issues.some((i) => i.level === "blocker" && i.code === "glued_greeting"));
  });

  it("warns on a link in the note, the old check-in script and long messages", () => {
    const issues = checkCampaign({
      steps: [
        { position: 0, step_type: "invite", body: "Hi {{first_name}}, take my scorecard https://theprofitcoach.com/score/x" },
        { position: 2, step_type: "message", body: "Hey {{first_name}}! Just checking if you saw my last message?" },
        { position: 4, step_type: "message", body: `${"x".repeat(800)} Free Coaching Discovery Call, still a few left this week` },
      ],
      leads: [],
    });
    assert.deepEqual(codes(issues), ["fake_scarcity", "just_checking", "link_in_note", "long_message", "sells_coaching"]);
    assert.ok(issues.every((i) => i.level === "warning"));
  });

  it("warns about audiences that don't answer on LinkedIn", () => {
    const leads = Array.from({ length: 30 }, (_, i) => ({
      title: i % 2 ? "Owner" : "Managing Director",
      company: i < 15 ? "Smith Plumbing & Heating" : "Acme Ltd",
      location: "London, England, United Kingdom",
    }));
    const issues = checkCampaign({ steps: [], leads });
    assert.deepEqual(codes(issues), ["owner_titles", "trades_audience"]);
  });

  it("passes a clean campaign", () => {
    const issues = checkCampaign({
      steps: [
        { position: 0, step_type: "invite", body: "" },
        { position: 2, step_type: "message", body: "Thanks for connecting, {{first_name}}. Most Midlands owners I speak to say margins are the worry this year. True for you?" },
      ],
      leads: [],
    });
    assert.deepEqual(issues, []);
  });

  it("warns when most people are in a sector that rarely answers on LinkedIn", () => {
    const leads = Array.from({ length: 30 }, (_, i) => ({
      title: "Managing Director",
      company: i < 20 ? "Acme Precision Engineering Ltd" : "Blue Sky Software",
      location: "Coventry, England, United Kingdom",
    }));
    const issues = checkCampaign({ steps: [], leads });
    assert.deepEqual(codes(issues), ["low_linkedin_sector"]);
    assert.match(issues[0]!.message, /engineering & manufacturing, which scores 4\/10/);
  });
});
