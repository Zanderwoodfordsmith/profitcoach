import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";
import { loadDirectoryCoach } from "@/lib/directoryPage/load";
import { randomUUID } from "node:crypto";
import {
  parseDirectoryPage,
  VIDEO_BUCKET,
  type DirectoryPageExtras,
} from "@/lib/directoryPage/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The coach's own directory page, for editing on /directory/[slug].
 * The coach edits their own page; admins may edit any coach's page.
 */
async function editorFor(request: Request, slug: string) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { error: "Sign in to edit this page.", status: 401 } as const;
  const user = await verifyAccessToken(token);
  if (!user) return { error: "Sign in to edit this page.", status: 401 } as const;

  const loaded = await loadDirectoryCoach(slug);
  if (!loaded) return { error: "Page not found.", status: 404 } as const;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "admin";
  if (loaded.coachId !== user.id && !isAdmin) {
    return { error: "You can only edit your own page.", status: 403 } as const;
  }
  return { loaded, actingAsAdmin: loaded.coachId !== user.id, isAdmin } as const;
}

/** Every current member coach, listed ones first, for the admin page switcher. */
async function coachList() {
  const { data } = await supabaseAdmin
    .from("coaches")
    .select("slug, directory_listed, profiles!inner ( full_name, access_removed_at )")
    .eq("record_kind", "member")
    .is("profiles.access_removed_at", null);
  const rows = (data ?? []) as unknown as Array<{
    slug: string;
    directory_listed: boolean | null;
    profiles: { full_name: string | null } | Array<{ full_name: string | null }>;
  }>;
  return rows
    .map((r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return { slug: r.slug, name: p?.full_name?.trim() || r.slug, listed: Boolean(r.directory_listed) };
    })
    .sort((a, b) => Number(b.listed) - Number(a.listed) || a.name.localeCompare(b.name));
}

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const auth = await editorFor(request, slug);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({
    view: auth.loaded.view,
    editor: {
      coachId: auth.loaded.coachId,
      actingAsAdmin: auth.actingAsAdmin,
      coaches: auth.isAdmin ? await coachList() : undefined,
    },
  });
}

const KEYS = [
  "career",
  "results",
  "serves",
  "industries",
  "booking_url",
  "photo_focus",
  "hidden",
  "video_url",
] as const;

/** Body: { slug, directory_page: { ...keys } }. A key set to null goes back to "never set". */
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    slug?: string;
    directory_page?: Record<string, unknown>;
  } | null;
  if (!body?.slug || !body.directory_page || typeof body.directory_page !== "object") {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }
  const auth = await editorFor(request, body.slug);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: row } = await supabaseAdmin
    .from("profiles")
    .select("directory_page")
    .eq("id", auth.loaded.coachId)
    .maybeSingle();
  const next: Record<string, unknown> = { ...parseDirectoryPage(row?.directory_page) };
  const incoming = parseDirectoryPage(body.directory_page);

  for (const key of KEYS) {
    if (!(key in body.directory_page)) continue;
    if (body.directory_page[key] === null) delete next[key];
    else if (key in incoming) next[key] = incoming[key as keyof DirectoryPageExtras];
    else if (key === "booking_url") {
      return NextResponse.json({ error: "That booking link does not look right." }, { status: 400 });
    }
  }
  // A coach who edits the AI-drafted sectors has checked them.
  if ("industries" in body.directory_page) delete next.industries_suggested;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ directory_page: next })
    .eq("id", auth.loaded.coachId);
  if (error) {
    console.error("directory page save:", error.message);
    return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
  }

  const fresh = await loadDirectoryCoach(body.slug);
  return NextResponse.json({ view: fresh?.view ?? auth.loaded.view });
}

const VIDEO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/**
 * Body: { slug, type }. A one-time upload URL for the intro video, so the
 * browser sends the file straight to storage (too big to pass through here).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { slug?: string; type?: string } | null;
  const ext = VIDEO_EXT[body?.type ?? ""];
  if (!body?.slug || !ext) {
    return NextResponse.json({ error: "Use an MP4, MOV or WebM video." }, { status: 400 });
  }
  const auth = await editorFor(request, body.slug);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const path = `${auth.loaded.coachId}/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("directory video upload url:", error?.message);
    return NextResponse.json({ error: "Could not start the upload. Try again." }, { status: 500 });
  }
  const publicUrl = supabaseAdmin.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ path: data.path, token: data.token, publicUrl });
}
