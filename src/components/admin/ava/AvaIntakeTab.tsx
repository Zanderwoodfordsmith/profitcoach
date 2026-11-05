"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";

import { ALWAYS_READS, BLUEPRINT_GROUPS, type FieldSpec } from "@/lib/practiceKnowledge/blueprint";
import { BLUEPRINT_OUTPUTS } from "@/lib/practiceKnowledge/outputs";

import { CHIP } from "./AvaChips";
import { AvaGroup, AvaTable, useFolded, type Column } from "./AvaList";

/**
 * Admin → Ava → Intake: the questions Ava asks a coach about themselves (the
 * Blueprint's About You pages), read-only for now. "Read by" counts the same
 * writer contracts as the Boxes tab.
 */

const COLUMNS: Column[] = [
  { key: "answer", label: "Answer", width: "14rem" },
  { key: "ask", label: "What Ava asks" },
  { key: "example", label: "Example", width: "22%" },
  { key: "read", label: "Used to write", width: "18rem" },
];

const SHOW_READERS = 3;

function readersByField(): Map<string, string[]> {
  const readers = new Map<string, string[]>();
  const push = (path: string, title: string) => {
    const list = readers.get(path) ?? [];
    if (!list.includes(title)) list.push(title);
    readers.set(path, list);
  };
  for (const group of BLUEPRINT_GROUPS)
    for (const page of group.pages)
      for (const section of page.sections)
        if (section.source === "we_build") for (const path of section.uses?.fields ?? []) push(path, section.title);
  for (const output of BLUEPRINT_OUTPUTS) for (const path of output.uses?.fields ?? []) push(path, output.title);
  return readers;
}

function readBy(field: FieldSpec, readers: Map<string, string[]>): string[] {
  return ALWAYS_READS.includes(field.path) ? ["Everything we write"] : (readers.get(field.path) ?? []);
}

export function AvaIntakeTab() {
  const readers = useMemo(() => readersByField(), []);
  const folded = useFolded();
  const span = COLUMNS.length;

  const pages = BLUEPRINT_GROUPS.filter((g) => g.yours)
    .flatMap((g) => g.pages)
    .map((page) => ({
      page,
      sections: page.sections
        .filter((s) => s.source !== "we_build" && s.face !== "stored")
        .map((s) => ({ section: s, fields: (s.fields ?? []).filter((f) => !f.hidden) }))
        .filter((s) => s.fields.length),
    }))
    .filter((p) => p.sections.length);

  return (
    <div className="mx-auto w-full max-w-[80rem] px-5 pb-10 pt-5 md:px-8">
      <p className="max-w-3xl text-sm text-slate-600">
        The questions Ava asks a new coach to fill in their About You pages. Their answers are what we use to write their
        Blueprint, offer and posts. Read-only here: change a question in{" "}
        <Link href="/admin/blueprint" className="font-medium text-[#0c5290] hover:underline">
          the Blueprint
        </Link>
        .
      </p>

      <div className="mt-3">
        <AvaTable columns={COLUMNS}>
          {pages.map(({ page, sections }, pi) => (
            <AvaGroup
              key={page.slug}
              id={page.slug}
              label={page.title}
              hint={page.summary}
              count={sections.reduce((n, s) => n + s.fields.length, 0)}
              dot="bg-[#0c5290]"
              first={pi === 0}
              span={span}
              folded={folded}
            >
              {sections.map(({ section, fields }) => (
                <Fragment key={section.id}>
                  {/* No subheading when it would only repeat its one answer's name. */}
                  {fields.length === 1 && fields[0].label === section.title ? (
                    <tr className="border-t border-slate-200" aria-hidden>
                      <td colSpan={span} className="h-1.5" />
                    </tr>
                  ) : (
                    <tr className="border-t border-slate-200">
                      <td colSpan={span} className="pb-1 pl-[1.625rem] pt-3 text-xs font-semibold text-slate-500">
                        {section.title}
                      </td>
                    </tr>
                  )}
                  {fields.map((field) => {
                    const by = readBy(field, readers);
                    return (
                      <tr key={field.path} className="align-top transition hover:bg-white/70">
                        <td className="py-2 pl-[1.625rem] pr-4 font-medium text-slate-900">
                          {field.label}
                          {field.required ? (
                            <span className="ml-0.5 text-rose-500" title="Required">
                              *
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          {field.ask ? (
                            <p className="line-clamp-2 text-slate-600" title={field.ask}>
                              {field.ask}
                            </p>
                          ) : (
                            <span className="text-slate-400">Ava doesn&apos;t ask this one</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {field.example ? (
                            <p className="line-clamp-2 text-slate-500" title={field.example}>
                              {field.example}
                            </p>
                          ) : (
                            <span className="text-slate-300">None</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {by.length ? (
                            <span className="flex flex-wrap items-center gap-1" title={by.join(", ")}>
                              {by.slice(0, SHOW_READERS).map((title) => (
                                <span key={title} className={CHIP}>
                                  {title}
                                </span>
                              ))}
                              {by.length > SHOW_READERS ? (
                                <span className="text-xs font-medium text-slate-400">+{by.length - SHOW_READERS}</span>
                              ) : null}
                            </span>
                          ) : (
                            // Quiet, not red: setup answers like the phone number are used by the app, not a writer.
                            <span className="text-xs text-slate-400">Not used in writing</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </AvaGroup>
          ))}
        </AvaTable>
      </div>
    </div>
  );
}
