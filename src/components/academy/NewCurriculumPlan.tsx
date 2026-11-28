"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plus, StickyNote, Trash2, X } from "lucide-react";

import { defaultNewPlan, newPlanId, type NewPlanDoc } from "@/lib/academy/newCurriculumPlan";
import { supabaseClient } from "@/lib/supabaseClient";

type SaveState = "saved" | "saving" | "error";

/** Text that reads as plain text and edits in place. Wraps like a paragraph. */
function EditText({
  value,
  onChange,
  placeholder,
  className = "",
  label,
  dataNote,
}: {
  dataNote?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  label: string;
}) {
  return (
    <textarea
      rows={1}
      value={value}
      aria-label={label}
      data-note={dataNote}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      className={`field-sizing-content block w-full resize-none rounded-md bg-transparent px-1 -mx-1 py-0.5 outline-none placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-sky-300 ${className}`}
    />
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded p-1 text-slate-400 disabled:opacity-30 ${danger ? "hover:bg-rose-50 hover:text-rose-600" : "hover:bg-slate-100 hover:text-slate-700"}`}
    >
      {children}
    </button>
  );
}

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}

/** The proposed 3×3 curriculum. Every word can be edited; it saves as you go. */
export function NewCurriculumPlan({ initialPlan }: { initialPlan: NewPlanDoc }) {
  const [doc, setDoc] = useState(initialPlan);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(doc);
  // Lessons whose empty note line was opened. Kept open so rows never shift mid-click.
  const [noteOpen, setNoteOpen] = useState<Set<string>>(() => new Set());

  const persist = useCallback(async () => {
    setSaveState("saving");
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in again to save.");
      const res = await fetch("/api/admin/academy/curriculum-new-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan: latest.current }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "Could not save.");
      }
      setSaveState("saved");
      setSaveError(null);
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "Could not save.");
    }
  }, []);

  const edit = useCallback(
    (fn: (d: NewPlanDoc) => void) => {
      setDoc((prev) => {
        const next = structuredClone(prev);
        fn(next);
        latest.current = next;
        return next;
      });
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void persist(), 700);
    },
    [persist],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const sectionChoices = doc.stages.flatMap((stage, si) =>
    stage.sections.map((section, ci) => ({ si, ci, label: `${stage.title} › ${section.title || "Untitled"}` })),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span
          className={
            saveState === "error" ? "font-medium text-rose-700" : "text-slate-500"
          }
        >
          {saveState === "saving" ? "Saving…" : saveState === "error" ? saveError : "All changes saved"}
        </span>
        {saveState === "error" ? (
          <button type="button" onClick={() => void persist()} className="font-medium text-sky-700 hover:underline">
            Try again
          </button>
        ) : null}
        <span className="flex-1" />
        <span className="text-slate-400">Click any text to change it. Hover a lesson to move or delete it.</span>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("Throw away your changes and go back to the first version?")) return;
            edit((d) => Object.assign(d, defaultNewPlan()));
          }}
          className="font-medium text-slate-500 hover:text-slate-800"
        >
          Start again
        </button>
      </div>

      <div className="rounded-lg bg-white px-5 py-4 ring-1 ring-inset ring-slate-200">
        <EditText
          label="The promise"
          value={doc.spine}
          placeholder="What the curriculum promises"
          onChange={(v) => edit((d) => void (d.spine = v))}
          className="text-base font-semibold text-slate-900"
        />
        <EditText
          label="The rule"
          value={doc.rule}
          placeholder="The rule every lesson follows"
          onChange={(v) => edit((d) => void (d.rule = v))}
          className="mt-1 text-sm leading-relaxed text-slate-600"
        />
        <p className="mt-3 text-sm font-medium text-slate-500">
          {doc.stages.map((stage) => stage.sections.map((s) => s.title || "Untitled").join(" → ")).join("  ·  ")}
        </p>
      </div>

      {doc.stages.map((stage, si) => (
        <section key={stage.id} className="flex flex-col gap-3">
          <div className="max-w-xl">
            <EditText
              label="Stage name"
              value={stage.title}
              onChange={(v) => edit((d) => void (d.stages[si].title = v))}
              className="text-lg font-medium tracking-[-0.01em] text-slate-950"
            />
            <EditText
              label="Stage headline"
              value={stage.headline}
              placeholder="What this stage gets the coach"
              onChange={(v) => edit((d) => void (d.stages[si].headline = v))}
              className="text-sm text-slate-600"
            />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {stage.sections.map((section, ci) => (
              <div key={section.id} className="group/section flex flex-col gap-3 rounded-lg bg-white p-4 ring-1 ring-inset ring-slate-200">
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium tabular-nums text-slate-400">{ci + 1}</span>
                    <span className="flex-1" />
                    <div className="flex items-center opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
                      <IconButton label="Move section left" disabled={ci === 0} onClick={() => edit((d) => move(d.stages[si].sections, ci, ci - 1))}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label="Move section right"
                        disabled={ci === stage.sections.length - 1}
                        onClick={() => edit((d) => move(d.stages[si].sections, ci, ci + 1))}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </IconButton>
                      <select
                        aria-label="Move section to another stage"
                        value=""
                        onChange={(e) => {
                          const to = Number(e.target.value);
                          edit((d) => {
                            const [moved] = d.stages[si].sections.splice(ci, 1);
                            d.stages[to].sections.push(moved);
                          });
                        }}
                        className="max-w-[7rem] rounded bg-transparent px-1 py-0.5 text-xs text-slate-500 hover:bg-slate-100"
                      >
                        <option value="" disabled>
                          Move to…
                        </option>
                        {doc.stages.map((s, i) =>
                          i === si ? null : (
                            <option key={s.id} value={i}>
                              {s.title}
                            </option>
                          ),
                        )}
                      </select>
                      <IconButton
                        label="Delete section"
                        danger
                        onClick={() => {
                          if (!window.confirm(`Delete "${section.title}" and its ${section.lessons.length} lessons?`)) return;
                          edit((d) => void d.stages[si].sections.splice(ci, 1));
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>
                  <EditText
                    label="Section name"
                    value={section.title}
                    placeholder="Section name"
                    onChange={(v) => edit((d) => void (d.stages[si].sections[ci].title = v))}
                    className="text-base font-semibold text-slate-900"
                  />
                  <EditText
                    label="Section outcome"
                    value={section.outcome}
                    placeholder="What the coach can do after this section"
                    onChange={(v) => edit((d) => void (d.stages[si].sections[ci].outcome = v))}
                    className="mt-1 text-sm leading-relaxed text-slate-600"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {section.tabs.map((tab, ti) => (
                    <span key={`${tab}-${ti}`} className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 py-0.5 pl-2 pr-1 text-xs font-medium text-sky-700">
                      {tab}
                      <button
                        type="button"
                        aria-label={`Remove ${tab}`}
                        onClick={() => edit((d) => void d.stages[si].sections[ci].tabs.splice(ti, 1))}
                        className="rounded-full p-0.5 text-sky-400 hover:bg-sky-100 hover:text-sky-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    aria-label="Add an app tab"
                    placeholder="+ app tab"
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const v = e.currentTarget.value.trim();
                      if (!v) return;
                      edit((d) => void d.stages[si].sections[ci].tabs.push(v));
                      e.currentTarget.value = "";
                    }}
                    className="w-20 rounded-full bg-transparent px-2 py-0.5 text-xs text-slate-500 outline-none placeholder:text-slate-300 focus:w-32 focus:bg-white focus:ring-1 focus:ring-sky-300"
                  />
                </div>

                <ol className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
                  {section.lessons.map((lesson, li) => (
                    <li key={lesson.id} className="group/lesson relative text-sm">
                      <div>
                        <div className="min-w-0">
                          <EditText
                            label="Lesson name"
                            value={lesson.title}
                            placeholder="Lesson name"
                            onChange={(v) => edit((d) => void (d.stages[si].sections[ci].lessons[li].title = v))}
                            className="font-medium text-slate-800"
                          />
                          {lesson.note || noteOpen.has(lesson.id) ? (
                          <div>
                            <EditText
                              label="Lesson note"
                              dataNote={lesson.id}
                              value={lesson.note ?? ""}
                              placeholder="Add a note"
                              onChange={(v) =>
                                edit((d) => {
                                  const l = d.stages[si].sections[ci].lessons[li];
                                  if (v) l.note = v;
                                  else delete l.note;
                                })
                              }
                              className="text-xs text-slate-500"
                            />
                          </div>
                        ) : null}
                        </div>
                        <div className="pointer-events-none absolute right-0 top-0 z-10 flex items-center rounded-md bg-white opacity-0 shadow-sm ring-1 ring-slate-200 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover/lesson:pointer-events-auto group-hover/lesson:opacity-100">
                          <IconButton label="Move up" disabled={li === 0} onClick={() => edit((d) => move(d.stages[si].sections[ci].lessons, li, li - 1))}>
                            <ChevronUp className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton
                            label="Move down"
                            disabled={li === section.lessons.length - 1}
                            onClick={() => edit((d) => move(d.stages[si].sections[ci].lessons, li, li + 1))}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </IconButton>
                          <select
                            aria-label="Move lesson to another section"
                            value=""
                            onChange={(e) => {
                              const [toSi, toCi] = e.target.value.split(":").map(Number);
                              edit((d) => {
                                const [moved] = d.stages[si].sections[ci].lessons.splice(li, 1);
                                d.stages[toSi].sections[toCi].lessons.push(moved);
                              });
                            }}
                            className="w-6 appearance-none rounded bg-transparent text-center text-xs text-slate-400 hover:bg-slate-100"
                            title="Move to another section"
                          >
                            <option value="" disabled>
                              ⇄
                            </option>
                            {sectionChoices.map((c) =>
                              c.si === si && c.ci === ci ? null : (
                                <option key={`${c.si}:${c.ci}`} value={`${c.si}:${c.ci}`}>
                                  {c.label}
                                </option>
                              ),
                            )}
                          </select>
                          <IconButton
                            label="Add a note"
                            onClick={() => {
                              setNoteOpen((prev) => new Set(prev).add(lesson.id));
                              requestAnimationFrame(() =>
                                document.querySelector<HTMLTextAreaElement>(`[data-note="${lesson.id}"]`)?.focus(),
                              );
                            }}
                          >
                            <StickyNote className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton
                            label="Add a sub-lesson"
                            onClick={() =>
                              edit((d) => {
                                const l = d.stages[si].sections[ci].lessons[li];
                                l.children = [...(l.children ?? []), ""];
                              })
                            }
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton label="Delete lesson" danger onClick={() => edit((d) => void d.stages[si].sections[ci].lessons.splice(li, 1))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                        </div>
                      </div>
                      {lesson.children?.length ? (
                        <ul className="mt-0.5 flex flex-col border-l border-slate-200 pl-3">
                          {lesson.children.map((child, ki) => (
                            <li key={ki} className="group/child relative">
                              <div className="min-w-0">
                                <EditText
                                  label="Sub-lesson name"
                                  value={child}
                                  placeholder="Sub-lesson name"
                                  onChange={(v) => edit((d) => void (d.stages[si].sections[ci].lessons[li].children![ki] = v))}
                                  className="text-slate-600"
                                />
                              </div>
                              <div className="pointer-events-none absolute right-0 top-0 z-10 flex items-center rounded-md bg-white opacity-0 shadow-sm ring-1 ring-slate-200 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover/child:pointer-events-auto group-hover/child:opacity-100">
                                <IconButton
                                  label="Move up"
                                  disabled={ki === 0}
                                  onClick={() => edit((d) => move(d.stages[si].sections[ci].lessons[li].children!, ki, ki - 1))}
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </IconButton>
                                <IconButton
                                  label="Move down"
                                  disabled={ki === lesson.children!.length - 1}
                                  onClick={() => edit((d) => move(d.stages[si].sections[ci].lessons[li].children!, ki, ki + 1))}
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </IconButton>
                                <IconButton
                                  label="Delete sub-lesson"
                                  danger
                                  onClick={() =>
                                    edit((d) => {
                                      const l = d.stages[si].sections[ci].lessons[li];
                                      l.children!.splice(ki, 1);
                                      if (!l.children!.length) delete l.children;
                                    })
                                  }
                                >
                                  <X className="h-3.5 w-3.5" />
                                </IconButton>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  onClick={() => edit((d) => void d.stages[si].sections[ci].lessons.push({ id: newPlanId(), title: "" }))}
                  className="mt-auto inline-flex items-center gap-1 self-start text-xs font-medium text-slate-400 hover:text-sky-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Lesson
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                edit((d) => void d.stages[si].sections.push({ id: newPlanId(), title: "", outcome: "", tabs: [], lessons: [] }))
              }
              className="inline-flex min-h-24 items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-400 hover:border-sky-300 hover:text-sky-700"
            >
              <Plus className="h-4 w-4" />
              Section
            </button>
          </div>
        </section>
      ))}

      <div className="rounded-lg bg-white px-5 py-4 ring-1 ring-inset ring-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">Still to decide</h3>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-600">
          {doc.openQuestions.map((q, qi) => (
            <li key={qi} className="group/q flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              <div className="min-w-0 flex-1">
                <EditText label="Question" value={q} onChange={(v) => edit((d) => void (d.openQuestions[qi] = v))} />
              </div>
              <div className="opacity-0 transition-opacity group-hover/q:opacity-100 focus-within:opacity-100">
                <IconButton label="Delete question" danger onClick={() => edit((d) => void d.openQuestions.splice(qi, 1))}>
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => edit((d) => void d.openQuestions.push(""))}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-sky-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Question
        </button>
      </div>
    </div>
  );
}
