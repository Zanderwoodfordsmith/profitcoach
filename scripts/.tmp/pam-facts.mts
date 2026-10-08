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
// Facts from Pam's own published material (Value Session workbook, theprofitcoach.com/pam).
const row = await patchPracticeKnowledge({
  coachId: "485e5b67-9cef-44ce-94f1-f5b2d560869a",
  payloadPatch: {
    identity: {
      phone: sourced("07540 888016", "admin"),
      practice_email: sourced("Own address: pam@theprofitcoach.com", "admin"),
      web_address: sourced("Profit Coach page: theprofitcoach.com/pam", "admin"),
      linkedin_visibility: sourced("public", "admin"),
    } as never,
    proof: {
      client_results: sourced([
        {
          id: "john-davy",
          title: "John Davy, business owner (testimonial)",
          story:
            "I believe that Pam is the best coach I have ever, ever had. She's professional and insightful and the sessions that we've had fundamentally changed the way I do business; specifically I can point to huge amounts of profit in my various companies that Pam and only Pam recognised. Her fees are completely outstripped by the money that you will get back.",
        },
      ], "admin"),
    } as never,
  },
});
console.log(row.missing_fields, row.completeness_score);
