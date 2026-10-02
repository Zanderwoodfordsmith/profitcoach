import { NextResponse } from "next/server";
import {
  clearContactPhoto,
  uploadContactPhoto,
} from "@/lib/contacts/contactPhoto";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = { params: Promise<{ id: string }> };

function errorStatus(message: string): number {
  if (message === "Contact not found.") return 404;
  if (message === "Unable to load contact.") return 500;
  return 400;
}

async function authorize(request: Request, context: RouteContext) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    return {
      error: NextResponse.json({ error: authCheck.error }, { status: 401 }),
    };
  }
  const { id: contactId } = await context.params;
  if (!contactId?.trim()) {
    return {
      error: NextResponse.json({ error: "Missing contact id." }, { status: 400 }),
    };
  }

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("coach_id")
    .eq("id", contactId)
    .maybeSingle();
  if (error) {
    return {
      error: NextResponse.json(
        { error: "Unable to load contact." },
        { status: 500 }
      ),
    };
  }
  const coachId = (data?.coach_id as string | null) ?? "";
  if (!coachId) {
    return {
      error: NextResponse.json({ error: "Contact not found." }, { status: 404 }),
    };
  }
  return { coachId, contactId: contactId.trim() };
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await authorize(request, context);
  if ("error" in auth && auth.error) return auth.error;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file") ?? formData.get("photo");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided. Use field name 'file'." },
      { status: 400 }
    );
  }

  try {
    const photo_url = await uploadContactPhoto({
      contactId: auth.contactId,
      coachId: auth.coachId,
      bytes: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
    });
    return NextResponse.json({ photo_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update the photo.";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await authorize(request, context);
  if ("error" in auth && auth.error) return auth.error;

  try {
    await clearContactPhoto({
      contactId: auth.contactId,
      coachId: auth.coachId,
    });
    return NextResponse.json({ photo_url: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to remove the photo.";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
