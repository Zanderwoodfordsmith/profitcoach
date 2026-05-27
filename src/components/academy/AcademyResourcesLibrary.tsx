"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  Presentation,
  Trash2,
  Video,
} from "lucide-react";

import {
  ACADEMY_RESOURCE_AREA_LABELS,
  ACADEMY_RESOURCE_KIND_LABELS,
  filterResourcesCatalog,
  type AcademyResourceWithRelated,
  type AcademyResourceDocumentBundle,
  type AcademyResourceRow,
  type AcademyResourceSectionTree,
  type AcademyResourceTopicGroup,
  type AcademyResourcesCatalog,
} from "@/lib/academy/resources";
import type { AcademyResourceArea, AcademyResourceKind } from "@/lib/academy/parseResourcesMarkdown";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  catalog: AcademyResourcesCatalog;
  canManage?: boolean;
};

const KIND_ICONS: Record<AcademyResourceKind, typeof Link2> = {
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  video: Video,
  pdf: FileText,
  book: BookOpen,
  template: Presentation,
  link: Link2,
};

function flattenSections(sections: AcademyResourceSectionTree[]): AcademyResourceSectionTree[] {
  const out: AcademyResourceSectionTree[] = [];
  for (const section of sections) {
    out.push(section);
    out.push(...flattenSections(section.children));
  }
  return out;
}

/** Profit system markdown has a `# PROFIT SYSTEM` wrapper — skip it when the tab already says that. */
function displaySectionsForArea(
  sections: AcademyResourceSectionTree[],
  area: AcademyResourceArea
): AcademyResourceSectionTree[] {
  if (area !== "profit-system") return sections;

  return sections.flatMap((section) => {
    const isRedundantAreaRoot =
      section.id === "profit-system" ||
      (section.parent_id === null &&
        section.resources.length === 0 &&
        section.documentBundles.length === 0 &&
        section.topicGroups.length === 0);

    if (isRedundantAreaRoot && section.children.length > 0) {
      return section.children;
    }
    return [section];
  });
}

function sectionHasContent(section: AcademyResourceSectionTree): boolean {
  return (
    section.resources.length > 0 ||
    section.documentBundles.length > 0 ||
    section.children.some((child) => sectionHasContent(child))
  );
}

function topicKey(sectionId: string, topic: string | null): string {
  return `${sectionId}::${topic ?? ""}`;
}

function ResourceKindBadge({ kind }: { kind: AcademyResourceKind }) {
  const Icon = KIND_ICONS[kind];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      <Icon className="h-3 w-3" aria-hidden />
      {ACADEMY_RESOURCE_KIND_LABELS[kind]}
    </span>
  );
}

function ResourceRow({
  resource,
  nested = false,
  deepNested = false,
  showTopic = false,
  canManage = false,
  deleting = false,
  onDelete,
}: {
  resource: AcademyResourceRow;
  nested?: boolean;
  deepNested?: boolean;
  showTopic?: boolean;
  canManage?: boolean;
  deleting?: boolean;
  onDelete?: (resource: AcademyResourceRow) => void;
}) {
  const paddingClass = deepNested
    ? "border-l-2 border-slate-200/80 pl-16"
    : nested
      ? "border-l-2 border-slate-200/80 pl-12"
      : "py-3";

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
      <td className={`px-4 py-2.5 align-top ${paddingClass}`}>
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-start gap-1.5 text-sm text-sky-600 hover:text-sky-800 hover:underline"
        >
          <span>{resource.title}</span>
          <ExternalLink
            className="mt-0.5 h-3 w-3 shrink-0 opacity-40 transition group-hover:opacity-100"
            aria-hidden
          />
        </a>
      </td>
      {showTopic ? (
        <td className="hidden px-4 py-3 align-top text-sm text-slate-600 md:table-cell">
          {resource.topic ?? "—"}
        </td>
      ) : null}
      <td className="px-4 py-3 align-top">
        <div className="flex items-start justify-between gap-2">
          <ResourceKindBadge kind={resource.resource_kind} />
          {canManage && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(resource)}
              disabled={deleting}
              aria-label={`Delete ${resource.title}`}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function ResourcesTableHeader({ showTopic = false }: { showTopic?: boolean }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
      <tr>
        <th className={`px-4 py-2.5 font-medium ${showTopic ? "w-[44%]" : "w-[76%]"}`}>
          Resource
        </th>
        {showTopic ? (
          <th className="hidden w-[36%] px-4 py-2.5 font-medium md:table-cell">Topic</th>
        ) : null}
        <th className={`px-4 py-2.5 font-medium ${showTopic ? "w-[20%]" : "w-[24%]"}`}>Type</th>
      </tr>
    </thead>
  );
}

function ExpandableHeaderRow({
  title,
  depth,
  expanded,
  onToggle,
  count,
  variant,
  subtitle,
}: {
  title: string;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  count?: number;
  variant: "section" | "topic";
  subtitle?: string;
}) {
  const colSpan = 2;
  const isSection = variant === "section";
  const paddingLeft = isSection
    ? depth > 0
      ? "pl-8"
      : "pl-4"
    : depth > 0
      ? "pl-12"
      : "pl-8";

  return (
    <tr
      className={
        isSection
          ? "border-y border-slate-200 bg-slate-100/90"
          : "border-b border-slate-100 bg-slate-50/70"
      }
    >
      <th colSpan={colSpan} scope="rowgroup" className="p-0 text-left font-normal">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className={`flex w-full items-start gap-2 px-4 text-left transition hover:bg-slate-200/30 ${paddingLeft} ${
            isSection ? "py-3.5" : "border-l-2 border-slate-300/80 py-2.5"
          } ${
            isSection
              ? "text-sm font-bold tracking-tight text-slate-900"
              : "text-xs font-semibold text-slate-600"
          }`}
        >
          <ChevronDown
            className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${
              isSection ? "h-4 w-4" : "h-3.5 w-3.5"
            } ${expanded ? "rotate-0" : "-rotate-90"}`}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="block">{title}</span>
            {subtitle ? (
              <span className="mt-0.5 block text-[11px] font-normal normal-case tracking-normal text-slate-500">
                {subtitle}
              </span>
            ) : null}
          </span>
          {count != null ? (
            <span className="mt-0.5 shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {count}
            </span>
          ) : null}
        </button>
      </th>
    </tr>
  );
}

function DocumentBundleRows({
  bundle,
  expanded,
  onToggle,
  canManage,
  deletingId,
  onDelete,
}: {
  bundle: AcademyResourceDocumentBundle;
  expanded: boolean;
  onToggle: () => void;
  canManage?: boolean;
  deletingId?: string | null;
  onDelete?: (resource: AcademyResourceRow) => void;
}) {
  return (
    <>
      <ExpandableHeaderRow
        title={bundle.label}
        depth={0}
        expanded={expanded}
        onToggle={onToggle}
        count={bundle.resources.length}
        variant="topic"
        subtitle="One file · each link opens a different tab or sheet"
      />
      {expanded ? (
        <>
          <tr className="border-b border-slate-100 bg-white">
            <td colSpan={2} className="border-l-2 border-slate-200/80 px-4 py-2 pl-12 text-xs text-slate-500">
              <a
                href={bundle.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 hover:text-sky-800 hover:underline"
              >
                Open full document
              </a>
              <span className="mx-2 text-slate-300">·</span>
              <span>Links below open specific tabs</span>
            </td>
          </tr>
          {bundle.resources.map((resource) => {
            const withRelated = resource as AcademyResourceWithRelated;
            return (
              <Fragment key={resource.id}>
                <ResourceRow
                  resource={resource}
                  nested
                  canManage={canManage}
                  deleting={deletingId === resource.id}
                  onDelete={onDelete}
                />
                {withRelated.relatedResources?.map((related) => (
                  <ResourceRow
                    key={related.id}
                    resource={related}
                    nested
                    deepNested
                    canManage={canManage}
                    deleting={deletingId === related.id}
                    onDelete={onDelete}
                  />
                ))}
              </Fragment>
            );
          })}
        </>
      ) : null}
    </>
  );
}

function TopicGroupRows({
  group,
  depth,
  expanded,
  onToggle,
  canManage,
  deletingId,
  onDelete,
}: {
  group: AcademyResourceTopicGroup;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  canManage?: boolean;
  deletingId?: string | null;
  onDelete?: (resource: AcademyResourceRow) => void;
}) {
  if (!group.topic) {
    return group.resources.map((resource) => (
      <ResourceRow
        key={resource.id}
        resource={resource}
        nested={depth > 0}
        canManage={canManage}
        deleting={deletingId === resource.id}
        onDelete={onDelete}
      />
    ));
  }

  return (
    <>
      <ExpandableHeaderRow
        title={group.topic}
        depth={depth}
        expanded={expanded}
        onToggle={onToggle}
        count={group.resources.length}
        variant="topic"
      />
      {expanded
        ? group.resources.map((resource) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              nested
              canManage={canManage}
              deleting={deletingId === resource.id}
              onDelete={onDelete}
            />
          ))
        : null}
    </>
  );
}

function SectionGroupRows({
  section,
  depth,
  collapsedSections,
  collapsedTopics,
  collapsedBundles,
  onToggleSection,
  onToggleTopic,
  onToggleBundle,
  canManage,
  deletingId,
  onDelete,
}: {
  section: AcademyResourceSectionTree;
  depth: number;
  collapsedSections: Set<string>;
  collapsedTopics: Set<string>;
  collapsedBundles: Set<string>;
  onToggleSection: (sectionId: string) => void;
  onToggleTopic: (key: string) => void;
  onToggleBundle: (docId: string) => void;
  canManage?: boolean;
  deletingId?: string | null;
  onDelete?: (resource: AcademyResourceRow) => void;
}) {
  if (!sectionHasContent(section)) return null;

  const sectionExpanded = !collapsedSections.has(section.id);

  return (
    <>
      <ExpandableHeaderRow
        title={section.title}
        depth={depth}
        expanded={sectionExpanded}
        onToggle={() => onToggleSection(section.id)}
        count={section.resources.length > 0 ? section.resources.length : undefined}
        variant="section"
      />

      {sectionExpanded ? (
        <>
          {section.documentBundles.map((bundle) => (
            <DocumentBundleRows
              key={`${section.id}:doc:${bundle.docId}`}
              bundle={bundle}
              expanded={!collapsedBundles.has(bundle.docId)}
              onToggle={() => onToggleBundle(bundle.docId)}
              canManage={canManage}
              deletingId={deletingId}
              onDelete={onDelete}
            />
          ))}

          {section.topicGroups.map((group) => (
            <TopicGroupRows
              key={topicKey(section.id, group.topic)}
              group={group}
              depth={depth}
              expanded={!collapsedTopics.has(topicKey(section.id, group.topic))}
              onToggle={() => onToggleTopic(topicKey(section.id, group.topic))}
              canManage={canManage}
              deletingId={deletingId}
              onDelete={onDelete}
            />
          ))}

          {section.children.map((child) => (
            <SectionGroupRows
              key={child.id}
              section={child}
              depth={depth + 1}
              collapsedSections={collapsedSections}
              collapsedTopics={collapsedTopics}
              collapsedBundles={collapsedBundles}
              onToggleSection={onToggleSection}
              onToggleTopic={onToggleTopic}
              onToggleBundle={onToggleBundle}
              canManage={canManage}
              deletingId={deletingId}
              onDelete={onDelete}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

function ResourcesGroupedTable({
  sections,
  canManage,
  deletingId,
  onDelete,
}: {
  sections: AcademyResourceSectionTree[];
  canManage?: boolean;
  deletingId?: string | null;
  onDelete?: (resource: AcademyResourceRow) => void;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(() => new Set());
  const [collapsedBundles, setCollapsedBundles] = useState<Set<string>>(() => new Set());

  function toggleSection(sectionId: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function toggleTopic(key: string) {
    setCollapsedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleBundle(docId: string) {
    setCollapsedBundles((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full table-fixed text-left text-sm">
        <ResourcesTableHeader />
        <tbody>
          {sections.map((section) => (
            <SectionGroupRows
              key={section.id}
              section={section}
              depth={0}
              collapsedSections={collapsedSections}
              collapsedTopics={collapsedTopics}
              collapsedBundles={collapsedBundles}
              onToggleSection={toggleSection}
              onToggleTopic={toggleTopic}
              onToggleBundle={toggleBundle}
              canManage={canManage}
              deletingId={deletingId}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResourcesSearchTable({
  resources,
  canManage,
  deletingId,
  onDelete,
}: {
  resources: AcademyResourceRow[];
  canManage?: boolean;
  deletingId?: string | null;
  onDelete?: (resource: AcademyResourceRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full table-fixed text-left text-sm">
        <ResourcesTableHeader showTopic />
        <tbody>
          {resources.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                No resources match your search.
              </td>
            </tr>
          ) : (
            resources.map((resource) => (
              <ResourceRow
                key={resource.id}
                resource={resource}
                showTopic
                canManage={canManage}
                deleting={deletingId === resource.id}
                onDelete={onDelete}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AcademyResourcesLibrary({ catalog, canManage = false }: Props) {
  const router = useRouter();
  const [area, setArea] = useState<AcademyResourceArea>("coach-delivery");
  const [query, setQuery] = useState("");
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const displayCatalog = useMemo(
    () => filterResourcesCatalog(catalog, removedIds),
    [catalog, removedIds]
  );

  const sections = displayCatalog.byArea[area];
  const displaySections = useMemo(
    () => displaySectionsForArea(sections, area),
    [sections, area]
  );
  const flatSections = useMemo(() => flattenSections(displaySections), [displaySections]);

  const filteredResources = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return displayCatalog.resources.filter((resource) => {
      const section = displayCatalog.sections.find((s) => s.id === resource.section_id);
      const haystack = [
        resource.title,
        resource.topic ?? "",
        resource.url,
        section?.title ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [displayCatalog.resources, displayCatalog.sections, query]);

  async function handleDelete(resource: AcademyResourceRow) {
    if (!canManage) return;
    const confirmed = window.confirm(`Delete "${resource.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeleteError(null);
    setDeletingId(resource.id);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");

      const res = await fetch(`/api/admin/academy/resources/${encodeURIComponent(resource.id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to delete resource");

      setRemovedIds((prev) => new Set(prev).add(resource.id));
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete resource");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {deleteError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {deleteError}
        </p>
      ) : null}

      {canManage ? (
        <p className="text-sm text-slate-500">
          Admin mode: use the trash icon to remove duplicate or outdated resources.
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          {(Object.keys(ACADEMY_RESOURCE_AREA_LABELS) as AcademyResourceArea[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setArea(key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                area === key
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {ACADEMY_RESOURCE_AREA_LABELS[key]}
            </button>
          ))}
        </div>

        <label className="block w-full sm:max-w-xs">
          <span className="sr-only">Search resources</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search resources…"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-500/0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-500/20"
          />
        </label>
      </div>

      {filteredResources ? (
        <ResourcesSearchTable
          resources={filteredResources}
          canManage={canManage}
          deletingId={deletingId}
          onDelete={handleDelete}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <p className="text-sm text-slate-600">
            {flatSections.reduce((count, section) => count + section.resources.length, 0)} resources
            in {ACADEMY_RESOURCE_AREA_LABELS[area]}.
          </p>
          <div className="mt-6">
            <ResourcesGroupedTable
              sections={displaySections}
              canManage={canManage}
              deletingId={deletingId}
              onDelete={handleDelete}
            />
          </div>
        </div>
      )}
    </div>
  );
}
