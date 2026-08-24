"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  CalendarClock,
  FileText,
  ImagePlus,
  Link2,
  Loader2,
  MoreHorizontal,
  Send,
  Upload,
  Video,
  X,
} from "lucide-react";
import type { LinkedInMediaItem } from "@/lib/linkedinPublishing";
import {
  renderQuoteCardDataUrl,
  renderQuoteCardPng,
} from "@/lib/linkedinQuoteCard";
import {
  localDatetimeInputToIso,
  toLocalDatetimeInputValue,
} from "@/lib/linkedinScheduleTime";
import {
  displayName,
  inferComposerPostType,
  isDocumentMedia,
  isVideoMedia,
  LI_BLUE,
  type LinkedInPostItem,
  type LinkedInProfilePreview,
} from "./types";

type MediaPreview = LinkedInMediaItem & { signedUrl?: string | null };

type Props = {
  connected: boolean;
  profile: LinkedInProfilePreview;
  categories: string[];
  getToken: () => Promise<string>;
  onMessage: (message: string, tone: "success" | "error" | "neutral") => void;
  onRefresh: () => Promise<void>;
  seed?: LinkedInPostItem | null;
  onSeedConsumed?: () => void;
};

type MediaPanel = "image" | "video" | "document" | "link" | null;
type ImagePanelTab = "upload" | "templates";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp";
const VIDEO_ACCEPT = "video/mp4";
const DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MIN_VIDEO_BYTES = 75 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;

const DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function guessDocumentMime(file: File): string {
  if (file.type && DOCUMENT_MIMES.has(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (name.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (name.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  return file.type || "application/pdf";
}

export function LinkedInComposeTab({
  connected,
  profile,
  categories,
  getToken,
  onMessage,
  onRefresh,
  seed,
  onSeedConsumed,
}: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleDescription, setArticleDescription] = useState("");
  const [articleThumbnailUrl, setArticleThumbnailUrl] = useState<string | null>(
    null
  );
  const [linkDomain, setLinkDomain] = useState<string | null>(null);
  const [linkPreviewBusy, setLinkPreviewBusy] = useState(false);
  const [panel, setPanel] = useState<MediaPanel>(null);
  const [imageTab, setImageTab] = useState<ImagePanelTab>("upload");
  const [quoteText, setQuoteText] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [category, setCategory] = useState("");
  const [media, setMedia] = useState<MediaPreview[]>([]);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCopyOfPublished, setEditingCopyOfPublished] = useState(false);
  const [busy, setBusy] = useState<
    "post" | "schedule" | "draft" | "upload" | "quote" | null
  >(null);

  useEffect(() => {
    if (!seed) return;
    setContent(seed.content);
    setArticleUrl(seed.article_url ?? "");
    setArticleTitle(seed.article_title ?? "");
    setArticleDescription(seed.article_description ?? "");
    setArticleThumbnailUrl(seed.article_thumbnail_url ?? null);
    setPanel(seed.article_url ? "link" : null);
    setCategory(seed.category ?? "");
    setMedia(seed.media ?? []);
    setScheduleMode(false);
    // Published LinkedIn posts can't be rewritten in-place — edit as a new draft/copy.
    if (seed.status === "published") {
      setEditingId(null);
      setEditingCopyOfPublished(true);
    } else {
      setEditingId(seed.id);
      setEditingCopyOfPublished(false);
      if (seed.status === "scheduled" && seed.scheduled_for) {
        setScheduleMode(true);
        setScheduledAtLocal(toLocalDatetimeInputValue(seed.scheduled_for));
      }
    }
    onSeedConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.id]);

  const name = displayName(profile);
  const headline = profile.headline?.trim() || null;
  const websiteLabel = profile.websiteLabel || "Visit my website";
  const postType = inferComposerPostType(media, articleUrl);
  const hasVideo = isVideoMedia(media);
  const hasDocument = isDocumentMedia(media);
  const hasImages = media.length > 0 && !hasVideo && !hasDocument;
  const hasExclusiveMedia = hasVideo || hasDocument;
  const imageSlotsLeft = Math.max(0, 9 - media.length);

  // Live quote template preview while Templates tab is open.
  useEffect(() => {
    if (panel !== "image" || imageTab !== "templates") return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const timer = window.setTimeout(() => {
      setPreviewBusy(true);
      void (async () => {
        try {
          const url = await renderQuoteCardDataUrl({
            name,
            handle: profile.quoteHandle || "Profit Coach",
            quote: quoteText.trim() || "Type your line…",
            photoUrl: profile.photoUrl,
          });
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          objectUrl = url;
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        } catch {
          // ignore preview failures
        } finally {
          if (!cancelled) setPreviewBusy(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [panel, imageTab, quoteText, name, profile.quoteHandle, profile.photoUrl]);

  async function uploadBlobAsMedia(blob: Blob, filename: string) {
    const token = await getToken();
    const fd = new FormData();
    fd.append("file", new File([blob], filename, { type: blob.type || "image/png" }));
    const res = await fetch("/api/linkedin/media", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      media?: MediaPreview;
    };
    if (!res.ok || !body.media) throw new Error(body.error || "Upload failed.");
    return body.media;
  }

  async function uploadVideoSigned(file: File) {
    const token = await getToken();
    const signRes = await fetch("/api/linkedin/media", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "sign",
        mime: "video/mp4",
        size: file.size,
        filename: file.name,
      }),
    });
    const signBody = (await signRes.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      path?: string;
      token?: string;
      signedUrl?: string;
    };
    if (!signRes.ok || !signBody.path || !signBody.signedUrl) {
      throw new Error(signBody.error || "Could not start video upload.");
    }

    const putRes = await fetch(signBody.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "x-upsert": "false",
      },
      body: file,
    });
    if (!putRes.ok) {
      const raw = await putRes.text().catch(() => "");
      throw new Error(raw || "Video upload to storage failed.");
    }

    const completeRes = await fetch("/api/linkedin/media", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "complete",
        path: signBody.path,
        mime: "video/mp4",
        size: file.size,
      }),
    });
    const completeBody = (await completeRes.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      media?: MediaPreview;
    };
    if (!completeRes.ok || !completeBody.media) {
      throw new Error(completeBody.error || "Could not finalize video upload.");
    }
    return completeBody.media;
  }

  async function uploadImages(files: FileList | File[]) {
    if (hasExclusiveMedia) {
      onMessage("Remove the video or document before adding images.", "error");
      return;
    }
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      onMessage("Choose JPEG, PNG, GIF, or WebP images.", "error");
      return;
    }
    if (imageSlotsLeft <= 0) {
      onMessage("You can add up to 9 images.", "error");
      return;
    }
    setBusy("upload");
    try {
      const next: MediaPreview[] = [...media];
      for (const file of images.slice(0, imageSlotsLeft)) {
        next.push(await uploadBlobAsMedia(file, file.name));
      }
      setMedia(next);
      setPanel(null);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Upload failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function uploadVideo(files: FileList | File[]) {
    const list = Array.from(files);
    const video =
      list.find((f) => f.type === "video/mp4") ||
      list.find((f) => f.name.toLowerCase().endsWith(".mp4"));
    if (!video) {
      onMessage("Choose an MP4 video.", "error");
      return;
    }
    if (media.length > 0) {
      onMessage("Remove existing media before adding a video.", "error");
      return;
    }
    if (video.size < MIN_VIDEO_BYTES) {
      onMessage("Video must be at least 75KB.", "error");
      return;
    }
    if (video.size > MAX_VIDEO_BYTES) {
      onMessage("Video must be 200MB or smaller.", "error");
      return;
    }
    setBusy("upload");
    try {
      const fileForUpload =
        video.type === "video/mp4"
          ? video
          : new File([video], video.name.endsWith(".mp4") ? video.name : `${video.name}.mp4`, {
              type: "video/mp4",
            });
      const uploaded =
        fileForUpload.size > 8 * 1024 * 1024
          ? await uploadVideoSigned(fileForUpload)
          : await uploadBlobAsMedia(fileForUpload, fileForUpload.name);
      setMedia([uploaded]);
      setArticleUrl("");
      setArticleTitle("");
      setArticleDescription("");
      setArticleThumbnailUrl(null);
      setPanel(null);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Upload failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function uploadDocument(files: FileList | File[]) {
    const list = Array.from(files);
    const file = list.find((f) => {
      const mime = guessDocumentMime(f);
      return DOCUMENT_MIMES.has(mime);
    });
    if (!file) {
      onMessage("Choose a PDF, DOC, DOCX, PPT, or PPTX file.", "error");
      return;
    }
    if (media.length > 0) {
      onMessage("Remove existing media before adding a document.", "error");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      onMessage("Document must be 100MB or smaller.", "error");
      return;
    }
    setBusy("upload");
    try {
      const mime = guessDocumentMime(file);
      const fileForUpload =
        file.type === mime
          ? file
          : new File([file], file.name, { type: mime });
      let uploaded: MediaPreview;
      if (fileForUpload.size > 8 * 1024 * 1024) {
        const token = await getToken();
        const signRes = await fetch("/api/linkedin/media", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            intent: "sign",
            mime,
            size: fileForUpload.size,
            filename: fileForUpload.name,
          }),
        });
        const signBody = (await signRes.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          path?: string;
          signedUrl?: string;
        };
        if (!signRes.ok || !signBody.path || !signBody.signedUrl) {
          throw new Error(signBody.error || "Could not start document upload.");
        }
        const putRes = await fetch(signBody.signedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": mime,
            "x-upsert": "false",
          },
          body: fileForUpload,
        });
        if (!putRes.ok) {
          throw new Error("Document upload to storage failed.");
        }
        const completeRes = await fetch("/api/linkedin/media", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            intent: "complete",
            path: signBody.path,
            mime,
            size: fileForUpload.size,
            filename: fileForUpload.name,
          }),
        });
        const completeBody = (await completeRes.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          media?: MediaPreview;
        };
        if (!completeRes.ok || !completeBody.media) {
          throw new Error(completeBody.error || "Could not finalize document.");
        }
        uploaded = completeBody.media;
      } else {
        uploaded = await uploadBlobAsMedia(fileForUpload, fileForUpload.name);
        uploaded = { ...uploaded, filename: fileForUpload.name, mime };
      }
      setMedia([uploaded]);
      setArticleUrl("");
      setArticleTitle("");
      setArticleDescription("");
      setArticleThumbnailUrl(null);
      setPanel(null);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Upload failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function fetchLinkPreview() {
    const url = articleUrl.trim();
    if (!url) {
      onMessage("Paste a URL first.", "error");
      return;
    }
    setLinkPreviewBusy(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/linkedin/link-preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        preview?: {
          url: string;
          title: string;
          description: string;
          image: string | null;
          domain: string;
        };
      };
      if (!res.ok || !body.preview) {
        throw new Error(body.error || "Could not fetch link preview.");
      }
      setArticleUrl(body.preview.url);
      setArticleTitle(body.preview.title);
      setArticleDescription(body.preview.description);
      setArticleThumbnailUrl(body.preview.image);
      setLinkDomain(body.preview.domain);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not fetch preview.", "error");
    } finally {
      setLinkPreviewBusy(false);
    }
  }

  async function handleGenerateQuote() {
    if (!quoteText.trim()) {
      onMessage("Type into the template first.", "error");
      return;
    }
    if (hasExclusiveMedia) {
      onMessage("Remove the video or document before adding a template image.", "error");
      return;
    }
    if (media.length >= 9) {
      onMessage("Remove an image first (max 9).", "error");
      return;
    }
    setBusy("quote");
    try {
      const blob = await renderQuoteCardPng({
        name,
        handle: profile.quoteHandle || "Profit Coach",
        quote: quoteText,
        photoUrl: profile.photoUrl,
      });
      const uploaded = await uploadBlobAsMedia(blob, `quote-${Date.now()}.png`);
      setMedia((prev) => [...prev, uploaded]);
      setQuoteText("");
      setPanel(null);
      onMessage("Template image attached.", "success");
    } catch (err) {
      onMessage(
        err instanceof Error ? err.message : "Could not generate template image.",
        "error"
      );
    } finally {
      setBusy(null);
    }
  }

  function payload() {
    return {
      content: content.trim(),
      post_type: postType,
      category: category.trim() || null,
      article_url: articleUrl.trim() || null,
      article_title: articleTitle.trim() || null,
      article_description: articleDescription.trim() || null,
      article_thumbnail_url: articleThumbnailUrl,
      media: media.map(({ path, mime, size, altText, filename }) => ({
        path,
        mime,
        size,
        altText,
        filename,
      })),
    };
  }

  function resetComposer() {
    setContent("");
    setArticleUrl("");
    setArticleTitle("");
    setArticleDescription("");
    setArticleThumbnailUrl(null);
    setLinkDomain(null);
    setPanel(null);
    setImageTab("upload");
    setQuoteText("");
    setMedia([]);
    setScheduledAtLocal("");
    setScheduleMode(false);
    setEditingId(null);
    setEditingCopyOfPublished(false);
  }

  async function updateExisting(body: Record<string, unknown>) {
    if (!editingId) throw new Error("Nothing to update.");
    const token = await getToken();
    const res = await fetch(`/api/linkedin/scheduled/${editingId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "update", ...body }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) throw new Error(json.error || "Could not save changes.");
  }

  async function deleteEditingRow() {
    if (!editingId) return;
    const token = await getToken();
    await fetch(`/api/linkedin/scheduled/${editingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
  }

  async function handlePostNow() {
    if (!connected || busy) return;
    setBusy("post");
    try {
      const token = await getToken();
      const res = await fetch("/api/linkedin/post-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload()),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "Could not publish.");
      if (editingId) await deleteEditingRow();
      onMessage(
        hasVideo
          ? "Video posted to LinkedIn (processing may take a moment)."
          : "Posted to LinkedIn.",
        "success"
      );
      resetComposer();
      await onRefresh();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not publish.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function handleSchedule() {
    if (!connected || busy) return;
    if (!scheduleMode) {
      setScheduleMode(true);
      setScheduledAtLocal(toLocalDatetimeInputValue(null, 5));
      return;
    }
    if (!scheduledAtLocal) {
      onMessage("Pick a date and time to schedule.", "error");
      return;
    }
    const scheduledIso = localDatetimeInputToIso(scheduledAtLocal);
    if (!scheduledIso) {
      onMessage("Invalid date/time.", "error");
      return;
    }
    if (new Date(scheduledIso).getTime() < Date.now() + 60_000) {
      onMessage("Pick a time at least 1 minute from now.", "error");
      return;
    }
    setBusy("schedule");
    try {
      if (editingId) {
        await updateExisting({
          ...payload(),
          status: "scheduled",
          scheduled_for: scheduledIso,
        });
        onMessage("Schedule updated.", "success");
      } else {
        const token = await getToken();
        const res = await fetch("/api/linkedin/scheduled", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...payload(),
            status: "scheduled",
            scheduled_for: scheduledIso,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !body.ok) throw new Error(body.error || "Could not schedule.");
        onMessage("Post scheduled.", "success");
      }
      resetComposer();
      await onRefresh();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not schedule.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveDraft() {
    if (!connected || busy) return;
    setBusy("draft");
    try {
      if (editingId) {
        await updateExisting({ ...payload(), status: "draft" });
        onMessage("Draft updated.", "success");
      } else {
        const token = await getToken();
        const res = await fetch("/api/linkedin/scheduled", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...payload(), status: "draft" }),
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !body.ok) throw new Error(body.error || "Could not save draft.");
        onMessage("Saved to library.", "success");
      }
      resetComposer();
      await onRefresh();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not save draft.", "error");
    } finally {
      setBusy(null);
    }
  }

  function openImagePanel() {
    if (hasExclusiveMedia) {
      onMessage("Remove the video or document before adding images.", "error");
      return;
    }
    setPanel("image");
    setImageTab("upload");
  }

  function openVideoPanel() {
    if (hasImages || hasDocument) {
      onMessage("Remove images or documents before adding a video.", "error");
      return;
    }
    if (hasVideo) {
      onMessage("Remove the current video first.", "error");
      return;
    }
    setPanel("video");
  }

  function openDocumentPanel() {
    if (hasImages || hasVideo) {
      onMessage("Remove images or video before adding a document.", "error");
      return;
    }
    if (hasDocument) {
      onMessage("Remove the current document first.", "error");
      return;
    }
    setPanel("document");
  }

  function onDropFiles(
    e: DragEvent<HTMLDivElement>,
    kind: "image" | "video" | "document"
  ) {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files?.length) return;
    if (kind === "image") void uploadImages(files);
    else if (kind === "video") void uploadVideo(files);
    else void uploadDocument(files);
  }

  return (
    <div className="mx-auto w-full max-w-[560px]">
        {editingId || editingCopyOfPublished ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-[12px] text-sky-950">
            <p className="font-semibold">
              {editingId
                ? "Editing queue item"
                : "Editing a copy of a published post"}
            </p>
            <button
              type="button"
              onClick={() => resetComposer()}
              className="text-[11px] font-semibold text-sky-800 hover:underline"
            >
              Discard
            </button>
          </div>
        ) : null}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-start gap-3 px-4 pt-4">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200">
              {profile.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: LI_BLUE }}
                >
                  {name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="truncate text-[14px] font-semibold leading-tight text-[#000000e6]">
                {name}
                <span className="font-normal text-slate-500"> · 1st</span>
              </p>
              {headline ? (
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-500">
                  {headline}
                </p>
              ) : null}
              {profile.websiteUrl ? (
                <a
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[#0A66C2] hover:underline"
                >
                  {websiteLabel}
                  <span aria-hidden>↗</span>
                </a>
              ) : (
                <p className="mt-0.5 text-[12px] font-semibold text-[#0A66C2]">
                  {websiteLabel}
                </p>
              )}
              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-slate-500">
                Now · <span className="text-[11px]" aria-hidden>
                  🌐
                </span>
              </p>
            </div>
            <button
              type="button"
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              aria-label="More"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 pt-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What do you want to talk about?"
              rows={5}
              className="w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-[#000000e6] outline-none placeholder:text-slate-400"
            />
          </div>

          {media.length > 0 ? (
            <div
              className={`mt-1 grid gap-0.5 bg-slate-100 ${
                media.length === 1 ? "grid-cols-1" : "grid-cols-2"
              }`}
            >
              {media.map((m) => {
                const video = (m.mime || "").toLowerCase() === "video/mp4";
                const doc = DOCUMENT_MIMES.has((m.mime || "").toLowerCase());
                return (
                  <div
                    key={m.path}
                    className={`group relative bg-slate-200 ${
                      media.length === 1 ? "aspect-[1.2/1]" : "aspect-square"
                    }`}
                  >
                    {video ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video
                        src={m.signedUrl || ""}
                        className="h-full w-full object-cover"
                        controls
                        playsInline
                      />
                    ) : doc ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 bg-white px-4 text-center">
                        <FileText className="h-8 w-8 text-slate-400" />
                        <p className="line-clamp-2 text-sm font-semibold text-slate-800">
                          {m.filename || m.path.split("/").pop()}
                        </p>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.signedUrl || ""}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setMedia((prev) => prev.filter((x) => x.path !== m.path))
                      }
                      className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                      aria-label={
                        video ? "Remove video" : doc ? "Remove document" : "Remove image"
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {panel === "link" ? (
            <div className="mx-4 mb-3 mt-2 rounded-xl border border-slate-200 bg-slate-50/90 p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Link preview
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setPanel(null);
                    setArticleUrl("");
                    setArticleTitle("");
                    setArticleDescription("");
                    setArticleThumbnailUrl(null);
                    setLinkDomain(null);
                  }}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                LinkedIn’s API does not scrape the page — set a title (and optional
                description). Use Fetch to pull Open Graph values, then edit.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  type="url"
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  onBlur={() => {
                    if (articleUrl.trim() && !articleTitle.trim()) {
                      void fetchLinkPreview();
                    }
                  }}
                  placeholder="https://"
                  className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#0A66C2]/25"
                />
                <button
                  type="button"
                  disabled={linkPreviewBusy || !articleUrl.trim()}
                  onClick={() => void fetchLinkPreview()}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {linkPreviewBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Fetch"
                  )}
                </button>
              </div>
              <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Card title
              </label>
              <input
                type="text"
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="Title shown on the link card"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#0A66C2]/25"
              />
              <label className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Description <span className="font-normal normal-case">(optional)</span>
              </label>
              <textarea
                value={articleDescription}
                onChange={(e) => setArticleDescription(e.target.value)}
                rows={2}
                placeholder="Short description under the title"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#0A66C2]/25"
              />
              {(articleTitle || articleUrl) && (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {articleThumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={articleThumbnailUrl}
                      alt=""
                      className="h-28 w-full object-cover"
                    />
                  ) : null}
                  <div className="px-3 py-2.5">
                    <p className="text-[15px] font-semibold leading-snug text-[#000000e6]">
                      {articleTitle || "Title"}
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {linkDomain ||
                        (() => {
                          try {
                            return new URL(articleUrl).hostname.replace(/^www\./, "");
                          } catch {
                            return "domain.com";
                          }
                        })()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {panel === "image" ? (
            <div className="mx-4 mb-3 mt-2 rounded-xl border border-slate-200 bg-slate-50/90 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
                  <button
                    type="button"
                    onClick={() => setImageTab("upload")}
                    className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${
                      imageTab === "upload"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageTab("templates")}
                    className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${
                      imageTab === "templates"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Templates
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {imageTab === "upload" ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => onDropFiles(e, "image")}
                  className={`mt-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                    dragOver
                      ? "border-[#0A66C2] bg-sky-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <Upload className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    Drop images here
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    JPEG, PNG, GIF, or WebP · up to {imageSlotsLeft} more
                  </p>
                  <button
                    type="button"
                    disabled={busy === "upload" || imageSlotsLeft <= 0}
                    onClick={() => imageInputRef.current?.click()}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: LI_BLUE }}
                  >
                    {busy === "upload" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" />
                    )}
                    Choose from computer
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded-xl border-2 border-[#0A66C2] bg-white p-2 text-left shadow-sm"
                    >
                      <div className="aspect-square overflow-hidden rounded-lg bg-slate-100">
                        {previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={previewUrl}
                            alt="Quote template preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[11px] text-slate-400">
                            {previewBusy ? "Rendering…" : "Quote"}
                          </div>
                        )}
                      </div>
                      <p className="mt-1.5 text-[11px] font-semibold text-slate-800">
                        Quote card
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Photo · name · big line
                      </p>
                    </button>
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-2 text-left opacity-60">
                      <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-400">
                        Soon
                      </div>
                      <p className="mt-1.5 text-[11px] font-semibold text-slate-600">
                        More templates
                      </p>
                      <p className="text-[10px] text-slate-400">Coming next</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Type into template
                    </label>
                    <textarea
                      value={quoteText}
                      onChange={(e) => setQuoteText(e.target.value)}
                      rows={3}
                      placeholder="The big line that goes on the image…"
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0A66C2]/25"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Uses your photo, name, and “
                      {profile.quoteHandle || "Profit Coach"}” from Settings.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={busy === "quote" || !quoteText.trim()}
                    onClick={() => void handleGenerateQuote()}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: LI_BLUE }}
                  >
                    {busy === "quote" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" />
                    )}
                    Generate &amp; attach
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {panel === "video" ? (
            <div className="mx-4 mb-3 mt-2 rounded-xl border border-slate-200 bg-slate-50/90 p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Video
                </label>
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => onDropFiles(e, "video")}
                className={`mt-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                  dragOver
                    ? "border-[#0A66C2] bg-sky-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <Video className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  Drop an MP4 here
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  One video · ~3s–30 min · up to 200MB
                </p>
                <button
                  type="button"
                  disabled={busy === "upload"}
                  onClick={() => videoInputRef.current?.click()}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: LI_BLUE }}
                >
                  {busy === "upload" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Choose from computer
                </button>
              </div>
            </div>
          ) : null}

          {panel === "document" ? (
            <div className="mx-4 mb-3 mt-2 rounded-xl border border-slate-200 bg-slate-50/90 p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Document
                </label>
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => onDropFiles(e, "document")}
                className={`mt-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                  dragOver
                    ? "border-[#0A66C2] bg-sky-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <FileText className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  Drop a document here
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  PDF, DOC, DOCX, PPT, or PPTX · up to 100MB
                </p>
                <button
                  type="button"
                  disabled={busy === "upload"}
                  onClick={() => documentInputRef.current?.click()}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: LI_BLUE }}
                >
                  {busy === "upload" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Choose from computer
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-2 py-2">
            <button
              type="button"
              disabled={
                busy === "upload" || hasExclusiveMedia || (!hasExclusiveMedia && media.length >= 9)
              }
              onClick={openImagePanel}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold hover:bg-slate-100 disabled:opacity-50 ${
                panel === "image" ? "bg-slate-100 text-slate-900" : "text-slate-600"
              }`}
            >
              <ImagePlus className="h-4 w-4 text-emerald-600" />
              Image
            </button>
            <button
              type="button"
              disabled={busy === "upload" || hasImages || hasDocument || hasVideo}
              onClick={openVideoPanel}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold hover:bg-slate-100 disabled:opacity-50 ${
                panel === "video" ? "bg-slate-100 text-slate-900" : "text-slate-600"
              }`}
            >
              <Video className="h-4 w-4 text-rose-600" />
              Video
            </button>
            <button
              type="button"
              disabled={busy === "upload" || hasImages || hasVideo || hasDocument}
              onClick={openDocumentPanel}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold hover:bg-slate-100 disabled:opacity-50 ${
                panel === "document" ? "bg-slate-100 text-slate-900" : "text-slate-600"
              }`}
            >
              <FileText className="h-4 w-4 text-amber-600" />
              Document
            </button>
            <button
              type="button"
              onClick={() => setPanel("link")}
              disabled={hasExclusiveMedia}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold hover:bg-slate-100 disabled:opacity-50 ${
                panel === "link" ? "bg-slate-100 text-slate-900" : "text-slate-600"
              }`}
            >
              <Link2 className="h-4 w-4 text-sky-600" />
              Link
            </button>
            <p className="ml-auto pr-2 text-[11px] text-slate-400">
              {hasVideo ? "Video · " : hasDocument ? "Doc · " : hasImages ? "Image · " : ""}
              {content.length.toLocaleString()}
            </p>
            <input
              ref={imageInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void uploadImages(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept={VIDEO_ACCEPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void uploadVideo(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={documentInputRef}
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void uploadDocument(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {scheduleMode ? (
          <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-3">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-sky-900">
              <CalendarClock className="h-3.5 w-3.5" />
              Publish at
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(e) => setScheduledAtLocal(e.target.value)}
                className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  setScheduleMode(false);
                  setScheduledAtLocal("");
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            list="linkedin-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category…"
            aria-label="Category"
            className="w-36 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0A66C2]/20"
          />
          <datalist id="linkedin-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {editingId ? (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => resetComposer()}
                className="rounded-full px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
              >
                Cancel edit
              </button>
            ) : null}
            <button
              type="button"
              disabled={!connected || !!busy}
              onClick={() => void handleSaveDraft()}
              className="rounded-full px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
            >
              {busy === "draft" ? "Saving…" : editingId ? "Update draft" : "Save draft"}
            </button>
            <button
              type="button"
              disabled={!connected || !!busy}
              onClick={() => void handleSchedule()}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === "schedule" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="h-4 w-4" />
              )}
              {scheduleMode ? (editingId ? "Save schedule" : "Confirm") : "Schedule"}
            </button>
            <button
              type="button"
              disabled={!connected || !!busy}
              onClick={() => void handlePostNow()}
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              style={{ backgroundColor: LI_BLUE }}
            >
              {busy === "post" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Post
            </button>
          </div>
        </div>
    </div>
  );
}
