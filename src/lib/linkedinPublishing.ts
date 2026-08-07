export type LinkedInConnection = {
  linkedin_sub: string;
  access_token: string;
};

export type LinkedInPostType =
  | "text"
  | "image"
  | "multi_image"
  | "article"
  | "video"
  | "document";

export type LinkedInMediaItem = {
  path: string;
  mime: string;
  size: number;
  altText?: string;
  /** Original filename — used as document title on LinkedIn. */
  filename?: string;
};

export type PublishLinkedInPostInput = {
  connection: LinkedInConnection;
  commentary: string;
  postType: LinkedInPostType;
  /** Image bytes already uploaded to LinkedIn (urn:li:image:…) */
  imageUrns?: string[];
  /** Video already uploaded to LinkedIn (urn:li:video:…) */
  videoUrn?: string | null;
  /** Document already uploaded to LinkedIn (urn:li:document:…) */
  documentUrn?: string | null;
  documentTitle?: string | null;
  articleUrl?: string | null;
  articleTitle?: string | null;
  articleDescription?: string | null;
  /** Optional LinkedIn image URN for the link card thumbnail. */
  articleThumbnailUrn?: string | null;
};

const DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export function isLinkedInVideoMime(mime: string | null | undefined): boolean {
  return (mime || "").toLowerCase() === "video/mp4";
}

export function isLinkedInDocumentMime(mime: string | null | undefined): boolean {
  return DOCUMENT_MIMES.has((mime || "").toLowerCase());
}

/** LinkedIn Marketing API version header: YYYYMM (e.g. 202607). */
export function linkedInApiVersion(): string {
  const fromEnv = process.env.LINKEDIN_API_VERSION?.trim();
  if (fromEnv) return fromEnv;
  return "202607";
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchLinkedInWithRetry(
  input: string,
  init: RequestInit,
  retries = 2
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(800 * (attempt + 1));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LinkedIn fetch failed");
}

function linkedInHeaders(accessToken: string, contentType?: string): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": linkedInApiVersion(),
  };
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

export async function resolveLinkedInMemberId(
  accessToken: string
): Promise<string | null> {
  try {
    const meRes = await fetchLinkedInWithRetry(
      "https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName)",
      {
        headers: linkedInHeaders(accessToken),
        cache: "no-store",
      }
    );
    if (!meRes.ok) return null;
    const me = (await meRes.json().catch(() => ({}))) as { id?: string };
    return me.id ?? null;
  } catch {
    return null;
  }
}

export async function resolveLinkedInAuthorUrn(
  connection: LinkedInConnection
): Promise<string> {
  const memberId =
    (await resolveLinkedInMemberId(connection.access_token)) ??
    connection.linkedin_sub;
  return `urn:li:person:${memberId}`;
}

/**
 * Upload an image to LinkedIn Images API and return the image URN.
 * Flow: initializeUpload → PUT bytes → optional brief wait for AVAILABLE.
 */
export async function uploadLinkedInImage(
  connection: LinkedInConnection,
  ownerUrn: string,
  bytes: ArrayBuffer | Uint8Array,
  contentType = "image/jpeg"
): Promise<{ ok: true; imageUrn: string } | { ok: false; error: string }> {
  try {
    const initRes = await fetchLinkedInWithRetry(
      "https://api.linkedin.com/rest/images?action=initializeUpload",
      {
        method: "POST",
        headers: linkedInHeaders(connection.access_token, "application/json"),
        body: JSON.stringify({
          initializeUploadRequest: { owner: ownerUrn },
        }),
        cache: "no-store",
      }
    );
    const initRaw = await initRes.text().catch(() => "");
    if (!initRes.ok) {
      return {
        ok: false,
        error: `LinkedIn image init failed (${initRes.status}): ${initRaw || "Unknown"}`,
      };
    }
    let initJson: {
      value?: { uploadUrl?: string; image?: string };
    } = {};
    try {
      initJson = JSON.parse(initRaw) as typeof initJson;
    } catch {
      return { ok: false, error: "LinkedIn image init returned invalid JSON." };
    }
    const uploadUrl = initJson.value?.uploadUrl;
    const imageUrn = initJson.value?.image;
    if (!uploadUrl || !imageUrn) {
      return { ok: false, error: "LinkedIn image init missing uploadUrl/image." };
    }

    const body =
      bytes instanceof Uint8Array
        ? bytes
        : new Uint8Array(bytes);

    const putRes = await fetchLinkedInWithRetry(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        "Content-Type": contentType,
      },
      body: Buffer.from(body),
      cache: "no-store",
    });
    if (!putRes.ok) {
      const putRaw = await putRes.text().catch(() => "");
      return {
        ok: false,
        error: `LinkedIn image upload failed (${putRes.status}): ${putRaw || "Unknown"}`,
      };
    }

    // Brief settle; w_member_social often cannot GET image status.
    await sleep(800);
    return { ok: true, imageUrn };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, error: `LinkedIn image upload exception: ${message}` };
  }
}

type VideoUploadInstruction = {
  uploadUrl?: string;
  firstByte?: number;
  lastByte?: number;
};

function stripEtagQuotes(etag: string): string {
  const trimmed = etag.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Upload a video via LinkedIn Videos API (multipart) and wait until AVAILABLE.
 * Spec: MP4, ~75KB–500MB, 3s–30min. Chunk size comes from initializeUpload.
 */
export async function uploadLinkedInVideo(
  connection: LinkedInConnection,
  ownerUrn: string,
  bytes: ArrayBuffer | Uint8Array
): Promise<{ ok: true; videoUrn: string } | { ok: false; error: string }> {
  try {
    const buffer =
      bytes instanceof Uint8Array ? Buffer.from(bytes) : Buffer.from(bytes);
    const fileSizeBytes = buffer.byteLength;
    if (fileSizeBytes < 75 * 1024) {
      return { ok: false, error: "Video must be at least 75KB." };
    }
    if (fileSizeBytes > 500 * 1024 * 1024) {
      return { ok: false, error: "Video must be 500MB or smaller." };
    }

    const initRes = await fetchLinkedInWithRetry(
      "https://api.linkedin.com/rest/videos?action=initializeUpload",
      {
        method: "POST",
        headers: linkedInHeaders(connection.access_token, "application/json"),
        body: JSON.stringify({
          initializeUploadRequest: {
            owner: ownerUrn,
            fileSizeBytes,
            uploadCaptions: false,
            uploadThumbnail: false,
          },
        }),
        cache: "no-store",
      }
    );
    const initRaw = await initRes.text().catch(() => "");
    if (!initRes.ok) {
      return {
        ok: false,
        error: `LinkedIn video init failed (${initRes.status}): ${initRaw || "Unknown"}`,
      };
    }

    let initJson: {
      value?: {
        video?: string;
        uploadToken?: string;
        uploadInstructions?: VideoUploadInstruction[];
      };
    } = {};
    try {
      initJson = JSON.parse(initRaw) as typeof initJson;
    } catch {
      return { ok: false, error: "LinkedIn video init returned invalid JSON." };
    }

    const videoUrn = initJson.value?.video;
    const uploadToken = initJson.value?.uploadToken ?? "";
    const instructions = initJson.value?.uploadInstructions ?? [];
    if (!videoUrn || instructions.length === 0) {
      return {
        ok: false,
        error: "LinkedIn video init missing video URN or upload instructions.",
      };
    }

    const uploadedPartIds: string[] = [];
    for (const part of instructions) {
      const uploadUrl = part.uploadUrl;
      const firstByte = part.firstByte;
      const lastByte = part.lastByte;
      if (
        !uploadUrl ||
        typeof firstByte !== "number" ||
        typeof lastByte !== "number"
      ) {
        return { ok: false, error: "LinkedIn video upload instruction incomplete." };
      }
      const chunk = buffer.subarray(firstByte, lastByte + 1);
      const putRes = await fetchLinkedInWithRetry(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: chunk,
        cache: "no-store",
      });
      if (!putRes.ok) {
        const putRaw = await putRes.text().catch(() => "");
        return {
          ok: false,
          error: `LinkedIn video part upload failed (${putRes.status}): ${putRaw || "Unknown"}`,
        };
      }
      const etag = putRes.headers.get("etag") ?? putRes.headers.get("ETag");
      if (!etag) {
        return {
          ok: false,
          error: "LinkedIn video part upload missing ETag header.",
        };
      }
      uploadedPartIds.push(stripEtagQuotes(etag));
    }

    const finalizeRes = await fetchLinkedInWithRetry(
      "https://api.linkedin.com/rest/videos?action=finalizeUpload",
      {
        method: "POST",
        headers: linkedInHeaders(connection.access_token, "application/json"),
        body: JSON.stringify({
          finalizeUploadRequest: {
            video: videoUrn,
            uploadToken,
            uploadedPartIds,
          },
        }),
        cache: "no-store",
      }
    );
    if (!finalizeRes.ok) {
      const finalizeRaw = await finalizeRes.text().catch(() => "");
      return {
        ok: false,
        error: `LinkedIn video finalize failed (${finalizeRes.status}): ${finalizeRaw || "Unknown"}`,
      };
    }

    const ready = await waitForLinkedInVideoAvailable(
      connection.access_token,
      videoUrn
    );
    if (!ready.ok) return ready;
    return { ok: true, videoUrn };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, error: `LinkedIn video upload exception: ${message}` };
  }
}

async function waitForLinkedInVideoAvailable(
  accessToken: string,
  videoUrn: string,
  maxWaitMs = 120_000
): Promise<{ ok: true } | { ok: false; error: string }> {
  const encoded = encodeURIComponent(videoUrn);
  const started = Date.now();
  let delay = 1500;
  while (Date.now() - started < maxWaitMs) {
    await sleep(delay);
    delay = Math.min(delay + 1000, 5000);
    try {
      const res = await fetchLinkedInWithRetry(
        `https://api.linkedin.com/rest/videos/${encoded}`,
        {
          headers: linkedInHeaders(accessToken),
          cache: "no-store",
        }
      );
      if (!res.ok) {
        // Member tokens sometimes cannot GET status; brief settle then proceed.
        if (res.status === 403 || res.status === 404) {
          await sleep(2000);
          return { ok: true };
        }
        continue;
      }
      const json = (await res.json().catch(() => ({}))) as {
        status?: string;
        processingFailureReason?: string;
      };
      if (json.status === "AVAILABLE") return { ok: true };
      if (json.status === "PROCESSING_FAILED") {
        return {
          ok: false,
          error: `LinkedIn video processing failed: ${json.processingFailureReason || "Unknown"}`,
        };
      }
    } catch {
      // keep polling
    }
  }
  // Timed out still PROCESSING — try posting anyway (often works).
  return { ok: true };
}

/**
 * Upload a document (PDF/PPT/DOC) via LinkedIn Documents API.
 */
export async function uploadLinkedInDocument(
  connection: LinkedInConnection,
  ownerUrn: string,
  bytes: ArrayBuffer | Uint8Array,
  contentType: string
): Promise<{ ok: true; documentUrn: string } | { ok: false; error: string }> {
  try {
    const body =
      bytes instanceof Uint8Array ? Buffer.from(bytes) : Buffer.from(bytes);
    if (body.byteLength > 100 * 1024 * 1024) {
      return { ok: false, error: "Document must be 100MB or smaller." };
    }

    const initRes = await fetchLinkedInWithRetry(
      "https://api.linkedin.com/rest/documents?action=initializeUpload",
      {
        method: "POST",
        headers: linkedInHeaders(connection.access_token, "application/json"),
        body: JSON.stringify({
          initializeUploadRequest: { owner: ownerUrn },
        }),
        cache: "no-store",
      }
    );
    const initRaw = await initRes.text().catch(() => "");
    if (!initRes.ok) {
      return {
        ok: false,
        error: `LinkedIn document init failed (${initRes.status}): ${initRaw || "Unknown"}`,
      };
    }
    let initJson: {
      value?: { uploadUrl?: string; document?: string };
    } = {};
    try {
      initJson = JSON.parse(initRaw) as typeof initJson;
    } catch {
      return { ok: false, error: "LinkedIn document init returned invalid JSON." };
    }
    const uploadUrl = initJson.value?.uploadUrl;
    const documentUrn = initJson.value?.document;
    if (!uploadUrl || !documentUrn) {
      return { ok: false, error: "LinkedIn document init missing uploadUrl/document." };
    }

    const putRes = await fetchLinkedInWithRetry(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        "Content-Type": contentType || "application/pdf",
      },
      body,
      cache: "no-store",
    });
    if (!putRes.ok && putRes.status !== 201) {
      const putRaw = await putRes.text().catch(() => "");
      return {
        ok: false,
        error: `LinkedIn document upload failed (${putRes.status}): ${putRaw || "Unknown"}`,
      };
    }

    const ready = await waitForLinkedInDocumentAvailable(
      connection.access_token,
      documentUrn
    );
    if (!ready.ok) return ready;
    return { ok: true, documentUrn };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, error: `LinkedIn document upload exception: ${message}` };
  }
}

async function waitForLinkedInDocumentAvailable(
  accessToken: string,
  documentUrn: string,
  maxWaitMs = 90_000
): Promise<{ ok: true } | { ok: false; error: string }> {
  const encoded = encodeURIComponent(documentUrn);
  const started = Date.now();
  let delay = 1200;
  while (Date.now() - started < maxWaitMs) {
    await sleep(delay);
    delay = Math.min(delay + 800, 4000);
    try {
      const res = await fetchLinkedInWithRetry(
        `https://api.linkedin.com/rest/documents/${encoded}`,
        {
          headers: linkedInHeaders(accessToken),
          cache: "no-store",
        }
      );
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          await sleep(1500);
          return { ok: true };
        }
        continue;
      }
      const json = (await res.json().catch(() => ({}))) as {
        status?: string;
      };
      if (json.status === "AVAILABLE") return { ok: true };
      if (json.status === "PROCESSING_FAILED") {
        return { ok: false, error: "LinkedIn document processing failed." };
      }
    } catch {
      // keep polling
    }
  }
  return { ok: true };
}

function formatPublishError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown fetch error";
  const cause =
    error &&
    typeof error === "object" &&
    "cause" in error &&
    (error as { cause?: unknown }).cause
      ? String((error as { cause?: unknown }).cause)
      : "";
  return `LinkedIn publish exception: ${message}${cause ? ` | cause: ${cause}` : ""}`;
}

export async function publishLinkedInPost(
  input: PublishLinkedInPostInput
): Promise<{ ok: true; postUrn: string | null } | { ok: false; error: string }> {
  const commentary = input.commentary.trim();
  const author = await resolveLinkedInAuthorUrn(input.connection);
  const imageUrns = (input.imageUrns ?? []).filter(Boolean);
  const videoUrn = input.videoUrn?.trim() || null;
  const documentUrn = input.documentUrn?.trim() || null;
  const documentTitle = input.documentTitle?.trim() || "Document";
  const articleUrl = input.articleUrl?.trim() || null;
  const articleTitle =
    input.articleTitle?.trim() ||
    (articleUrl ? (() => {
      try {
        return new URL(articleUrl).hostname.replace(/^www\./, "");
      } catch {
        return articleUrl;
      }
    })() : null);
  const articleDescription = input.articleDescription?.trim() || null;
  const articleThumbnailUrn = input.articleThumbnailUrn?.trim() || null;

  if (input.postType === "image" && imageUrns.length < 1) {
    return { ok: false, error: "Image post requires at least one image." };
  }
  if (input.postType === "multi_image" && imageUrns.length < 2) {
    return { ok: false, error: "Multi-image post requires at least 2 images." };
  }
  if (input.postType === "video" && !videoUrn) {
    return { ok: false, error: "Video post requires a video." };
  }
  if (input.postType === "document" && !documentUrn) {
    return { ok: false, error: "Document post requires a file." };
  }
  if (input.postType === "article" && !articleUrl) {
    return { ok: false, error: "Article post requires a URL." };
  }
  if (input.postType === "article" && !articleTitle) {
    return { ok: false, error: "Article post requires a title." };
  }
  if (!commentary && input.postType === "text") {
    return { ok: false, error: "Post content is required." };
  }

  const payload: Record<string, unknown> = {
    author,
    commentary: commentary || " ",
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (input.postType === "image" && imageUrns[0]) {
    payload.content = {
      media: {
        id: imageUrns[0],
      },
    };
  } else if (input.postType === "multi_image") {
    payload.content = {
      multiImage: {
        images: imageUrns.map((id) => ({ id })),
      },
    };
  } else if (input.postType === "video" && videoUrn) {
    payload.content = {
      media: {
        id: videoUrn,
      },
    };
  } else if (input.postType === "document" && documentUrn) {
    payload.content = {
      media: {
        id: documentUrn,
        title: documentTitle.slice(0, 400),
      },
    };
  } else if (input.postType === "article" && articleUrl && articleTitle) {
    const article: Record<string, string> = {
      source: articleUrl,
      title: articleTitle.slice(0, 400),
    };
    if (articleDescription) {
      article.description = articleDescription.slice(0, 400);
    }
    if (articleThumbnailUrn) {
      article.thumbnail = articleThumbnailUrn;
    }
    payload.content = { article };
  }

  try {
    const res = await fetchLinkedInWithRetry("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: linkedInHeaders(input.connection.access_token, "application/json"),
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const location = res.headers.get("x-restli-id") ?? res.headers.get("location");
    if (res.ok) {
      return { ok: true, postUrn: location };
    }

    const body = await res.text().catch(() => "");
    return {
      ok: false,
      error: `LinkedIn publish failed (${res.status}): ${body || "Unknown error"} (author=${author})`,
    };
  } catch (error) {
    return { ok: false, error: formatPublishError(error) };
  }
}

/** Backward-compatible text-only helper. */
export async function publishLinkedInTextPost(
  connection: LinkedInConnection,
  content: string
): Promise<{ ok: true; postUrn: string | null } | { ok: false; error: string }> {
  return publishLinkedInPost({
    connection,
    commentary: content,
    postType: "text",
  });
}
