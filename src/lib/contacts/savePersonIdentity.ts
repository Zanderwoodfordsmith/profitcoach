export type PersonIdentitySaveInput = {
  firstName: string;
  lastName: string;
  businessName: string;
  photoFile: File | null;
  removePhoto: boolean;
};

export type PersonIdentitySaveResult = {
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  photo_url: string | null;
};

function authWithoutContentType(
  headers: Record<string, string>
): Record<string, string> {
  const next = { ...headers };
  delete next["Content-Type"];
  delete next["content-type"];
  return next;
}

/**
 * Save a person's name, business, and optional photo from the profile editor.
 */
export async function savePersonIdentity(options: {
  contactId: string;
  headers: Record<string, string>;
  admin?: boolean;
  input: PersonIdentitySaveInput;
}): Promise<PersonIdentitySaveResult> {
  const base = options.admin
    ? `/api/admin/contacts/${encodeURIComponent(options.contactId)}`
    : `/api/coach/contacts/${encodeURIComponent(options.contactId)}`;
  const uploadHeaders = authWithoutContentType(options.headers);

  let uploadedPhoto: string | null | undefined;
  if (options.input.photoFile) {
    const form = new FormData();
    form.set("file", options.input.photoFile);
    const res = await fetch(`${base}/photo`, {
      method: "POST",
      headers: uploadHeaders,
      body: form,
    });
    const body = (await res.json().catch(() => ({}))) as {
      photo_url?: string;
      error?: string;
    };
    if (!res.ok || !body.photo_url) {
      throw new Error(body.error ?? "Unable to update the photo.");
    }
    uploadedPhoto = body.photo_url;
  } else if (options.input.removePhoto) {
    const res = await fetch(`${base}/photo`, {
      method: "DELETE",
      headers: uploadHeaders,
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? "Unable to remove the photo.");
    }
    uploadedPhoto = null;
  }

  const res = await fetch(base, {
    method: "PATCH",
    headers: options.headers,
    body: JSON.stringify({
      first_name: options.input.firstName,
      last_name: options.input.lastName,
      business_name: options.input.businessName,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as PersonIdentitySaveResult & {
    error?: string;
    photo_url?: string | null;
  };
  if (!res.ok) {
    throw new Error(body.error ?? "Unable to save this person.");
  }

  return {
    full_name: body.full_name,
    first_name: body.first_name ?? null,
    last_name: body.last_name ?? null,
    business_name: body.business_name ?? null,
    photo_url:
      body.photo_url !== undefined ? body.photo_url : (uploadedPhoto ?? null),
  };
}
