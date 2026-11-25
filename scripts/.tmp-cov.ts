async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { linkedinUrlVariants } = await import("../src/lib/leads/leadCard");
  const { data } = await supabaseAdmin.from("coach_lead_list_items").select("full_name, company, linkedin_url, raw").eq("coach_id", "5cb89c87-88a9-4cfc-9f95-9591f74f8529").not("linkedin_url", "is", null).limit(40);
  let inCache = 0, withId = 0, rawId = 0;
  for (const r of data ?? []) {
    const raw = (r.raw ?? {}) as Record<string, any>;
    if (JSON.stringify(raw).includes("company_id")) rawId++;
    const { data: c } = await supabaseAdmin.from("leadrocks_leads").select("raw").in("linkedin_url", linkedinUrlVariants(r.linkedin_url!)).limit(1);
    if (c?.length) { inCache++; const id = (c[0].raw as any)?.sales_nav?.current_positions?.[0]?.company_id; if (id) withId++; else if (inCache < 30) console.log("no id:", r.full_name, "|", r.company, "| keys:", Object.keys((c[0].raw as any) ?? {}).join(",")); }
  }
  console.log({ rows: data?.length, inCache, withId, rawId });
  console.log("pool raw keys sample:", Object.keys(((data ?? [])[0]?.raw ?? {}) as object));
}
main();
