import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPlaybookMeta } from "@/lib/bossData";
import { loadPlaybookContentWithDb } from "@/lib/playbookContent";
import type {
  PlaybookContent,
  PlayItem,
  PlaySection,
  RelatedPlaybookItem,
  WhatItLooksLikeItem,
} from "@/lib/playbookContentTypes";
import { normalizeRelatedPlaybooks } from "@/lib/playbookContentTypes";

type Body = {
  whatThisIs?: string;
  whatItLooksLike?: {
    broken?: Partial<WhatItLooksLikeItem>;
    ok?: Partial<WhatItLooksLikeItem>;
    working?: Partial<WhatItLooksLikeItem>;
  };
  thingsToThinkAbout?: string[];
  plays?: PlayItem[];
  playsIntro?: string;
  playsSections?: PlaySection[];
  quickWins?: string[];
  relatedPlaybooks?: (string | RelatedPlaybookItem)[];
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ ref: string }> }
) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { ref } = await context.params;
  const meta = getPlaybookMeta(ref);
  if (!meta) {
    return NextResponse.json({ error: "Playbook not found." }, { status: 404 });
  }

  const body = (await request.json()) as Body;

  const { data: existing } = await supabaseAdmin
    .from("playbook_content")
    .select("*")
    .eq("ref", ref)
    .maybeSingle();

  const existingRow = existing as {
    what_this_is: string | null;
    what_it_looks_like: Record<string, unknown> | null;
    things_to_think_about: string[] | null;
    plays: PlayItem[] | null;
    plays_intro: string | null;
    plays_sections: PlaySection[] | null;
    quick_wins: string[] | null;
    related_playbooks: string[] | null;
  } | null;

  const whatThisIs = body.whatThisIs ?? existingRow?.what_this_is ?? "";
  const whatItLooksLike = body.whatItLooksLike
    ? {
        broken: {
          label: body.whatItLooksLike.broken?.label ?? "When this is broken",
          emoji: body.whatItLooksLike.broken?.emoji ?? "🔴",
          content: body.whatItLooksLike.broken?.content ?? "",
        },
        ok: {
          label: body.whatItLooksLike.ok?.label ?? "When this is OK",
          emoji: body.whatItLooksLike.ok?.emoji ?? "🟠",
          content: body.whatItLooksLike.ok?.content ?? "",
        },
        working: {
          label: body.whatItLooksLike.working?.label ?? "When this is working",
          emoji: body.whatItLooksLike.working?.emoji ?? "🟢",
          content: body.whatItLooksLike.working?.content ?? "",
        },
      }
    : (existingRow?.what_it_looks_like as Record<string, unknown>) ?? {
        broken: { label: "When this is broken", emoji: "🔴", content: "" },
        ok: { label: "When this is OK", emoji: "🟠", content: "" },
        working: { label: "When this is working", emoji: "🟢", content: "" },
      };
  const thingsToThinkAbout = body.thingsToThinkAbout ?? existingRow?.things_to_think_about ?? [];
  const plays = body.plays ?? existingRow?.plays ?? [];
  const playsIntro = body.playsIntro !== undefined ? body.playsIntro : (existingRow?.plays_intro ?? "");
  const playsSections = body.playsSections ?? existingRow?.plays_sections ?? [];
  const quickWins = body.quickWins ?? existingRow?.quick_wins ?? [];
  const relatedPlaybooks = normalizeRelatedPlaybooks(
    body.relatedPlaybooks ?? existingRow?.related_playbooks ?? []
  );

  const row = {
    ref,
    what_this_is: whatThisIs,
    what_it_looks_like: whatItLooksLike,
    things_to_think_about: thingsToThinkAbout,
    plays,
    plays_intro: playsIntro || null,
    plays_sections: playsSections.length ? playsSections : [],
    quick_wins: quickWins,
    related_playbooks: relatedPlaybooks.map((r) => ({ ref: r.ref, description: r.description ?? "" })),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("playbook_content")
    .upsert(row, { onConflict: "ref" });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to save content." },
      { status: 500 }
    );
  }

  const content = await loadPlaybookContentWithDb(ref);
  return NextResponse.json(content);
}
