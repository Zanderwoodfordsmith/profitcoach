import { tryUpdateContactStripping } from "@/lib/contactSchemaSafeInsert";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "avatars";
const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function photoPaths(contactId: string): string[] {
  return ["jpg", "png", "webp"].map(
    (ext) => `contacts/${contactId}/photo.${ext}`
  );
}

async function loadOwnedPerson(contactId: string, coachId: string) {
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("id, coach_id, type")
    .eq("id", contactId)
    .maybeSingle();
  if (error) {
    throw new Error("Unable to load contact.");
  }
  const type = (data?.type as string | undefined) ?? "";
  if (
    !data ||
    data.coach_id !== coachId ||
    (type !== "prospect" && type !== "client")
  ) {
    throw new Error("Contact not found.");
  }
  return data;
}

async function syncConversationAvatar(
  coachId: string,
  contactId: string,
  photoUrl: string | null
) {
  const { error } = await supabaseAdmin
    .from("messaging_conversations")
    .update({ prospect_avatar_url: photoUrl })
    .eq("coach_id", coachId)
    .eq("contact_id", contactId);
  if (error) {
    console.error("messaging conversation photo sync:", error);
  }
}

export async function uploadContactPhoto(input: {
  contactId: string;
  coachId: string;
  bytes: Buffer;
  contentType: string;
}): Promise<string> {
  await loadOwnedPerson(input.contactId, input.coachId);

  if (!ALLOWED_TYPES.includes(input.contentType)) {
    throw new Error("File must be JPEG, PNG, or WebP.");
  }
  if (input.bytes.byteLength > MAX_SIZE_BYTES) {
    throw new Error("File must be 2MB or smaller.");
  }

  const ext = EXT_BY_TYPE[input.contentType] ?? "jpg";
  const path = `contacts/${input.contactId}/photo.${ext}`;
  const others = photoPaths(input.contactId).filter((item) => item !== path);
  if (others.length) {
    await supabaseAdmin.storage.from(BUCKET).remove(others);
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, input.bytes, {
      contentType: input.contentType,
      upsert: true,
    });
  if (uploadError) {
    throw new Error(uploadError.message || "Upload failed.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const photoUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}?v=${Date.now()}`;
  const { error } = await tryUpdateContactStripping(input.contactId, {
    photo_url: photoUrl,
  });
  if (error) {
    throw new Error(error.message);
  }
  await syncConversationAvatar(input.coachId, input.contactId, photoUrl);
  return photoUrl;
}

export async function clearContactPhoto(input: {
  contactId: string;
  coachId: string;
}): Promise<void> {
  await loadOwnedPerson(input.contactId, input.coachId);
  await supabaseAdmin.storage.from(BUCKET).remove(photoPaths(input.contactId));
  const { error } = await tryUpdateContactStripping(input.contactId, {
    photo_url: null,
  });
  if (error) {
    throw new Error(error.message);
  }
  await syncConversationAvatar(input.coachId, input.contactId, null);
}
