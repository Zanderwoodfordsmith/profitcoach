import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPlaybookMeta } from "@/lib/bossData";
import { loadPlaybookContentWithDb } from "@/lib/playbookContent";
import type {
  ActionItem,
  ActionSection,
  PlaybookContent,
  RelatedPlaybookItem,
  WhatItLooksLikeItem,
} from "@/lib/playbookContentTypes";
import { normalizeRelatedPlaybooks, serializeActionSectionsForDb } from "@/lib/playbookContentTypes";

type Body = {
  whatThisIs?: string;
  whatItLooksLike?: {
    broken?: Partial<WhatItLooksLikeItem>;
    ok?: Partial<WhatItLooksLikeItem>;
    working?: Partial<WhatItLooksLikeItem>;
  };
  thingsToThinkAbout?: string[];
  actions?: ActionItem[];
  actionsIntro?: string;
  actionSections?: ActionSection[];
  /** Legacy keys from older admin clients */
  plays?: ActionItem[];
  playsIntro?: string;
  playsSections?: ActionSection[] | Array<{ title?: string; description?: string; plays?: ActionItem[]; actions?: ActionItem[] }>;
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
    plays: ActionItem[] | null;
    plays_intro: string | null;
    plays_sections: ActionSection[] | null;
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
  const actions = body.actions ?? body.plays ?? existingRow?.plays ?? [];
  const actionsIntro =
    body.actionsIntro !== undefined
      ? body.actionsIntro
      : body.playsIntro !== undefined
        ? body.playsIntro
        : (existingRow?.plays_intro ?? "");
  const actionSectionsRaw = body.actionSections ?? body.playsSections ?? existingRow?.plays_sections ?? [];
  const actionSectionsForDb = Array.isArray(actionSectionsRaw)
    ? actionSectionsRaw.map((s) => ({
        title: s.title ?? "",
        description: s.description ?? "",
        actions: (s as ActionSection).actions ?? (s as { plays?: ActionItem[] }).plays ?? [],
      }))
    : [];
  const quickWins = body.quickWins ?? existingRow?.quick_wins ?? [];
  const relatedPlaybooks = normalizeRelatedPlaybooks(
    body.relatedPlaybooks ?? existingRow?.related_playbooks ?? []
  );

  const row = {
    ref,
    what_this_is: whatThisIs,
    what_it_looks_like: whatItLooksLike,
    things_to_think_about: thingsToThinkAbout,
    plays: actions,
    plays_intro: actionsIntro || null,
    plays_sections: actionSectionsForDb.length ? serializeActionSectionsForDb(actionSectionsForDb) : [],
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

  const content = (await loadPlaybookContentWithDb(ref)) as PlaybookContent | null;
  return NextResponse.json(content);
}
