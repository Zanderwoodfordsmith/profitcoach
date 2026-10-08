import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("="); if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[t.slice(0, i).trim()] ??= v;
}
const { patchPracticeKnowledge } = await import("@/lib/practiceKnowledge/store");
const { sourced } = await import("@/lib/practiceKnowledge/sourced");
const row = await patchPracticeKnowledge({
  coachId: "5cb89c87-88a9-4cfc-9f95-9591f74f8529",
  payloadPatch: {
    market: {
      roles_held: sourced(["Operations Director, Harlow & Pike Building Services", "Contracts Manager, Harlow & Pike", "Project Engineer, Northern M&E"], "admin"),
      industries_worked: sourced(["Building services", "HVAC", "Mechanical and electrical contracting", "Facilities management"], "admin"),
    } as never,
    identity: { linkedin_url: sourced("https://www.linkedin.com/in/zander-demo", "admin"), location: sourced("Leeds, West Yorkshire", "admin") } as never,
  },
});
console.log(row.missing_fields, row.completeness_score);
