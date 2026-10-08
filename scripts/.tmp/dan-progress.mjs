import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const DAN = "cb501f32-6c3e-41ef-b1fa-9bc44916df7c";
for (const ch of ["linkedin", "email", "whatsapp"]) {
  const { count } = await sb
    .from("messaging_messages")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", DAN)
    .eq("channel", ch);
  const { count: convs } = await sb
    .from("messaging_conversations")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", DAN)
    .eq("last_channel", ch);
  const { data: latest } = await sb
    .from("messaging_messages")
    .select("created_at, direction")
    .eq("coach_id", DAN)
    .eq("channel", ch)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log(ch, { messages: count, conversations: convs, latest });
}
