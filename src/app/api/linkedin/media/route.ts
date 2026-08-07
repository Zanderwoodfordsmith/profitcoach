import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";
import {
  isLinkedInDocumentMime,
  isLinkedInVideoMime,
} from "@/lib/linkedinPublishing";
import { LINKEDIN_MEDIA_BUCKET } from "@/lib/linkedinScheduledPosts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 300;

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MIN_VIDEO_BYTES = 75 * 1024;
const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;

async function signedMediaResponse(
  path: string,
  mime: string,
  size: number,
  filename?: string | null
) {
  const { data: signed } = await supabaseAdmin.storage
    .from(LINKEDIN_MEDIA_BUCKET)
    .createSignedUrl(path, 3600);

  return NextResponse.json({
    ok: true,
    media: {
      path,
      mime,
      size,
      filename: filename || undefined,
      signedUrl: signed?.signedUrl ?? null,
    },
  });
}

function extForMime(mime: string, filename?: string): string {
  if (EXT_BY_MIME[mime]) return EXT_BY_MIME[mime]!;
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  return "bin";
}

/**
 * Direct upload via multipart FormData, or signed upload handshake for large video/docs:
 *   POST JSON { intent: "sign", mime, size, filename? }
 *   POST JSON { intent: "complete", path, mime, size, filename? }
 */
export async function POST(request: Request) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      intent?: string;
      mime?: string;
      size?: number;
      filename?: string;
      path?: string;
    };

    if (body.intent === "sign") {
      const mime = (body.mime || "").toLowerCase();
      const size = typeof body.size === "number" ? body.size : 0;
      const filename = body.filename?.trim() || null;
      const isVideo = isLinkedInVideoMime(mime);
      const isDoc = isLinkedInDocumentMime(mime);
      if (!isVideo && !isDoc) {
        return NextResponse.json(
          { error: "Signed uploads are for video or documents." },
          { status: 400 }
        );
      }
      if (isVideo) {
        if (size < MIN_VIDEO_BYTES) {
          return NextResponse.json({ error: "Video must be at least 75KB." }, { status: 400 });
        }
        if (size > MAX_VIDEO_BYTES) {
          return NextResponse.json({ error: "Video must be 200MB or smaller." }, { status: 400 });
        }
      } else if (size > MAX_DOCUMENT_BYTES) {
        return NextResponse.json({ error: "Document must be 100MB or smaller." }, { status: 400 });
      }
      const ext = extForMime(mime, filename || undefined);
      const path = `${auth.userId}/${randomUUID()}.${ext}`;
      const { data, error } = await supabaseAdmin.storage
        .from(LINKEDIN_MEDIA_BUCKET)
        .createSignedUploadUrl(path);
      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Could not create upload URL." },
          { status: 500 }
        );
      }
      return NextResponse.json({
        ok: true,
        path: data.path,
        token: data.token,
        signedUrl: data.signedUrl,
      });
    }

    if (body.intent === "complete") {
      const path = typeof body.path === "string" ? body.path : "";
      const mime = (body.mime || "").toLowerCase();
      const size = typeof body.size === "number" ? body.size : 0;
      const filename = body.filename?.trim() || null;
      if (!path.startsWith(`${auth.userId}/`)) {
        return NextResponse.json({ error: "Invalid media path." }, { status: 400 });
      }
      if (!isLinkedInVideoMime(mime) && !isLinkedInDocumentMime(mime)) {
        return NextResponse.json({ error: "Unsupported media type." }, { status: 400 });
      }
      return signedMediaResponse(path, mime, size, filename);
    }

    return NextResponse.json({ error: "Unknown media intent." }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file") ?? formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const mime = (file.type || "image/jpeg").toLowerCase();
  const isVideo = isLinkedInVideoMime(mime);
  const isDoc = isLinkedInDocumentMime(mime);

  if (!IMAGE_MIME.has(mime) && !isVideo && !isDoc) {
    return NextResponse.json(
      {
        error:
          "Only JPEG/PNG/GIF/WebP, MP4, or PDF/DOC/DOCX/PPT/PPTX are allowed.",
      },
      { status: 400 }
    );
  }
  if (isVideo) {
    if (file.size < MIN_VIDEO_BYTES) {
      return NextResponse.json({ error: "Video must be at least 75KB." }, { status: 400 });
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Video must be 200MB or smaller." }, { status: 400 });
    }
  } else if (isDoc) {
    if (file.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "Document must be 100MB or smaller." }, { status: 400 });
    }
  } else if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 10MB or smaller." }, { status: 400 });
  }

  const ext = extForMime(mime, file.name);
  const path = `${auth.userId}/${randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(LINKEDIN_MEDIA_BUCKET)
    .upload(path, buffer, {
      contentType: mime,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message || "Upload failed." },
      { status: 500 }
    );
  }

  return signedMediaResponse(path, mime, file.size, file.name || null);
}
