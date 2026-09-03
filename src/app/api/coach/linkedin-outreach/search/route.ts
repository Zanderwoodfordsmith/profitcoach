import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { linkedInSearch } from "@/lib/unipile/client";
import { listOutreachAccounts } from "@/lib/unipile/accounts";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";

function mapSearchItem(raw: Record<string, unknown>) {
  const profileUrl =
    normalizeLinkedInProfileUrl(
      String(
        raw.profile_url ||
          raw.public_profile_url ||
          raw.url ||
          raw.linkedin_url ||
          ""
      )
    ) ||
    (raw.public_identifier
      ? `https://www.linkedin.com/in/${raw.public_identifier}/`
      : null);

  const first =
    (raw.first_name as string) ||
    (raw.firstname as string) ||
    (typeof raw.name === "string" ? raw.name.split(/\s+/)[0] : null) ||
    null;
  const last =
    (raw.last_name as string) ||
    (raw.lastname as string) ||
    (typeof raw.name === "string"
      ? raw.name.split(/\s+/).slice(1).join(" ") || null
      : null);

  return {
    linkedin_url: profileUrl,
    linkedin_provider_id:
      (raw.id as string) ||
      (raw.provider_id as string) ||
      (raw.member_urn as string) ||
      null,
    first_name: first,
    last_name: last,
    company:
      (raw.company as string) ||
      (raw.current_company as string) ||
      ((raw.company_name as string) || null),
    title:
      (raw.title as string) ||
      (raw.headline as string) ||
      (raw.occupation as string) ||
      null,
    public_identifier: (raw.public_identifier as string) || null,
    raw,
  };
}

/**
 * LinkedIn people search via Unipile (URL or classic keywords).
 * Body: { url } | { keywords, cursor? }
 */
export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    url?: string;
    keywords?: string;
    cursor?: string | null;
    limit?: number;
  };

  const accounts = await listOutreachAccounts(auth.coachId);
  const account = accounts.find((a) => a.status === "OK") ?? accounts[0];
  if (!account?.unipile_account_id) {
    return NextResponse.json(
      { error: "Connect LinkedIn first." },
      { status: 400 }
    );
  }

  const url = body.url?.trim();
  const keywords = body.keywords?.trim();
  if (!url && !keywords && !body.cursor) {
    return NextResponse.json(
      { error: "Provide a LinkedIn/Sales Nav search URL or keywords." },
      { status: 400 }
    );
  }

  const payload: Record<string, unknown> = {
    account_id: account.unipile_account_id,
  };
  if (body.cursor) {
    payload.cursor = body.cursor;
  } else if (url) {
    payload.url = url;
  } else {
    payload.api = "classic";
    payload.category = "people";
    payload.keywords = keywords;
  }

  const res = await linkedInSearch(payload as Parameters<typeof linkedInSearch>[0]);
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error || "Search failed." },
      { status: 502 }
    );
  }

  const items = (res.data?.items ?? []).map((item) =>
    mapSearchItem(item as Record<string, unknown>)
  );

  return NextResponse.json({
    ok: true,
    items,
    cursor: res.data?.cursor ?? null,
    count: items.length,
  });
}
