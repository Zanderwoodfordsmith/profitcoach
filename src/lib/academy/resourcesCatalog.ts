import type { AcademyResourceArea, AcademyResourceKind } from "./parseResourcesMarkdown";
import { normalizeMatchText } from "./normalizeMatchText";
import { compareTopicGroupOrder, getMultiTabBundleKey, multiTabBundleLabel, normalizeAcademyResourceUrl } from "./resourceUrl";

/**
 * Academy resource labels, types and catalog filtering, safe for the browser (database loading stays in resources.ts).
 */

export type AcademyResourceSectionRow = {
  id: string;
  area: AcademyResourceArea;
  parent_id: string | null;
  title: string;
  sort_order: number;
};

export type AcademyResourceRow = {
  id: string;
  section_id: string;
  topic: string | null;
  title: string;
  url: string;
  resource_kind: AcademyResourceKind;
  sort_order: number;
  source_line: number | null;
  created_at: string;
  updated_at: string;
};

/** Extra links that belong under a tab/anchor row in a document bundle (same markdown topic). */
export type AcademyResourceWithRelated = AcademyResourceRow & {
  relatedResources?: AcademyResourceRow[];
};

export type AcademyResourceTopicGroup = {
  topic: string | null;
  resources: AcademyResourceRow[];
};

export type AcademyResourceDocumentBundle = {
  docId: string;
  label: string;
  fileUrl: string;
  resources: AcademyResourceWithRelated[];
};

export type AcademyResourceSectionContent = {
  documentBundles: AcademyResourceDocumentBundle[];
  topicGroups: AcademyResourceTopicGroup[];
};

export type AcademyResourceSectionTree = AcademyResourceSectionRow & {
  children: AcademyResourceSectionTree[];
  topicGroups: AcademyResourceTopicGroup[];
  documentBundles: AcademyResourceDocumentBundle[];
  resources: AcademyResourceRow[];
};

export type AcademyResourcesCatalog = {
  sections: AcademyResourceSectionRow[];
  resources: AcademyResourceRow[];
  byArea: Record<AcademyResourceArea, AcademyResourceSectionTree[]>;
};

export function resourceIdentity(resource: AcademyResourceRow): string {
  return resource.id ?? normalizeAcademyResourceUrl(resource.url);
}

export function groupResourcesByTopic(resources: AcademyResourceRow[]): AcademyResourceTopicGroup[] {
  const groups = new Map<string, AcademyResourceRow[]>();
  for (const resource of resources) {
    const key = resource.topic?.trim() || "";
    const list = groups.get(key) ?? [];
    list.push(resource);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .map(([topic, list]) => ({
      topic: topic || null,
      resources: list.sort((x, y) => x.sort_order - y.sort_order || x.title.localeCompare(y.title)),
      firstSourceLine: Math.min(...list.map((r) => r.source_line ?? Number.MAX_SAFE_INTEGER)),
    }))
    .sort(compareTopicGroupOrder)
    .map(({ topic, resources }) => ({ topic, resources }));
}

export function resourceSortKey(resource: AcademyResourceRow): [number, number, string] {
  const session = (resource.topic ?? resource.title).match(/^session\s+(\d+)/i);
  if (session) {
    return [0, Number.parseInt(session[1]!, 10), resource.title];
  }
  return [1, resource.source_line ?? Number.MAX_SAFE_INTEGER, resource.title];
}

export function sortSectionResources(resources: AcademyResourceRow[]): AcademyResourceRow[] {
  return [...resources].sort((a, b) => {
    const [aKind, aOrder, aTitle] = resourceSortKey(a);
    const [bKind, bOrder, bTitle] = resourceSortKey(b);
    return aKind - bKind || aOrder - bOrder || aTitle.localeCompare(bTitle);
  });
}

/** Group deep links to the same Google Doc or Sheet; remaining resources stay in topic groups. */
export function buildSectionResourceContent(
  resources: AcademyResourceRow[]
): AcademyResourceSectionContent {
  const sorted = sortSectionResources(resources);
  const byBundleKey = new Map<string, AcademyResourceRow[]>();

  for (const resource of sorted) {
    const bundle = getMultiTabBundleKey(resource.url);
    if (!bundle) continue;
    const list = byBundleKey.get(bundle.bundleKey) ?? [];
    list.push(resource);
    byBundleKey.set(bundle.bundleKey, list);
  }

  const bundledResourceIds = new Set<string>();
  const documentBundles: AcademyResourceDocumentBundle[] = [];

  for (const [bundleKey, bundleResources] of byBundleKey) {
    if (bundleResources.length < 2) continue;
    for (const resource of bundleResources) {
      bundledResourceIds.add(resourceIdentity(resource));
    }
    const firstBundle = getMultiTabBundleKey(bundleResources[0]!.url);
    documentBundles.push({
      docId: bundleKey,
      label: multiTabBundleLabel(bundleKey, bundleResources.length),
      fileUrl: firstBundle?.fileUrl ?? bundleResources[0]!.url,
      resources: sortSectionResources(bundleResources),
    });
  }

  documentBundles.sort(
    (a, b) =>
      Math.min(...a.resources.map((r) => r.source_line ?? Number.MAX_SAFE_INTEGER)) -
      Math.min(...b.resources.map((r) => r.source_line ?? Number.MAX_SAFE_INTEGER))
  );

  const topicGroups = attachTopicGroupsToDocumentBundles(
    documentBundles,
    groupResourcesByTopic(
      sorted.filter((resource) => !bundledResourceIds.has(resourceIdentity(resource)))
    )
  );

  return { documentBundles, topicGroups };
}

/** Nest same-topic resources (e.g. coaching sheet files) under their doc-tab anchor in a bundle. */
export function attachTopicGroupsToDocumentBundles(
  documentBundles: AcademyResourceDocumentBundle[],
  topicGroups: AcademyResourceTopicGroup[]
): AcademyResourceTopicGroup[] {
  const remaining: AcademyResourceTopicGroup[] = [];

  for (const group of topicGroups) {
    if (!group.topic || group.resources.length === 0) {
      remaining.push(group);
      continue;
    }

    const topicNorm = normalizeMatchText(group.topic);
    let attached = false;

    for (const bundle of documentBundles) {
      const anchor = bundle.resources.find((resource) => {
        const titleNorm = normalizeMatchText(resource.title);
        const resourceTopicNorm = resource.topic ? normalizeMatchText(resource.topic) : "";
        return titleNorm === topicNorm || resourceTopicNorm === topicNorm;
      });

      if (!anchor) continue;

      anchor.relatedResources = sortSectionResources([
        ...(anchor.relatedResources ?? []),
        ...group.resources,
      ]);
      attached = true;
      break;
    }

    if (!attached) {
      remaining.push(group);
    }
  }

  return remaining;
}

export function buildSectionTree(
  sections: AcademyResourceSectionRow[],
  resources: AcademyResourceRow[],
  area: AcademyResourceArea
): AcademyResourceSectionTree[] {
  const byParent = new Map<string | null, AcademyResourceSectionRow[]>();
  for (const section of sections.filter((s) => s.area === area)) {
    const list = byParent.get(section.parent_id) ?? [];
    list.push(section);
    byParent.set(section.parent_id, list);
  }

  const resourcesBySection = new Map<string, AcademyResourceRow[]>();
  for (const resource of resources) {
    const list = resourcesBySection.get(resource.section_id) ?? [];
    list.push(resource);
    resourcesBySection.set(resource.section_id, list);
  }

  function walk(parentId: string | null): AcademyResourceSectionTree[] {
    const nodes = (byParent.get(parentId) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)
    );
    return nodes.map((section) => {
      const sectionResources = (resourcesBySection.get(section.id) ?? []).sort(
        (a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)
      );
      const content = buildSectionResourceContent(sectionResources);
      return {
        ...section,
        children: walk(section.id),
        topicGroups: content.topicGroups,
        documentBundles: content.documentBundles,
        resources: sectionResources,
      };
    });
  }

  return walk(null);
}

export function filterResourcesCatalog(
  catalog: AcademyResourcesCatalog,
  excludedIds: Set<string>
): AcademyResourcesCatalog {
  if (excludedIds.size === 0) return catalog;

  const resources = catalog.resources.filter((resource) => !excludedIds.has(resource.id));
  return {
    sections: catalog.sections,
    resources,
    byArea: {
      "coach-delivery": buildSectionTree(catalog.sections, resources, "coach-delivery"),
      "profit-system": buildSectionTree(catalog.sections, resources, "profit-system"),
    },
  };
}

export const ACADEMY_RESOURCE_AREA_LABELS: Record<AcademyResourceArea, string> = {
  "coach-delivery": "Coach delivery",
  "profit-system": "Profit system",
};

export const ACADEMY_RESOURCE_KIND_LABELS: Record<AcademyResourceKind, string> = {
  document: "Document",
  spreadsheet: "Spreadsheet",
  presentation: "Presentation",
  video: "Video",
  pdf: "PDF",
  book: "Book",
  template: "Template",
  link: "Link",
};
