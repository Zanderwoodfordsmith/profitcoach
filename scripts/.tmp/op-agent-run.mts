import * as fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}
const { runAgentTurn } = await import("@/lib/agent/runTurn");
const { createChat, loadChat } = await import("@/lib/agent/chatStore");
const { decideAction, loadChatActions } = await import("@/lib/agent/actions");

const asCoach = process.env.AGENT_TEST_MODE === "coach";
const actor = asCoach ? { actorUserId: "5cb89c87-88a9-4cfc-9f95-9591f74f8529", isAdmin: false, mode: "coach" as const, impersonatedCoachId: null } : { actorUserId: "01df174c-646c-4a29-8e76-9d0132735434", isAdmin: true, mode: "admin" as const, impersonatedCoachId: null };
const script: string[] = JSON.parse(process.argv[2]);
let chatId = process.argv[3] || "";
if (!chatId) chatId = (await createChat({ actorUserId: actor.actorUserId, mode: actor.mode, coachId: asCoach ? actor.actorUserId : null })).id;
console.log("CHAT", chatId);
let lastAction: string | null = null;
for (const step of script) {
  const chat = (await loadChat(chatId, actor.actorUserId))!;
  let input: any;
  if (step === "!confirm" || step === "!cancel") {
    if (!lastAction) { console.log("no action"); continue; }
    const { action } = await decideAction({ actionId: lastAction, actor, decision: step === "!confirm" ? "confirm" : "cancel" });
    console.log(`\n### ${step} -> ${action.status} ${JSON.stringify(action.result ?? action.error)}`);
    input = { kind: "action", action };
  } else {
    console.log(`\n### USER: ${step}`);
    input = { kind: "message", text: step };
  }
  let text = "";
  const t0 = Date.now();
  await runAgentTurn({ actor, chat, input, screenPath: asCoach ? "/coach/campaigns" : "/admin/campaigns", emit: (e: any) => {
    if (e.type === "text") { text += e.delta; return; }
    if (text) { console.log(`AI: ${text.trim()}`); text = ""; }
    if (e.type === "tool_start") console.log(`  [tool] ${e.name}`);
    else if (e.type === "tool_end") console.log(`  [tool done] ${e.name} ok=${e.ok}${e.note ? " " + e.note : ""}`);
    else if (e.type === "capability") console.log(`  [open] ${e.id}`);
    else if (e.type === "action") { lastAction = e.action.id; console.log(`  [CARD] ${e.action.title} | ${e.action.details.map((d: any) => d.label + ": " + d.value).join(" | ")}${e.action.warning ? " | WARN " + e.action.warning : ""}`); }
    else if (e.type === "link") console.log(`  [link] ${e.link.label}`);
    else if (e.type === "coach") console.log(`  [coach] ${e.coach.name}`);
    else if (e.type === "error") console.log(`  [ERROR] ${e.message}`);
  }});
  if (text) console.log(`AI: ${text.trim()}`);
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
