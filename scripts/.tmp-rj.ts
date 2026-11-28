import { supabaseAdmin } from "@/lib/supabaseAdmin";
(async () => {
  const { data } = await supabaseAdmin.from("roadmap_jobs").select("job_number, title, status, done_when, notes, checklist, comments, impact, ease, created_at, updated_at, project, area").eq("job_number", 322).single();
  console.log(JSON.stringify(data, null, 2));
})();
