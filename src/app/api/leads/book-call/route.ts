import { NextResponse } from "next/server";
import { resolveOrCreateContact } from "@/lib/contacts/resolveOrCreateContact";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  /** The coach's public booking slug, e.g. `paul-swift`. */
  slug?: unknown;
  phone?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
};

const text = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Saves someone as the coach's lead as soon as they type their details into the booking panel,
 * so a half-finished booking isn't lost. Matches on email or phone, so repeat sends update
 * the same contact. Never blocks the booking: errors come back as a quiet 200.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = text(body.slug, 80).toLowerCase();
  const email = text(body.email, 200).toLowerCase();
  const phone = text(body.phone, 40);
  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneOk = /^\+\d{8,15}$/.test(phone);

  if (!slug || !firstName || (!emailOk && !phoneOk)) {
    return NextResponse.json({ error: "Missing slug, name, or a way to reach them." }, { status: 400 });
  }

  const { data: coach } = await supabaseAdmin.from("coaches").select("id").eq("slug", slug).maybeSingle();
  if (!coach?.id) return NextResponse.json({ error: "Unknown booking page." }, { status: 404 });

  try {
    await resolveOrCreateContact({
      coachId: coach.id as string,
      email: emailOk ? email : null,
      phone: phoneOk ? phone : null,
      firstName,
      lastName: lastName || null,
      fullName: [firstName, lastName].filter(Boolean).join(" "),
      type: "prospect",
      prospectSource: "booking_page",
    });
  } catch (err) {
    console.error("[leads/book-call] save failed", err);
    return NextResponse.json({ ok: false });
  }
  return NextResponse.json({ ok: true });
}
