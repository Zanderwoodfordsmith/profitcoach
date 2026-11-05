"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ExternalLink, Loader2 } from "lucide-react";

import { MetaDropdown } from "@/components/admin/roadmap/roadmapUi";
import type { AvaCapabilityRecord, AvaCatalog, SkillAccess } from "@/lib/agent/avaCatalog";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

import { CHIP, ChipLink, HINT } from "./AvaChips";
import { AvaDocument } from "./AvaDocument";
import { AvaGroup, AvaSplit, AvaTable, ROW, useFolded, type Column } from "./AvaList";

/**
 * Admin → Ava → Skills: one table of Ava's skills with who can use each, and
 * the Create hub skills (read-only here). A row opens the skill beside the list.
 */

const ACCESS: { value: SkillAccess; label: string; hint: string; pill: string; coach: boolean }[] = [
  { value: "everyone", label: "Everyone", hint: "All coaches", pill: "bg-emerald-50 text-emerald-800 ring-emerald-200", coach: true },
  {
    value: "agent",
    label: "Coaches with Ava on",
    hint: "Only those with Ava switched on",
    pill: "bg-sky-50 text-sky-800 ring-sky-200",
    coach: true,
  },
  { value: "admin", label: "Admin only", hint: "You and BCA staff", pill: "bg-slate-100 text-slate-700 ring-slate-200", coach: false },
  { value: "off", label: "Off", hint: "Nobody. Ava can't open it", pill: "bg-rose-50 text-rose-700 ring-rose-200", coach: false },
];

const COLUMNS: Column[] = [
  { key: "skill", label: "Skill", width: "15rem" },
  { key: "does", label: "What it does" },
  { key: "opens", label: "Opens", width: "7rem" },
  { key: "who", label: "Who can use it", width: "13rem" },
];

function accessOf(value: SkillAccess) {
  return ACCESS.find((a) => a.value === value) ?? ACCESS[0];
}

function knowledgeHref(id: string): string {
  return `/admin/ava?tab=knowledge&open=${encodeURIComponent(id)}`;
}

function opensOf(cap: AvaCapabilityRecord): string[] {
  return [...new Set([...cap.references, ...cap.practiceSkillIds])];
}

function filesWord(n: number): string {
  return n ? `${n} ${n === 1 ? "file" : "files"}` : "None";
}

function AccessPill({ value }: { value: SkillAccess }) {
  const a = accessOf(value);
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${a.pill}`}>
      {a.label}
    </span>
  );
}

/** The pill and its menu; saves straight away. */
function AccessDropdown({ cap, onCatalog }: { cap: AvaCapabilityRecord; onCatalog: (catalog: AvaCatalog) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(access: SkillAccess) {
    if (access === cap.access) return;
    setSaving(true);
    setError(null);
    try {
      const headers = await getCoachAuthHeaders(null);
      if (!headers) return;
      delete headers["x-impersonate-coach-id"];
      const res = await fetch("/api/admin/ava/skills", {
        method: "PUT",
        headers,
        body: JSON.stringify({ skill: cap.id, access }),
      });
      const body = (await res.json().catch(() => null)) as { catalog?: AvaCatalog; error?: string } | null;
      if (!res.ok || !body?.catalog) {
        setError(body?.error ?? "Save failed.");
        return;
      }
      onCatalog(body.catalog);
    } finally {
      setSaving(false);
    }
  }

  const a = accessOf(cap.access);
  return (
    <span className="inline-flex flex-col items-start" onClick={(e) => e.stopPropagation()}>
      <span className="inline-flex items-center gap-1.5">
        <MetaDropdown
          bare
          alignRight
          display={
            <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${a.pill}`}>
              {a.label}
              <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
            </span>
          }
          options={ACCESS.filter((o) => cap.coachAllowed || !o.coach).map((o) => ({
            key: o.value,
            selected: cap.access === o.value,
            onSelect: () => void change(o.value),
            node: (
              <span className="flex flex-col">
                <span className="flex items-center gap-2">
                  <AccessPill value={o.value} />
                  {o.value === cap.defaultAccess ? <span className="text-xs text-slate-400">default</span> : null}
                </span>
                <span className="mt-0.5 pl-0.5 text-xs text-slate-500">{o.hint}</span>
              </span>
            ),
          }))}
        />
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden /> : null}
        {!saving && cap.access !== cap.defaultAccess ? (
          <span className="text-[11px] text-slate-400" title={`The default is ${accessOf(cap.defaultAccess).label.toLowerCase()}.`}>
            changed
          </span>
        ) : null}
      </span>
      {error ? <span className="mt-0.5 text-xs text-rose-700">{error}</span> : null}
    </span>
  );
}

export function AvaSkillsTab({
  catalog,
  onOpen,
  onCatalog,
}: {
  catalog: AvaCatalog;
  onOpen: (skillId: string) => void;
  onCatalog: (catalog: AvaCatalog) => void;
}) {
  const folded = useFolded();
  const span = COLUMNS.length;
  const groups = catalog.groups
    .map((group) => ({
      group,
      caps: group.capabilityIds
        .map((id) => catalog.capabilities.find((c) => c.id === id))
        .filter((c): c is AvaCapabilityRecord => Boolean(c)),
    }))
    .filter((g) => g.caps.length);

  return (
    <div className="mx-auto w-full max-w-[80rem] px-5 pb-10 pt-5 md:px-8">
      <p className="text-sm text-slate-600">{HINT}</p>

      <div className="mt-3">
        <AvaTable columns={COLUMNS}>
          {groups.map(({ group, caps }, gi) => (
            <AvaGroup
              key={group.id}
              id={group.id}
              label={group.title}
              hint={group.hint}
              count={caps.length}
              dot="bg-[#0c5290]"
              first={gi === 0}
              span={span}
              folded={folded}
            >
              {caps.map((cap) => (
                <tr key={cap.id} onClick={() => onOpen(cap.id)} className={ROW}>
                  <td className="py-2.5 pl-[1.625rem] pr-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(cap.id);
                      }}
                      title={cap.id}
                      className={`block w-full truncate text-left font-medium hover:text-[#0c5290] ${cap.access === "off" ? "text-slate-400" : "text-slate-900"}`}
                    >
                      {cap.title}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="truncate text-slate-600" title={cap.summary}>
                      {cap.summary}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 tabular-nums">{filesWord(opensOf(cap).length)}</td>
                  <td className="px-3 py-2">
                    <AccessDropdown cap={cap} onCatalog={onCatalog} />
                  </td>
                </tr>
              ))}
            </AvaGroup>
          ))}

          <AvaGroup
            id="create-hub"
            label="Create hub skills"
            hint="The coach's AI workspace, not Ava. Edit them in Brand, Core brain."
            count={catalog.createHub.length}
            dot="bg-slate-400"
            span={span}
            folded={folded}
          >
            {catalog.createHub.map((skill) => (
              <tr key={skill.id} className="border-t border-slate-200 align-middle transition hover:bg-white/70">
                <td className="py-2.5 pl-[1.625rem] pr-4">
                  <span className="block truncate font-medium text-slate-900" title={skill.id}>
                    {skill.label}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <p className="truncate text-slate-500" title={skill.files.map((f) => f.label).join(", ")}>
                    Reads {skill.files.map((f) => f.label).join(", ")}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-slate-600 tabular-nums">{filesWord(skill.files.length)}</td>
                <td className="px-3 py-2.5">
                  <Link href={skill.href} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0c5290] hover:underline">
                    Open in Core brain
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
          </AvaGroup>
        </AvaTable>
      </div>
    </div>
  );
}

/** One skill open, with the rest in the sidebar. */
export function AvaSkillPage({
  catalog,
  openId,
  onOpen,
  onBack,
  onCatalog,
}: {
  catalog: AvaCatalog;
  openId: string;
  onOpen: (skillId: string) => void;
  onBack: () => void;
  onCatalog: (catalog: AvaCatalog) => void;
}) {
  const cap = catalog.capabilities.find((c) => c.id === openId || c.fileId === openId) ?? null;
  const file = cap ? catalog.files.find((f) => f.id === cap.fileId) : undefined;
  // File labels win over the Create hub's short names (later entries in a Map win).
  const labels = new Map<string, string>([
    ...catalog.createHub.flatMap((s) => s.files.filter((f) => f.id).map((f) => [f.id as string, f.label] as [string, string])),
    ...catalog.files.map((f) => [f.id, f.label] as [string, string]),
  ]);
  const known = new Set(catalog.knowledge.map((k) => k.id));
  const opens = cap ? opensOf(cap) : [];

  const sections = catalog.groups
    .map((group) => ({
      id: group.id,
      label: group.title,
      items: group.capabilityIds
        .map((id) => catalog.capabilities.find((c) => c.id === id))
        .filter((c): c is AvaCapabilityRecord => Boolean(c))
        .map((c) => ({
          id: c.id,
          label: c.title,
          current: c.id === cap?.id,
          note: c.access === "off" ? "off" : undefined,
          onOpen: () => onOpen(c.id),
        })),
    }))
    .filter((s) => s.items.length);

  return (
    <AvaSplit sections={sections} back={{ label: "All skills", onClick: onBack }}>
      {cap ? (
        <div className="mx-auto mt-4 w-full max-w-[54rem] space-y-2.5 px-5 md:px-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 shrink-0 text-xs font-semibold text-slate-400">Who can use it</span>
            <AccessDropdown cap={cap} onCatalog={onCatalog} />
            {!cap.coachAllowed ? <span className="text-xs text-slate-400">Written for admin mode, so never for coaches.</span> : null}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <span className="w-24 shrink-0 pt-0.5 text-xs font-semibold text-slate-400">Opens</span>
            <span className="flex min-w-0 flex-1 flex-wrap gap-1">
              {opens.length ? (
                opens.map((id) =>
                  known.has(id) ? (
                    <ChipLink key={id} href={knowledgeHref(id)}>
                      {labels.get(id) ?? id}
                    </ChipLink>
                  ) : (
                    <span key={id} className={CHIP}>
                      {labels.get(id) ?? id}
                    </span>
                  )
                )
              ) : (
                <span className="text-xs text-slate-500">No files. It works from its tools and the coach&apos;s own data.</span>
              )}
            </span>
          </div>
        </div>
      ) : null}
      {cap && file ? (
        <AvaDocument
          file={file}
          title={cap.title}
          summary={cap.summary}
          meta={`${cap.modes.join(" · ")} · ${cap.id}`}
          onCatalog={onCatalog}
        />
      ) : (
        <p className="mx-auto max-w-[54rem] px-5 py-8 text-sm text-slate-600 md:px-10">That skill is not in the list.</p>
      )}
    </AvaSplit>
  );
}
