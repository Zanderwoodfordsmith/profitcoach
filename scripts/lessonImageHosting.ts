/**
 * Extract base64 images embedded in academy lesson markdown, upload them to the
 * public `academy-lesson-images` Supabase storage bucket (deduped by content
 * hash), and rewrite the markdown to reference the hosted public URLs.
 *
 * Google Docs / Disco exports use reference-style images: usages like
 * `![alt][image1]` are scattered through the document while the actual
 * `[image1]: <data:image/png;base64,...>` definitions are collected at the very
 * bottom of the file. Because we split docs into lessons by H1 heading, a
 * lesson body usually contains the usage but NOT the definition. So callers
 * should build a per-file definition map with `collectImageRefDefs()` over the
 * whole file and pass it in via `refDefs`.
 *
 * Inline images (`![alt](data:image/png;base64,...)`) are also handled. Tiny
 * images (decorative icons) and svg icons are dropped rather than hosted.
 */

import crypto from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

export const LESSON_IMAGE_BUCKET = "academy-lesson-images";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/** Decoded byte size below which we treat an image as a decorative icon and drop it. */
const MIN_CONTENT_BYTES = 3000;

const REF_DEF_RE =
  /^[ \t]*\[([^\]\n]+)\]:\s*<?\s*data:(image\/[a-z+]+);base64,([^\s>\n]+)\s*>?\s*$/gim;
const INLINE_DATA_RE =
  /!\[([^\]]*)\]\(\s*data:(image\/[a-z+]+);base64,([^)\s]+)\s*\)/gi;
const REF_USAGE_RE = /!\[([^\]]*)\]\[([^\]\n]+)\]/g;
/** Decorative svg icons exported by Google Docs/Disco (play buttons etc.). */
const ICON_IMG_RE =
  /!\[[^\]]*\]\(\s*https?:\/\/[^)]*(?:icon|youtube__icon)[^)]*\.svg[^)]*\)/gi;

export type ImageRef = { mime: string; base64: string };

export type HostImagesResult = {
  markdown: string;
  hosted: number;
  reused: number;
  skippedTiny: number;
  droppedOrphan: number;
};

export type HostImagesOptions = {
  supabaseUrl: string;
  /** When false, just compute URLs (no upload) — used for dry-run previews. */
  upload: boolean;
  /** Shared cache so identical images across lessons upload once per run. */
  cache?: Map<string, string | null>;
  /** Whole-file reference-definition map (`image1` -> data URI). */
  refDefs?: Map<string, ImageRef>;
};

export async function ensureLessonImageBucket(supabase: SupabaseClient): Promise<void> {
  const { data } = await supabase.storage.getBucket(LESSON_IMAGE_BUCKET);
  if (data) return;
  await supabase.storage.createBucket(LESSON_IMAGE_BUCKET, {
    public: true,
    fileSizeLimit: 26214400,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"],
  });
}

/** Collect every `[id]: <data:image/...>` reference definition in a full document. */
export function collectImageRefDefs(text: string): Map<string, ImageRef> {
  const map = new Map<string, ImageRef>();
  for (const m of text.matchAll(REF_DEF_RE)) {
    map.set(m[1]!.trim(), { mime: m[2]!, base64: m[3]! });
  }
  return map;
}

function publicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${LESSON_IMAGE_BUCKET}/${path}`;
}

type Counters = { hosted: number; reused: number; skippedTiny: number };

/**
 * Upload one base64 payload (deduped by hash via the cache). Returns the public
 * URL, or null if the image is too small (icon) or the upload failed.
 */
async function uploadBase64(
  supabase: SupabaseClient,
  mime: string,
  base64: string,
  opts: HostImagesOptions,
  counters: Counters
): Promise<string | null> {
  const buf = Buffer.from(base64, "base64");
  if (buf.byteLength < MIN_CONTENT_BYTES) {
    counters.skippedTiny += 1;
    return null;
  }
  const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
  if (opts.cache?.has(hash)) {
    const url = opts.cache.get(hash)!;
    if (url) counters.reused += 1;
    return url;
  }
  const ext = EXT_BY_MIME[mime.toLowerCase()] ?? "png";
  const path = `docs/${hash}.${ext}`;
  if (!opts.upload) {
    counters.hosted += 1;
    const url = publicUrl(opts.supabaseUrl, path);
    opts.cache?.set(hash, url);
    return url;
  }
  const { error } = await supabase.storage
    .from(LESSON_IMAGE_BUCKET)
    .upload(path, buf, { contentType: mime, upsert: true });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(`    image upload failed (${path}): ${error.message}`);
    opts.cache?.set(hash, null);
    return null;
  }
  counters.hosted += 1;
  const url = publicUrl(opts.supabaseUrl, path);
  opts.cache?.set(hash, url);
  return url;
}

/**
 * Host all images referenced by a lesson body and rewrite references to public
 * URLs. Resolves reference-style usages against `opts.refDefs` (whole-file map)
 * as well as any defs present in the body itself.
 */
export async function hostBase64Images(
  markdown: string,
  supabase: SupabaseClient,
  opts: HostImagesOptions
): Promise<HostImagesResult> {
  const counters: Counters = { hosted: 0, reused: 0, skippedTiny: 0 };
  let droppedOrphan = 0;
  let out = markdown;

  // Drop decorative svg icons up front.
  out = out.replace(ICON_IMG_RE, "");

  // Merge whole-file defs with any defs that happen to live in this body.
  const refs = new Map<string, ImageRef>(opts.refDefs ?? []);
  for (const m of out.matchAll(REF_DEF_RE)) {
    refs.set(m[1]!.trim(), { mime: m[2]!, base64: m[3]! });
  }
  out = out.replace(REF_DEF_RE, "");

  // Upload every referenced image, building an id -> url map.
  const idUrl = new Map<string, string | null>();
  for (const m of out.matchAll(REF_USAGE_RE)) {
    const id = m[2]!.trim();
    if (idUrl.has(id)) continue;
    const ref = refs.get(id);
    if (!ref) {
      idUrl.set(id, null);
      droppedOrphan += 1;
      continue;
    }
    idUrl.set(id, await uploadBase64(supabase, ref.mime, ref.base64, opts, counters));
  }
  out = out.replace(REF_USAGE_RE, (_full, alt: string, id: string) => {
    const url = idUrl.get(id.trim());
    return url ? `![${alt}](${url})` : "";
  });

  // Inline base64 images.
  const inlineMatches = [...out.matchAll(INLINE_DATA_RE)];
  for (const m of inlineMatches) {
    const url = await uploadBase64(supabase, m[2]!, m[3]!, opts, counters);
    out = out.replace(m[0], url ? `![${m[1]}](${url})` : "");
  }

  // Strip leftover bold wrappers around now-removed images (`****`).
  out = out.replace(/\*\*\s*\*\*/g, "");
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return {
    markdown: out,
    hosted: counters.hosted,
    reused: counters.reused,
    skippedTiny: counters.skippedTiny,
    droppedOrphan,
  };
}

/** Count images a lesson body will render, using the whole-file def map. */
export function countEmbeddedImages(
  body: string,
  refDefs?: Map<string, ImageRef>
): number {
  let n = 0;
  for (const m of body.matchAll(REF_USAGE_RE)) {
    const id = m[2]!.trim();
    if (!refDefs || refDefs.has(id)) n += 1;
  }
  n += [...body.matchAll(INLINE_DATA_RE)].length;
  return n;
}
