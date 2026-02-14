"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { PlaybookTabs } from "@/components/playbooks/PlaybookTabs";
import { getPlaybookMeta } from "@/lib/bossData";
import { parsePastedPlaybookContent } from "@/lib/parsePlaybookPaste";
import type {
  PlaybookContent as PlaybookContentType,
  PlayItem,
  PlaySection,
  RelatedPlaybookItem,
  WhatItLooksLikeItem,
} from "@/lib/playbookContentTypes";

export default function AdminPlaybookDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = use(params);
  const router = useRouter();
  const [content, setContent] = useState<PlaybookContentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pasteExpanded, setPasteExpanded] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteMessage, setPasteMessage] = useState<string | null>(null);
  const [form, setForm] = useState<{
    whatThisIs: string;
    whatItLooksLike: { broken: WhatItLooksLikeItem; ok: WhatItLooksLikeItem; working: WhatItLooksLikeItem };
    thingsToThinkAbout: string[];
    plays: PlayItem[];
    playsIntro: string;
    playsSections: PlaySection[];
    quickWins: string[];
    relatedPlaybooks: RelatedPlaybookItem[];
  } | null>(null);

  const meta = getPlaybookMeta(ref);
  if (!meta) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-rose-600">Playbook not found.</p>
        <Link
          href="/admin/playbooks"
          className="text-sm text-sky-700 underline"
        >
          Back to Playbooks
        </Link>
      </div>
    );
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      if (cancelled) return;
      if (roleBody.role !== "admin") {
        router.replace("/coach");
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/playbooks/${encodeURIComponent(ref)}`);
      if (cancelled) return;
      const data = res.ok ? ((await res.json()) as PlaybookContentType) : null;
      setContent(data);
      setLoading(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [ref, router]);

  useEffect(() => {
    if (content && editing && !form) {
      setForm({
        whatThisIs: content.whatThisIs ?? "",
        whatItLooksLike: content.whatItLooksLike,
        thingsToThinkAbout: [...(content.thingsToThinkAbout ?? [])],
        plays: [...(content.plays ?? [])].map((p) => ({ ...p })),
        playsIntro: content.playsIntro ?? "",
        playsSections: (content.playsSections ?? []).map((s) => ({
          title: s.title,
          description: s.description,
          plays: (s.plays ?? []).map((p) => ({ ...p })),
        })),
        quickWins: [...(content.quickWins ?? [])],
        relatedPlaybooks: (content.relatedPlaybooks ?? []).map((r) => ({
          ref: r.ref,
          description: r.description ?? "",
        })),
      });
    }
    if (!editing) setForm(null);
  }, [content, editing, form]);

  if (loading || !content) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-rose-600">{error}</p>
        <Link
          href="/admin/playbooks"
          className="text-sm text-sky-700 underline"
        >
          Back to Playbooks
        </Link>
      </div>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaveError(null);
    setSaving(true);
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");
      const res = await fetch(`/api/admin/playbooks/${encodeURIComponent(ref)}/content`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          whatThisIs: form.whatThisIs,
          whatItLooksLike: form.whatItLooksLike,
          thingsToThinkAbout: form.thingsToThinkAbout.filter(Boolean),
          plays: form.playsSections.length ? [] : form.plays,
          playsIntro: form.playsIntro || undefined,
          playsSections: form.playsSections.length ? form.playsSections : undefined,
          quickWins: form.quickWins.filter(Boolean),
          relatedPlaybooks: form.relatedPlaybooks
            .filter((r) => r.ref?.trim())
            .map((r) => ({ ref: r.ref.trim(), description: r.description?.trim() ?? "" })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save");
      setContent(data);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <Link
            href="/admin/playbooks"
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            ← Back to Playbooks
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">
            {content.ref} {content.name} Playbook
          </h1>
          <p className="mt-1 text-sm text-slate-500">{content.subtitle}</p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
          >
            Edit content
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="playbook-edit-form"
              disabled={saving}
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-70"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </header>

      {saveError && (
        <p className="text-sm text-rose-600" role="alert">{saveError}</p>
      )}

      {editing && form ? (
        <form
          id="playbook-edit-form"
          onSubmit={handleSave}
          className="flex flex-col gap-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <button
              type="button"
              onClick={() => setPasteExpanded((e) => !e)}
              className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900"
            >
              Paste full content
              <span className="text-slate-400">{pasteExpanded ? "−" : "+"}</span>
            </button>
            {pasteExpanded && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-slate-600">
                  Paste the full playbook text (with section headers) and click Parse to fill the form.
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => {
                    setPasteText(e.target.value);
                    setPasteMessage(null);
                  }}
                  placeholder="Paste full playbook content here…"
                  rows={6}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parsePastedPlaybookContent(pasteText);
                      const parts: string[] = [];
                      if (parsed.whatThisIs) parts.push("What This Is");
                      if (parsed.whatItLooksLike) parts.push("What It Looks Like");
                      if (parsed.thingsToThinkAbout?.length)
                        parts.push(`${parsed.thingsToThinkAbout.length} things`);
                      if (parsed.playsIntro || parsed.plays?.length || parsed.playsSections?.length)
                        parts.push("Plays");
                      if (parsed.quickWins?.length)
                        parts.push(`${parsed.quickWins.length} quick wins`);
                      if (parsed.relatedPlaybooks?.length)
                        parts.push(`${parsed.relatedPlaybooks.length} related playbooks`);
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              ...(parsed.whatThisIs !== undefined && {
                                whatThisIs: parsed.whatThisIs,
                              }),
                              ...(parsed.whatItLooksLike && {
                                whatItLooksLike: parsed.whatItLooksLike,
                              }),
                              ...(parsed.thingsToThinkAbout && {
                                thingsToThinkAbout: parsed.thingsToThinkAbout,
                              }),
                              ...(parsed.playsIntro !== undefined && {
                                playsIntro: parsed.playsIntro,
                              }),
                              ...(parsed.playsSections && parsed.playsSections.length > 0
                                ? {
                                    playsSections: parsed.playsSections,
                                    plays: [] as PlayItem[],
                                  }
                                : parsed.plays && parsed.plays.length > 0
                                  ? {
                                      playsSections: [] as PlaySection[],
                                      plays: parsed.plays,
                                    }
                                  : {}),
                              ...(parsed.quickWins && { quickWins: parsed.quickWins }),
                              ...(parsed.relatedPlaybooks && {
                                relatedPlaybooks: parsed.relatedPlaybooks,
                              }),
                            }
                          : f
                      );
                      setPasteMessage(
                        parts.length > 0
                          ? `Parsed: ${parts.join(", ")}`
                          : "No sections recognized. Check format."
                      );
                    }}
                    className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
                  >
                    Parse and fill form
                  </button>
                  {pasteMessage && (
                    <span
                      className={`text-sm ${pasteMessage.startsWith("Parsed") ? "text-slate-600" : "text-amber-600"}`}
                    >
                      {pasteMessage}
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">What This Is</h2>
            <textarea
              value={form.whatThisIs}
              onChange={(e) => setForm((f) => f && { ...f, whatThisIs: e.target.value })}
              rows={8}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              placeholder="Paste or type overview text…"
            />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">What It Looks Like</h2>
            <div className="mt-4 space-y-4">
              {(["broken", "ok", "working"] as const).map((key) => (
                <div key={key} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <label className="text-xs font-medium text-slate-600">
                    {form.whatItLooksLike[key].emoji} {form.whatItLooksLike[key].label}
                  </label>
                  <textarea
                    value={form.whatItLooksLike[key].content}
                    onChange={(e) =>
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              whatItLooksLike: {
                                ...f.whatItLooksLike,
                                [key]: { ...f.whatItLooksLike[key], content: e.target.value },
                              },
                            }
                          : f
                      )
                    }
                    rows={4}
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">Things to Think About</h2>
            <p className="mt-1 text-xs text-slate-500">One item per line or add/remove below.</p>
            <ul className="mt-3 space-y-2">
              {form.thingsToThinkAbout.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <textarea
                    value={item}
                    onChange={(e) =>
                      setForm((f) => {
                        if (!f) return f;
                        const next = [...f.thingsToThinkAbout];
                        next[i] = e.target.value;
                        return { ...f, thingsToThinkAbout: next };
                      })
                    }
                    rows={2}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              thingsToThinkAbout: f.thingsToThinkAbout.filter((_, j) => j !== i),
                            }
                          : f
                      )
                    }
                    className="shrink-0 text-slate-400 hover:text-rose-600"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                setForm((f) =>
                  f ? { ...f, thingsToThinkAbout: [...f.thingsToThinkAbout, ""] } : f
                )
              }
              className="mt-2 text-sm font-medium text-sky-600 hover:text-sky-700"
            >
              + Add item
            </button>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">Plays</h2>
            <label className="mt-2 block">
              <span className="text-xs text-slate-600">Intro paragraph (optional)</span>
              <textarea
                value={form.playsIntro}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, playsIntro: e.target.value } : f))
                }
                rows={3}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                placeholder="e.g. This playbook is organised into three sections. When you open it in the Profit System, you will find:"
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Use &quot;Organise into sections&quot; when the playbook has section headings (e.g. Role Clarity, Structure &amp; Authority) with plays under each.
            </p>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.playsSections.length > 0}
                onChange={(e) =>
                  setForm((f) => {
                    if (!f) return f;
                    if (e.target.checked) {
                      return {
                        ...f,
                        playsSections: f.plays.length
                          ? [{ title: "", description: "", plays: f.plays }]
                          : [{ title: "", description: "", plays: [] }],
                        plays: [],
                      };
                    }
                    const flat: PlayItem[] = [];
                    f.playsSections.forEach((s) => s.plays.forEach((p) => flat.push({ ...p })));
                    return { ...f, playsSections: [], plays: flat.length ? flat : [{ number: 1, title: "", description: "" }] };
                  })
                }
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-sm text-slate-700">Organise into sections</span>
            </label>
            {form.playsSections.length > 0 ? (
              <div className="mt-4 space-y-6">
                {form.playsSections.map((sec, si) => (
                  <div key={si} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={sec.title}
                          onChange={(e) =>
                            setForm((f) => {
                              if (!f) return f;
                              const next = f.playsSections.map((s, j) =>
                                j === si ? { ...s, title: e.target.value } : s
                              );
                              return { ...f, playsSections: next };
                            })
                          }
                          placeholder="Section title (e.g. Role Clarity)"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium"
                        />
                        <textarea
                          value={sec.description}
                          onChange={(e) =>
                            setForm((f) => {
                              if (!f) return f;
                              const next = f.playsSections.map((s, j) =>
                                j === si ? { ...s, description: e.target.value } : s
                              );
                              return { ...f, playsSections: next };
                            })
                          }
                          rows={2}
                          placeholder="Short description of this section"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) =>
                            f
                              ? {
                                  ...f,
                                  playsSections: f.playsSections.filter((_, j) => j !== si),
                                }
                              : f
                          )
                        }
                        className="shrink-0 text-slate-400 hover:text-rose-600"
                        aria-label="Remove section"
                      >
                        ×
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {sec.plays.map((play, pi) => (
                        <div key={pi} className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="number"
                              min={1}
                              value={play.number}
                              onChange={(e) =>
                                setForm((f) => {
                                  if (!f) return f;
                                  const next = [...f.playsSections];
                                  next[si] = {
                                    ...next[si],
                                    plays: next[si].plays.map((p, k) =>
                                      k === pi ? { ...p, number: parseInt(e.target.value, 10) || 1 } : p
                                    ),
                                  };
                                  return { ...f, playsSections: next };
                                })
                              }
                              className="w-14 rounded border border-slate-300 px-2 py-1 text-sm"
                            />
                            <input
                              type="text"
                              value={play.title}
                              onChange={(e) =>
                                setForm((f) => {
                                  if (!f) return f;
                                  const next = [...f.playsSections];
                                  next[si] = {
                                    ...next[si],
                                    plays: next[si].plays.map((p, k) =>
                                      k === pi ? { ...p, title: e.target.value } : p
                                    ),
                                  };
                                  return { ...f, playsSections: next };
                                })
                              }
                              placeholder="Play title"
                              className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) => {
                                  if (!f) return f;
                                  const next = [...f.playsSections];
                                  next[si] = {
                                    ...next[si],
                                    plays: next[si].plays.filter((_, k) => k !== pi),
                                  };
                                  return { ...f, playsSections: next };
                                })
                              }
                              className="text-slate-400 hover:text-rose-600"
                              aria-label="Remove play"
                            >
                              ×
                            </button>
                          </div>
                          <textarea
                            value={play.description}
                            onChange={(e) =>
                              setForm((f) => {
                                if (!f) return f;
                                const next = [...f.playsSections];
                                next[si] = {
                                  ...next[si],
                                  plays: next[si].plays.map((p, k) =>
                                    k === pi ? { ...p, description: e.target.value } : p
                                  ),
                                };
                                return { ...f, playsSections: next };
                              })
                            }
                            rows={2}
                            placeholder="Description"
                            className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => {
                          if (!f) return f;
                          const next = [...f.playsSections];
                          const num = next[si].plays.length + 1;
                          next[si] = {
                            ...next[si],
                            plays: [
                              ...next[si].plays,
                              { number: num, title: "", description: "" },
                            ],
                          };
                          return { ...f, playsSections: next };
                        })
                      }
                      className="mt-2 text-sm font-medium text-sky-600 hover:text-sky-700"
                    >
                      + Add play to this section
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            playsSections: [
                              ...f.playsSections,
                              { title: "", description: "", plays: [] },
                            ],
                          }
                        : f
                    )
                  }
                  className="text-sm font-medium text-sky-600 hover:text-sky-700"
                >
                  + Add section
                </button>
              </div>
            ) : (
              <>
              <div className="mt-3 space-y-4">
              {form.plays.map((play, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-1 text-xs text-slate-600">
                      Number
                      <input
                        type="number"
                        min={1}
                        value={play.number}
                        onChange={(e) =>
                          setForm((f) => {
                            if (!f) return f;
                            const next = f.plays.map((p, j) =>
                              j === i ? { ...p, number: parseInt(e.target.value, 10) || 1 } : p
                            );
                            return { ...f, plays: next };
                          })
                        }
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="flex-1 min-w-[12rem]">
                      <span className="text-xs text-slate-600">Title</span>
                      <input
                        type="text"
                        value={play.title}
                        onChange={(e) =>
                          setForm((f) => {
                            if (!f) return f;
                            const next = f.plays.map((p, j) =>
                              j === i ? { ...p, title: e.target.value } : p
                            );
                            return { ...f, plays: next };
                          })
                        }
                        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) =>
                          f ? { ...f, plays: f.plays.filter((_, j) => j !== i) } : f
                        )
                      }
                      className="shrink-0 text-slate-400 hover:text-rose-600"
                      aria-label="Remove play"
                    >
                      ×
                    </button>
                  </div>
                  <label className="mt-2 block">
                    <span className="text-xs text-slate-600">Description</span>
                    <textarea
                      value={play.description}
                      onChange={(e) =>
                        setForm((f) => {
                          if (!f) return f;
                          const next = f.plays.map((p, j) =>
                            j === i ? { ...p, description: e.target.value } : p
                          );
                          return { ...f, plays: next };
                        })
                      }
                      rows={2}
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </label>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setForm((f) =>
                  f
                    ? {
                        ...f,
                        plays: [
                          ...f.plays,
                          {
                            number: f.plays.length + 1,
                            title: "",
                            description: "",
                          },
                        ],
                      }
                    : f
                )
              }
              className="mt-2 text-sm font-medium text-sky-600 hover:text-sky-700"
            >
              + Add play
            </button>
              </>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">Quick Wins</h2>
            <ul className="mt-3 space-y-2">
              {form.quickWins.map((win, i) => (
                <li key={i} className="flex gap-2">
                  <textarea
                    value={win}
                    onChange={(e) =>
                      setForm((f) => {
                        if (!f) return f;
                        const next = [...f.quickWins];
                        next[i] = e.target.value;
                        return { ...f, quickWins: next };
                      })
                    }
                    rows={1}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) =>
                        f ? { ...f, quickWins: f.quickWins.filter((_, j) => j !== i) } : f
                      )
                    }
                    className="shrink-0 text-slate-400 hover:text-rose-600"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                setForm((f) => (f ? { ...f, quickWins: [...f.quickWins, ""] } : f))
              }
              className="mt-2 text-sm font-medium text-sky-600 hover:text-sky-700"
            >
              + Add quick win
            </button>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">Related Playbooks</h2>
            <p className="mt-1 text-xs text-slate-500">
              Ref (e.g. 2.9) and description shown as &quot;ref Name Playbook — description&quot;
            </p>
            <div className="mt-3 space-y-4">
              {form.relatedPlaybooks.map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.ref}
                      onChange={(e) =>
                        setForm((f) => {
                          if (!f) return f;
                          const next = [...f.relatedPlaybooks];
                          next[i] = { ...next[i], ref: e.target.value };
                          return { ...f, relatedPlaybooks: next };
                        })
                      }
                      placeholder="Ref (e.g. 2.9)"
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) =>
                          f
                            ? {
                                ...f,
                                relatedPlaybooks: f.relatedPlaybooks.filter((_, j) => j !== i),
                              }
                            : f
                        )
                      }
                      className="text-slate-400 hover:text-rose-600"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                  <textarea
                    value={item.description}
                    onChange={(e) =>
                      setForm((f) => {
                        if (!f) return f;
                        const next = [...f.relatedPlaybooks];
                        next[i] = { ...next[i], description: e.target.value };
                        return { ...f, relatedPlaybooks: next };
                      })
                    }
                    rows={2}
                    placeholder="Why this playbook is related (e.g. Clear roles and expectations make hiring much easier...)"
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          relatedPlaybooks: [...f.relatedPlaybooks, { ref: "", description: "" }],
                        }
                      : f
                  )
                }
                className="text-sm font-medium text-sky-600 hover:text-sky-700"
              >
                + Add related playbook
              </button>
            </div>
          </section>
        </form>
      ) : (
        <PlaybookTabs
          content={content}
          showClientTab={true}
          showCoachesTab={true}
          basePath="/admin/playbooks"
        />
      )}
    </div>
  );
}
