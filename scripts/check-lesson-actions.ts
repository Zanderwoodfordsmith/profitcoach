import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select("course_id, lesson_id, recommended_actions")
    .in("lesson_id", [
      "kickstart-welcome-introduce-yourself",
      "kickstart-welcome-calendar-calls",
      "client-acquisition-ideal-clients-linkedin-sales-navigator-build-your-base-search",
    ]);

  console.log("error:", error);
  console.log(JSON.stringify(data, null, 2));
}

void main();
