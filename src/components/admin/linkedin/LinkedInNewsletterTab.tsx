"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ClipboardCopy,
  Loader2,
  Newspaper,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  renderNewsletterCoverDataUrl,
  renderNewsletterCoverPng,
  type NewsletterCoverTemplate,
} from "@/lib/linkedinNewsletter/coverCard";
import type {
  NewsletterEditionRow,
  NewsletterFormat,
  NewsletterLengthMode,
  NewsletterSeriesRow,
  Overview537,
} from "@/lib/linkedinNewsletter/types";
import { SHORT_WORD_RANGE, wordCount } from "@/lib/linkedinNewsletter/types";
import { LI_BLUE, type LinkedInProfilePreview, displayName } from "./types";

type Props = {
  getToken: () => Promise<string>;
  profile: LinkedInProfilePreview;
  onMessage: (message: string, tone: "success" | "error" | "neutral") => void;
  onUsePromoInComposer: (content: string) => void;
};

type View = "list" | "setup" | "series" | "editor";

const COVER_TEMPLATES: Array<{ id: NewsletterCoverTemplate; label: string }> = [
  { id: "navy_banner", label: "Navy banner" },
  { id: "orange_accent", label: "Orange accent" },
  { id: "minimal_dark", label: "Minimal dark" },
];

const FORMAT_OPTIONS: Array<{ id: NewsletterFormat; label: string }> = [
  { id: "pam_537_overview", label: "Pam 5-3-7 overview" },
  { id: "pam_deep_dive", label: "Pam deep dive" },
  { id: "quick_insight", label: "Quick insight (400–800)" },
  { id: "timely_pov", label: "Timely POV (400–800)" },
  { id: "in_depth", label: "In-depth (2,000+)" },
  { id: "breezy_story", label: "Breezy story → teach → CTA" },
  { id: "curated_roundup", label: "Curated roundup" },
];

export function LinkedInNewsletterTab({
  getToken,
  profile,
  onMessage,
  onUsePromoInComposer,
}: Props) {
  const [view, setView] = useState<View>("list");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [seriesList, setSeriesList] = useState<NewsletterSeriesRow[]>([]);
  const [series, setSeries] = useState<NewsletterSeriesRow | null>(null);
  const [editions, setEditions] = useState<NewsletterEditionRow[]>([]);
  const [edition, setEdition] = useState<NewsletterEditionRow | null>(null);

  // setup fields
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [cadence, setCadence] = useState<"weekly" | "fortnightly" | "monthly">(
    "fortnightly"
  );
  const [leadTopic, setLeadTopic] = useState("");
  const [nameIdeas, setNameIdeas] = useState<string[]>([]);
  const [topicIdeas, setTopicIdeas] = useState<
    Array<{ title: string; angle: string; why: string }>
  >([]);
  const [targetCount, setTargetCount] = useState(16);
  const [showSeriesPlanner, setShowSeriesPlanner] = useState(false);

  // editor
  const [body, setBody] = useState("");
  const [promo, setPromo] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [aiNote, setAiNote] = useState("");
  const [format, setFormat] = useState<NewsletterFormat>("pam_deep_dive");
  const [lengthMode, setLengthMode] = useState<NewsletterLengthMode>("short");
  const [coverTemplate, setCoverTemplate] =
    useState<NewsletterCoverTemplate>("navy_banner");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverHeadline, setCoverHeadline] = useState("");
  const [coverTagline, setCoverTagline] = useState("");

  const words = useMemo(() => wordCount(body), [body]);
  const wordHint =
    lengthMode === "long"
      ? `~${words} words (in-depth target ~2,000+)`
      : `~${words} words (sweet spot ${SHORT_WORD_RANGE.min}–${SHORT_WORD_RANGE.max})`;

  const loadSeriesList = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/linkedin/newsletter/series", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json().catch(() => ({}))) as {
        series?: NewsletterSeriesRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load series.");
      setSeriesList(json.series ?? []);
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Failed to load.", "error");
    } finally {
      setLoading(false);
    }
  }, [getToken, onMessage]);

  useEffect(() => {
    void loadSeriesList();
  }, [loadSeriesList]);

  const openSeries = async (id: string) => {
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/linkedin/newsletter/series/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json().catch(() => ({}))) as {
        series?: NewsletterSeriesRow;
        editions?: NewsletterEditionRow[];
        error?: string;
      };
      if (!res.ok || !json.series) throw new Error(json.error || "Not found.");
      setSeries(json.series);
      setEditions(json.editions ?? []);
      setLeadTopic(json.series.lead_topic ?? "");
      setView("series");
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Failed to open.", "error");
    } finally {
      setBusy(false);
    }
  };

  const createSeries = async () => {
    if (!name.trim()) {
      onMessage("Pick or type a newsletter name first.", "error");
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/linkedin/newsletter/series", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          tagline: tagline.trim() || null,
          cadence,
          lead_topic: leadTopic.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        series?: NewsletterSeriesRow;
        error?: string;
      };
      if (!res.ok || !json.series) throw new Error(json.error || "Create failed.");
      setSeries(json.series);
      setEditions([]);
      setView("series");
      onMessage("Newsletter ready — pick a topic and write this edition.", "success");
      void loadSeriesList();
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Create failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const suggestNames = async () => {
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/linkedin/newsletter/name-ideas", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json().catch(() => ({}))) as {
        ideas?: string[];
        taglines?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Name ideas failed.");
      setNameIdeas(json.ideas ?? []);
      if (json.taglines?.[0] && !tagline) setTagline(json.taglines[0]);
      onMessage("Name ideas ready — pick one that says it on the tin.", "success");
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Name ideas failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const suggestTopics = async () => {
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/linkedin/newsletter/topic-ideas", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json().catch(() => ({}))) as {
        topics?: Array<{ title: string; angle: string; why: string }>;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Topic ideas failed.");
      setTopicIdeas(json.topics ?? []);
      onMessage("Topic ideas from your AI brain / ICP.", "success");
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Topic ideas failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const writeThisEdition = async () => {
    if (!series) return;
    if (!leadTopic.trim()) {
      onMessage("Add a topic for this edition first.", "error");
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      const createRes = await fetch(
        `/api/linkedin/newsletter/series/${series.id}/editions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: leadTopic.trim(),
            format: "pam_537_overview",
            length_mode: "short",
          }),
        }
      );
      const created = (await createRes.json().catch(() => ({}))) as {
        edition?: NewsletterEditionRow;
        error?: string;
      };
      if (!createRes.ok || !created.edition) {
        throw new Error(created.error || "Could not create edition.");
      }

      const draftRes = await fetch(
        `/api/linkedin/newsletter/editions/${created.edition.id}/draft`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            format: "pam_537_overview",
            length_mode: "short",
          }),
        }
      );
      const drafted = (await draftRes.json().catch(() => ({}))) as {
        edition?: NewsletterEditionRow;
        error?: string;
      };
      if (!draftRes.ok || !drafted.edition) {
        // Still open editor even if draft fails — they can retry
        setEditions((list) => [...list, created.edition!]);
        openEditor(created.edition);
        throw new Error(drafted.error || "Created, but AI draft failed — try Write draft.");
      }

      setEditions((list) => [...list, drafted.edition!]);
      openEditor(drafted.edition);
      onMessage("Draft ready — edit the artifact, then copy into LinkedIn.", "success");
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Write failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const generatePlan = async () => {
    if (!series) return;
    if (!leadTopic.trim()) {
      onMessage("Pick a topic to build the optional series plan from.", "error");
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      await fetch(`/api/linkedin/newsletter/series/${series.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lead_topic: leadTopic.trim() }),
      });
      const res = await fetch(`/api/linkedin/newsletter/series/${series.id}/plan`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_topic: leadTopic.trim(),
          target_count: targetCount,
          length_mode: "short",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        series?: NewsletterSeriesRow;
        editions?: NewsletterEditionRow[];
        name_ideas?: string[];
        error?: string;
      };
      if (!res.ok || !json.series) throw new Error(json.error || "Plan failed.");
      setSeries(json.series);
      setEditions(json.editions ?? []);
      if (json.name_ideas?.length) setNameIdeas(json.name_ideas);
      onMessage(
        `Series plan ready (${json.editions?.length ?? 0} editions). Open any one to write.`,
        "success"
      );
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Plan failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const openEditor = (ed: NewsletterEditionRow) => {
    setEdition(ed);
    setBody(ed.body_markdown || "");
    setPromo(ed.promo_post_text || "");
    setSeoTitle(ed.seo_title || "");
    setSeoDesc(ed.seo_description || "");
    setFormat(ed.format);
    setLengthMode(ed.length_mode);
    setCoverHeadline(ed.cover?.headline || ed.title);
    setCoverTagline(ed.cover?.tagline || ed.tagline || "");
    setCoverTemplate(ed.cover?.template || "navy_banner");
    setAiNote("");
    setView("editor");
  };

  const saveEdition = async (extra?: Partial<NewsletterEditionRow>) => {
    if (!edition) return;
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/linkedin/newsletter/editions/${edition.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body_markdown: body,
          promo_post_text: promo,
          seo_title: seoTitle,
          seo_description: seoDesc,
          format,
          length_mode: lengthMode,
          cover: {
            template: coverTemplate,
            headline: coverHeadline,
            tagline: coverTagline,
            emoji: "💥",
          },
          ...extra,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        edition?: NewsletterEditionRow;
        error?: string;
      };
      if (!res.ok || !json.edition) throw new Error(json.error || "Save failed.");
      setEdition(json.edition);
      setEditions((list) =>
        list.map((e) => (e.id === json.edition!.id ? json.edition! : e))
      );
      onMessage("Saved.", "success");
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const draftWithAi = async (revise?: boolean) => {
    if (!edition) return;
    setBusy(true);
    try {
      const token = await getToken();
      // persist current body first so revise can see it
      if (revise || body.trim()) {
        await fetch(`/api/linkedin/newsletter/editions/${edition.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            body_markdown: body,
            format,
            length_mode: lengthMode,
          }),
        });
      }
      const res = await fetch(
        `/api/linkedin/newsletter/editions/${edition.id}/draft`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            format,
            length_mode: lengthMode,
            revise_instruction: revise
              ? aiNote.trim() || "Tighten and improve while keeping structure."
              : undefined,
          }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        edition?: NewsletterEditionRow;
        error?: string;
      };
      if (!res.ok || !json.edition) throw new Error(json.error || "Draft failed.");
      setEdition(json.edition);
      setBody(json.edition.body_markdown);
      setPromo(json.edition.promo_post_text || "");
      setSeoTitle(json.edition.seo_title || "");
      setSeoDesc(json.edition.seo_description || "");
      setCoverHeadline(json.edition.cover?.headline || json.edition.title);
      setCoverTagline(json.edition.cover?.tagline || json.edition.tagline || "");
      setEditions((list) =>
        list.map((e) => (e.id === json.edition!.id ? json.edition! : e))
      );
      setAiNote("");
      onMessage(
        revise ? "Artifact updated from your instruction." : "Draft written from your AI brain.",
        "success"
      );
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Draft failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(body);
      if (!edition) return;
      setBusy(true);
      const token = await getToken();
      const res = await fetch(`/api/linkedin/newsletter/editions/${edition.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body_markdown: body,
          promo_post_text: promo,
          seo_title: seoTitle,
          seo_description: seoDesc,
          format,
          length_mode: lengthMode,
          status: "copied",
          cover: {
            template: coverTemplate,
            headline: coverHeadline,
            tagline: coverTagline,
            emoji: "💥",
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        edition?: NewsletterEditionRow;
      };
      if (json.edition) {
        setEdition(json.edition);
        setEditions((list) =>
          list.map((e) => (e.id === json.edition!.id ? json.edition! : e))
        );
      }
      onMessage(
        "Copied. Paste into LinkedIn newsletter (draft in Docs first if you prefer).",
        "success"
      );
    } catch {
      onMessage("Clipboard failed — select the draft and copy manually.", "error");
    } finally {
      setBusy(false);
    }
  };

  const copyPromo = async () => {
    if (!promo.trim()) {
      onMessage("No promo post yet — draft the edition first.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(promo);
      onMessage("Promo post copied.", "success");
    } catch {
      onMessage("Clipboard failed.", "error");
    }
  };

  useEffect(() => {
    if (view !== "editor") return;
    let revoked: string | null = null;
    void (async () => {
      try {
        const url = await renderNewsletterCoverDataUrl({
          template: coverTemplate,
          newsletterName: series?.name || "Newsletter",
          headline: coverHeadline || edition?.title || "This week",
          tagline: coverTagline || "",
          emoji: "💥",
          authorName: displayName(profile),
        });
        revoked = url;
        setCoverPreview(url);
      } catch {
        setCoverPreview(null);
      }
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [
    view,
    coverTemplate,
    coverHeadline,
    coverTagline,
    series?.name,
    edition?.title,
    profile,
  ]);

  const downloadCover = async () => {
    try {
      const blob = await renderNewsletterCoverPng({
        template: coverTemplate,
        newsletterName: series?.name || "Newsletter",
        headline: coverHeadline || edition?.title || "This week",
        tagline: coverTagline || "",
        emoji: "💥",
        authorName: displayName(profile),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `newsletter-cover-${edition?.sequence_index ?? "x"}.png`;
      a.click();
      URL.revokeObjectURL(url);
      onMessage("Cover downloaded — upload it as the LinkedIn newsletter image.", "success");
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Cover failed.", "error");
    }
  };

  const overview = series?.overview_537 as Overview537 | undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading newsletters…
      </div>
    );
  }

  if (view === "list") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-white"
              style={{ backgroundColor: LI_BLUE }}
            >
              <Newspaper className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-slate-900">
                Newsletter studio
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Pick a topic, write this edition with AI (using your brain / ICP),
                edit the live draft, copy into LinkedIn, and get a feed promo post.
                Optionally expand one topic into a longer content series later.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setName("");
              setTagline("");
              setLeadTopic("");
              setNameIdeas([]);
              setTopicIdeas([]);
              setView("setup");
            }}
            className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: LI_BLUE }}
          >
            {seriesList.length ? "New newsletter" : "Set up your newsletter"}
          </button>
        </div>

        <div className="space-y-2">
          {seriesList.length === 0 ? (
            <p className="text-sm text-slate-500">
              Set up once (name + tagline), then write editions as you go.
            </p>
          ) : (
            seriesList.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void openSeries(s.id)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    {s.cadence}
                    {s.lead_topic ? ` · ${s.lead_topic}` : ""}
                  </p>
                </div>
                <BookOpen className="h-4 w-4 text-slate-400" />
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === "setup") {
    return (
      <div className="mx-auto max-w-2xl space-y-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <button
          type="button"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          onClick={() => setView("list")}
        >
          ← Back
        </button>
        <h2 className="text-lg font-semibold text-slate-900">Name your newsletter</h2>
        <p className="text-sm text-slate-600">
          Say what it is on the tin — niche + profit/outcome (Pam: “Law Firm Profit
          Newsletter”).
        </p>
        <label className="block text-xs font-semibold text-slate-600">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="e.g. Manufacturing Profit Power-Up"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Tagline
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Have more profit and fun…"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          How often you publish
          <select
            value={cadence}
            onChange={(e) =>
              setCadence(e.target.value as typeof cadence)
            }
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void suggestNames()}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" />
            Suggest names from AI brain
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void createSeries()}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: LI_BLUE }}
          >
            {busy ? "Working…" : "Continue"}
          </button>
        </div>
        {nameIdeas.length ? (
          <div className="flex flex-wrap gap-2">
            {nameIdeas.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setName(idea)}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-200"
              >
                {idea}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (view === "series" && series) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <button
          type="button"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          onClick={() => {
            setView("list");
            void loadSeriesList();
          }}
        >
          ← All newsletters
        </button>

        {/* Primary: write this edition */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{series.name}</h2>
          <p className="text-sm text-slate-500">
            {series.tagline || "Write one edition at a time"}
          </p>

          <label className="mt-5 block text-xs font-semibold text-slate-600">
            Topic for this edition
            <input
              value={leadTopic}
              onChange={(e) => setLeadTopic(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="e.g. Pricing courage when you're scared to raise fees"
            />
          </label>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Each edition is one topic. Next week you can pick a different pain —
            you&apos;re not locked into one theme forever.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void suggestTopics()}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Suggest topics
            </button>
            <button
              type="button"
              disabled={busy || !leadTopic.trim()}
              onClick={() => void writeThisEdition()}
              className="rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: LI_BLUE }}
            >
              {busy ? "Writing…" : "Write this edition"}
            </button>
          </div>

          {topicIdeas.length ? (
            <div className="mt-3 space-y-1">
              {topicIdeas.map((t) => (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => setLeadTopic(t.title)}
                  className="block w-full rounded-xl border border-slate-100 px-3 py-2 text-left text-xs hover:bg-slate-50"
                >
                  <span className="font-semibold text-slate-800">{t.title}</span>
                  {t.angle ? (
                    <span className="block text-slate-500">{t.angle}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Past / drafted editions */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Your editions ({editions.length})
          </p>
          {editions.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nothing written yet — add a topic above and hit Write this edition.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {editions.map((ed) => (
                <li key={ed.id}>
                  <button
                    type="button"
                    onClick={() => openEditor(ed)}
                    className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className="w-8 shrink-0 text-xs font-bold text-slate-400">
                      {ed.sequence_index}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {ed.title}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {ed.status}
                        {ed.body_markdown?.trim() ? " · has draft" : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Optional: series planner — collapsed by default */}
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
          <button
            type="button"
            onClick={() => setShowSeriesPlanner((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Optional: plan a content series
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Turn one topic into a 5-3-7 overview, then optionally map follow-ups
                (one edition per strategy / mistake / checklist item). Useful when you
                want months of topics planned — not required to write this week.
              </p>
            </div>
            <span className="ml-3 text-xs font-semibold text-slate-500">
              {showSeriesPlanner ? "Hide" : "Show"}
            </span>
          </button>

          {showSeriesPlanner ? (
            <div className="mt-4 space-y-3 border-t border-slate-200/80 pt-4">
              <p className="text-xs text-slate-600">
                Uses the topic above. Generates a Pam-style 5 strategies / 3 mistakes /
                7 checklist, then builds a plan of editions you can write over time
                (default 16; bump toward 26 if you publish every two weeks and want a
                year mapped). Different pains = different series plans later.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">
                  Plan size
                  <select
                    value={targetCount}
                    onChange={(e) => setTargetCount(Number(e.target.value) || 16)}
                    className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  >
                    <option value={16}>16 (overview + 5 + 3 + 7)</option>
                    <option value={26}>26 (+ fillers ≈ year fortnightly)</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy || !leadTopic.trim()}
                  onClick={() => void generatePlan()}
                  className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busy ? "Planning…" : "Build series plan"}
                </button>
              </div>
              {overview && overview.strategies.length ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <OverviewCol title="✅ 5 strategies" items={overview.strategies} />
                  <OverviewCol title="⚠️ 3 mistakes" items={overview.mistakes} />
                  <OverviewCol title="🧾 7 checklist" items={overview.checklist} />
                </div>
              ) : null}
              <p className="text-[11px] text-amber-800">
                Building a series plan replaces the edition list below with the planned
                titles (existing drafts for this newsletter are cleared).
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (view === "editor" && edition && series) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            onClick={() => setView("series")}
          >
            ← {series.name}
          </button>
          <span className="text-xs text-slate-400">
            Edition {edition.sequence_index} · {edition.kind}
          </span>
          <span className="ml-auto text-xs text-slate-500">{wordHint}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* AI side */}
          <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              AI (patches the artifact — doesn&apos;t thrash full rewrites)
            </p>
            <label className="block text-xs font-semibold text-slate-600">
              Format
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as NewsletterFormat)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Length
              <select
                value={lengthMode}
                onChange={(e) =>
                  setLengthMode(e.target.value as NewsletterLengthMode)
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="short">Short 400–800 (default)</option>
                <option value="long">Long 2,000+ (guide / case study)</option>
              </select>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void draftWithAi(false)}
              className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: LI_BLUE }}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {body.trim() ? "Regenerate from brain" : "Write draft from AI brain"}
            </button>
            <textarea
              value={aiNote}
              onChange={(e) => setAiNote(e.target.value)}
              rows={4}
              placeholder="Revise instruction: e.g. shorter intro, stronger Yorkshire voice, add a client story…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || !body.trim()}
              onClick={() => void draftWithAi(true)}
              className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Apply revision to artifact
            </button>

            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-600">Cover image</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {COVER_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCoverTemplate(t.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      coverTemplate === t.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <input
                value={coverHeadline}
                onChange={(e) => setCoverHeadline(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                placeholder="Cover headline"
              />
              <input
                value={coverTagline}
                onChange={(e) => setCoverTagline(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                placeholder="Cover tagline"
              />
              {coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPreview}
                  alt=""
                  className="mt-2 w-full rounded-xl border border-slate-200"
                />
              ) : null}
              <button
                type="button"
                onClick={() => void downloadCover()}
                className="mt-2 w-full rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Download cover PNG
              </button>
            </div>
          </div>

          {/* Artifact */}
          <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Live artifact
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveEdition()}
                className="ml-auto rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => void copyBody()}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: LI_BLUE }}
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                Copy for LinkedIn
              </button>
            </div>
            <input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
              placeholder="SEO title (set before publishing)"
            />
            <input
              value={seoDesc}
              onChange={(e) => setSeoDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="SEO description"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={22}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-900"
              placeholder="Edition body appears here — edit live, then copy into LinkedIn."
            />
            <div className="rounded-2xl border border-dashed border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-slate-600">
                  Feed promo post
                </p>
                <button
                  type="button"
                  onClick={() => void copyPromo()}
                  className="ml-auto rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-800"
                >
                  Copy promo
                </button>
                <button
                  type="button"
                  disabled={!promo.trim()}
                  onClick={() => onUsePromoInComposer(promo)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-800 disabled:opacity-40"
                >
                  Open in Compose
                </button>
              </div>
              <textarea
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
                rows={5}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Promo post for your feed (generated with the edition)."
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function OverviewCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[11px] font-semibold text-slate-600">{title}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </div>
  );
}
