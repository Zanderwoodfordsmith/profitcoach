import { NextResponse } from "next/server";
import { DEFAULT_SUPPORT_ASSIGNEE_ID } from "@/lib/support/assignees";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PublicSupportBody = {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  website?: string;
};

export async function POST(request: Request) {
  let body: PublicSupportBody;
  try {
    body = (await request.json()) as PublicSupportBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.website?.trim()) {
    return NextResponse.json({ ok: true, ticket_number: null });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const subject = body.subject?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!email || !subject || !message) {
    return NextResponse.json(
      { error: "Email, subject, and message are required." },
      { status: 400 }
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (subject.length > 200 || message.length > 8000 || name.length > 120) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("community_feedback_reports")
    .insert({
      created_by: null,
      type: "question",
      title: subject,
      details: message,
      contact_email: email,
      submitter_name: name || null,
      page_path: "/support",
      source: "public_form",
      assigned_to: DEFAULT_SUPPORT_ASSIGNEE_ID,
      status: "new",
      user_agent: request.headers.get("user-agent"),
    })
    .select("ticket_number")
    .single();

  if (error) {
    console.error("support/public insert:", error.message);
    return NextResponse.json(
      { error: "Could not submit your message. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    ticket_number: data?.ticket_number ?? null,
  });
}
