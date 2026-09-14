import { NextResponse } from "next/server";
import { requireShareCoach } from "@/lib/shareLinks/requireShareCoach";
import { sanitizeShareUrl } from "@/lib/shareLinks/sanitizeUrl";
import {
  CUSTOM_LINKS_MAX,
  CUSTOM_LINK_DESCRIPTION_MAX,
  CUSTOM_LINK_TITLE_MAX,
} from "@/lib/shareLinks/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

export async function POST(request: Request) {
  const auth = await requireShareCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    url?: string;
    description?: string | null;
  };

  const title = clip(body.title ?? "", CUSTOM_LINK_TITLE_MAX);
  if (!title) {
    return NextResponse.json({ error: "Add a title." }, { status: 400 });
  }

  const parsed = sanitizeShareUrl(body.url ?? "");
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const descriptionRaw = (body.description ?? "").trim();
  const description = descriptionRaw
    ? clip(descriptionRaw, CUSTOM_LINK_DESCRIPTION_MAX)
    : null;

  const { count, error: countError } = await supabaseAdmin
    .from("coach_custom_links")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", auth.coachId);

  if (countError && countError.code !== "42P01") {
    return NextResponse.json({ error: "Could not save the link." }, { status: 500 });
  }
  if ((count ?? 0) >= CUSTOM_LINKS_MAX) {
    return NextResponse.json(
      { error: `You can save up to ${CUSTOM_LINKS_MAX} custom links.` },
      { status: 400 }
    );
  }

  const { data: last } = await supabaseAdmin
    .from("coach_custom_links")
    .select("sort_order")
    .eq("coach_id", auth.coachId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder =
    typeof last?.sort_order === "number" ? last.sort_order + 1 : 0;

  const { data, error } = await supabaseAdmin
    .from("coach_custom_links")
    .insert({
      coach_id: auth.coachId,
      title,
      url: parsed.url,
      description,
      sort_order: sortOrder,
    })
    .select("id, title, url, description, sort_order")
    .maybeSingle();

  if (error?.code === "42P01") {
    return NextResponse.json(
      { error: "Custom links are not available yet. Apply the latest database migration." },
      { status: 503 }
    );
  }
  if (error || !data) {
    return NextResponse.json({ error: "Could not save the link." }, { status: 500 });
  }

  return NextResponse.json({ link: data });
}
