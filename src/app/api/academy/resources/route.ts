import { NextResponse } from "next/server";

import { loadResourcePage, loadResourceSearchText } from "@/lib/resources/loadLibrary";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

/**
 * The Resource Library's content for signed-in members: ?slug= gives one
 * page's full blocks and document text; ?search=1 gives every page's text for
 * the sidebar search. The pages themselves send titles only.
 */
export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  const url = new URL(request.url);
  const headers = { "Cache-Control": "private, no-store" };
  if (url.searchParams.get("search") === "1") {
    return NextResponse.json({ searchText: await loadResourceSearchText() }, { headers });
  }
  const slug = url.searchParams.get("slug") ?? "";
  const loaded = slug ? await loadResourcePage(slug) : null;
  if (!loaded) return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  return NextResponse.json(loaded, { headers });
}
