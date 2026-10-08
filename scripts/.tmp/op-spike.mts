import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i), l.slice(i+1).replace(/^['"]|['"]$/g,"")];}));
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const tools: any[] = [
  { name: "open_capability", description: "Open a capability by id to get its instructions and tools. Ids: weather.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "get_weather", description: "Get the weather for a city.", input_schema: { type: "object", properties: { city: { type: "string" } }, required: ["city"] }, defer_loading: true },
];
const betas = ["mid-conversation-tool-changes-2026-07-01", "server-side-fallback-2026-07-01"];
const messages: any[] = [{ role: "user", content: "What's the weather in Leeds?" }];
for (let i = 0; i < 4; i++) {
  const stream = client.beta.messages.stream({ model: "claude-opus-5-5", max_tokens: 4000, betas, fallbacks: "default", output_config: { effort: "low" }, system: "You operate an app. Open a capability before using its tools.", tools, messages } as any);
  stream.on("text", (t) => process.stdout.write(t));
  const msg: any = await stream.finalMessage();
  console.log("\n-- stop:", msg.stop_reason, msg.model, JSON.stringify(msg.usage));
  console.log("blocks:", msg.content.map((b: any) => b.type + (b.name ? ":" + b.name : "")).join(", "));
  if (msg.stop_reason !== "tool_use") break;
  messages.push({ role: "assistant", content: msg.content });
  const results: any[] = []; let add: string[] = [];
  for (const b of msg.content) if (b.type === "tool_use") {
    if (b.name === "open_capability") { results.push({ type: "tool_result", tool_use_id: b.id, content: "Weather capability open. Use get_weather." }); add.push("get_weather"); }
    else results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ city: b.input.city, forecast: "Drizzle, 12C" }) });
  }
  messages.push({ role: "user", content: results });
  if (add.length) messages.push({ role: "system", content: add.map((n) => ({ type: "tool_addition", tool: { type: "tool_reference", name: n } })) });
}
