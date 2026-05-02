import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RpcRow = {
  slug: string;
  directory_level: string | null;
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  linkedin_url: string | null;
  total_count: string | number | null;
};

/**
 * Public, unauthenticated directory listing. Uses service role and `directory_coaches_page` RPC.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      48,
      Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "12", 10) || 12)
    );
    const search = (url.searchParams.get("search") ?? "").trim();
    const levelRaw = (url.searchParams.get("level") ?? "").trim();
    const location = (url.searchParams.get("location") ?? "").trim();

    const level =
      levelRaw && levelRaw !== "all" ? levelRaw : null;

    const { data, error } = await supabaseAdmin.rpc("directory_coaches_page", {
      p_search: search.length > 0 ? search : null,
      p_level: level,
      p_location: location.length > 0 ? location : null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    });

    if (error) {
      if (error.message?.includes("function") && error.message?.includes("does not exist")) {
        return NextResponse.json(
          {
            error:
              "Directory is not available until database migrations are applied.",
          },
          { status: 503 }
        );
      }
      console.error("directory/coaches rpc error:", error);
      return NextResponse.json(
        { error: "Could not load directory." },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as RpcRow[];
    const first = rows[0];
    const total =
      first && first.total_count != null
        ? Number(first.total_count)
        : 0;

    const coaches = rows.map((r) => ({
      slug: r.slug,
      directory_level: r.directory_level,
      full_name: r.full_name,
      coach_business_name: r.coach_business_name,
      avatar_url: r.avatar_url,
      bio: r.bio,
      location: r.location,
      linkedin_url: r.linkedin_url,
    }));

    return NextResponse.json({
      coaches,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("directory/coaches GET catch:", err);
    return NextResponse.json(
      { error: "Could not load directory." },
      { status: 500 }
    );
  }
}
