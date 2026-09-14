export const SYSTEM_PIPELINE_COLUMN_IDS = [
  "leads",
  "replied",
  "interested",
  "booked",
  "follow_up",
  "closed",
] as const;

export type SystemPipelineColumnId = (typeof SYSTEM_PIPELINE_COLUMN_IDS)[number];

export type PipelineCardFields = {
  company: boolean;
  score: boolean;
  appointment: boolean;
  pill: boolean;
  actions: boolean;
};

export type PipelineSectionConfig = {
  id: string;
  label: string;
  hidden?: boolean;
  /** Built-in sections cannot be deleted, only hidden or renamed. */
  system?: boolean;
};

export type PipelineColumnConfig = {
  id: string;
  label: string;
  /** Completely off the board. */
  hidden?: boolean;
  /** Can collapse to a thin rail (Pool, Closed). */
  collapsible?: boolean;
  system?: boolean;
  sections: PipelineSectionConfig[];
};

export type PipelineLayout = {
  /** Bumped when a one-time layout migration should run on saved boards. */
  version?: number;
  avgDealAmount: number;
  collapsedIds: string[];
  cardFields: PipelineCardFields;
  columns: PipelineColumnConfig[];
};

export const PIPELINE_LAYOUT_VERSION = 2;

export const DEFAULT_AVG_DEAL_AMOUNT = 2000;

const SHOW_LEADS_LEGACY_KEY = "pc-pipeline-show-leads";
const AVG_DEAL_LEGACY_KEY = "pc-pipeline-avg-deal";

export const DEFAULT_CARD_FIELDS: PipelineCardFields = {
  company: true,
  score: true,
  appointment: true,
  pill: true,
  actions: true,
};

export function defaultPipelineLayout(): PipelineLayout {
  return {
    version: PIPELINE_LAYOUT_VERSION,
    avgDealAmount: DEFAULT_AVG_DEAL_AMOUNT,
    collapsedIds: ["leads", "closed"],
    cardFields: { ...DEFAULT_CARD_FIELDS },
    columns: [
      {
        id: "leads",
        label: "Pool",
        collapsible: true,
        hidden: true,
        system: true,
        sections: [
          { id: "not_started", label: "Not started", system: true },
          { id: "in_outreach", label: "In outreach", system: true },
        ],
      },
      {
        id: "replied",
        label: "Replied",
        system: true,
        sections: [],
      },
      {
        id: "interested",
        label: "Interested",
        system: true,
        sections: [
          { id: "lead_magnet", label: "Lead magnet", system: true },
          { id: "expressed", label: "Expressed", system: true },
        ],
      },
      {
        id: "booked",
        label: "Booked",
        system: true,
        sections: [
          { id: "rebook", label: "Rebook", system: true },
          { id: "upcoming", label: "Upcoming", system: true },
        ],
      },
      {
        id: "follow_up",
        label: "Follow-up",
        system: true,
        sections: [
          { id: "overdue", label: "Overdue", system: true },
          { id: "this_week", label: "This week", system: true },
          { id: "this_month", label: "This month", system: true },
          { id: "later", label: "Later", system: true },
          { id: "no_date", label: "No date", system: true },
        ],
      },
      {
        id: "closed",
        label: "Closed",
        collapsible: true,
        system: true,
        sections: [
          { id: "won", label: "Won", system: true },
          { id: "abandoned", label: "Abandoned", system: true },
          { id: "lost", label: "Lost", system: true },
        ],
      },
    ],
  };
}

const LAYOUT_KEY = "pc-pipeline-layout";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Old default was Won → Lost → Abandoned. Put Abandoned above Lost once. */
function moveAbandonedAboveLost(columns: PipelineColumnConfig[]) {
  const closed = columns.find((col) => col.id === "closed");
  if (!closed) return;
  const wonIndex = closed.sections.findIndex((section) => section.id === "won");
  const lostIndex = closed.sections.findIndex((section) => section.id === "lost");
  const abandonedIndex = closed.sections.findIndex(
    (section) => section.id === "abandoned"
  );
  if (
    wonIndex < 0 ||
    lostIndex < 0 ||
    abandonedIndex < 0 ||
    !(wonIndex < lostIndex && lostIndex < abandonedIndex)
  ) {
    return;
  }
  const [abandoned] = closed.sections.splice(abandonedIndex, 1);
  closed.sections.splice(lostIndex, 0, abandoned);
}

export function parsePipelineLayout(raw: unknown): PipelineLayout {
  const fallback = defaultPipelineLayout();
  if (!isRecord(raw)) return fallback;

  const avg =
    typeof raw.avgDealAmount === "number" && Number.isFinite(raw.avgDealAmount)
      ? Math.max(0, Math.round(raw.avgDealAmount))
      : fallback.avgDealAmount;

  const collapsedIds = Array.isArray(raw.collapsedIds)
    ? raw.collapsedIds.filter((id): id is string => typeof id === "string")
    : fallback.collapsedIds;

  const cardFields: PipelineCardFields = { ...DEFAULT_CARD_FIELDS };
  if (isRecord(raw.cardFields)) {
    for (const key of Object.keys(DEFAULT_CARD_FIELDS) as Array<
      keyof PipelineCardFields
    >) {
      if (typeof raw.cardFields[key] === "boolean") {
        cardFields[key] = raw.cardFields[key] as boolean;
      }
    }
    if (
      typeof raw.cardFields.date === "boolean" &&
      typeof raw.cardFields.appointment !== "boolean"
    ) {
      cardFields.appointment = raw.cardFields.date;
    }
  }

  const columnsIn = Array.isArray(raw.columns) ? raw.columns : null;
  const columns: PipelineColumnConfig[] = [];
  if (columnsIn) {
    for (const item of columnsIn) {
      if (!isRecord(item) || typeof item.id !== "string") continue;
      const sectionsRaw = Array.isArray(item.sections) ? item.sections : [];
      const sections: PipelineSectionConfig[] = [];
      for (const section of sectionsRaw) {
        if (!isRecord(section) || typeof section.id !== "string") continue;
        sections.push({
          id: section.id,
          label:
            typeof section.label === "string" && section.label.trim()
              ? section.label.trim()
              : section.id,
          hidden: section.hidden === true,
          system: section.system === true,
        });
      }
      columns.push({
        id: item.id,
        label:
          typeof item.label === "string" && item.label.trim()
            ? item.label.trim()
            : item.id,
        hidden: item.hidden === true,
        collapsible: item.collapsible === true,
        system: item.system === true,
        sections,
      });
    }
  }

  if (columns.length === 0) {
    return { ...fallback, avgDealAmount: avg, collapsedIds, cardFields };
  }

  const byId = new Map(columns.map((col) => [col.id, col]));
  for (const missing of fallback.columns) {
    const existing = byId.get(missing.id);
    if (existing) {
      if (missing.collapsible) existing.collapsible = true;
      if (missing.system) existing.system = true;
      if (existing.id === "leads" && existing.label === "Leads") {
        existing.label = missing.label;
      }
      const sectionIds = new Set(existing.sections.map((section) => section.id));
      for (const section of missing.sections) {
        if (!sectionIds.has(section.id)) existing.sections.push(section);
      }
      continue;
    }
    const fallbackIndex = fallback.columns.findIndex((col) => col.id === missing.id);
    let insertAt = columns.length;
    for (let i = fallbackIndex + 1; i < fallback.columns.length; i++) {
      const neighbor = columns.findIndex((col) => col.id === fallback.columns[i].id);
      if (neighbor >= 0) {
        insertAt = neighbor;
        break;
      }
    }
    columns.splice(insertAt, 0, missing);
    byId.set(missing.id, missing);
  }

  const leads = columns.find((col) => col.id === "leads");
  if (leads) leads.hidden = true;

  const storedVersion =
    typeof raw.version === "number" && Number.isFinite(raw.version)
      ? raw.version
      : 0;
  if (storedVersion < 2) {
    moveAbandonedAboveLost(columns);
  }

  return {
    version: PIPELINE_LAYOUT_VERSION,
    avgDealAmount: avg,
    collapsedIds,
    cardFields,
    columns,
  };
}

export function loadPipelineLayout(): PipelineLayout {
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      const layout = parsePipelineLayout(parsed);
      const storedVersion =
        isRecord(parsed) &&
        typeof parsed.version === "number" &&
        Number.isFinite(parsed.version)
          ? parsed.version
          : 0;
      if (storedVersion < PIPELINE_LAYOUT_VERSION) {
        savePipelineLayout(layout);
      }
      return layout;
    }
    const layout = defaultPipelineLayout();
    if (window.localStorage.getItem(SHOW_LEADS_LEGACY_KEY) === "1") {
      layout.collapsedIds = layout.collapsedIds.filter((id) => id !== "leads");
    }
    const storedAvg = window.localStorage.getItem(AVG_DEAL_LEGACY_KEY);
    if (storedAvg) {
      const n = Number(storedAvg.replace(/[^0-9.]/g, ""));
      if (Number.isFinite(n) && n >= 0) layout.avgDealAmount = Math.round(n);
    }
    return layout;
  } catch {
    return defaultPipelineLayout();
  }
}

export function savePipelineLayout(layout: PipelineLayout) {
  try {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // ignore
  }
}

export function newCustomColumnId(): string {
  return `col_${Date.now().toString(36)}`;
}

export function newCustomSectionId(): string {
  return `sec_${Date.now().toString(36)}`;
}

export function isSystemPipelineColumn(id: string): boolean {
  return (SYSTEM_PIPELINE_COLUMN_IDS as readonly string[]).includes(id);
}

export function visiblePipelineColumns(
  layout: PipelineLayout
): PipelineColumnConfig[] {
  return layout.columns.filter((col) => !col.hidden);
}

export function visibleSections(
  col: PipelineColumnConfig
): PipelineSectionConfig[] {
  return col.sections.filter((section) => !section.hidden);
}

export function columnLabel(layout: PipelineLayout, id: string): string {
  return layout.columns.find((c) => c.id === id)?.label ?? id;
}

function withColumns(
  layout: PipelineLayout,
  columns: PipelineColumnConfig[]
): PipelineLayout {
  return { ...layout, columns };
}

export function setCollapsed(
  layout: PipelineLayout,
  columnId: string,
  collapsed: boolean
): PipelineLayout {
  const collapsedIds = collapsed
    ? Array.from(new Set([...layout.collapsedIds, columnId]))
    : layout.collapsedIds.filter((id) => id !== columnId);
  return { ...layout, collapsedIds };
}

export function toggleCollapsed(
  layout: PipelineLayout,
  columnId: string
): PipelineLayout {
  return setCollapsed(
    layout,
    columnId,
    !layout.collapsedIds.includes(columnId)
  );
}

export function setAvgDealAmount(
  layout: PipelineLayout,
  amount: number
): PipelineLayout {
  const avgDealAmount =
    Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : layout.avgDealAmount;
  return { ...layout, avgDealAmount };
}

export function setCardField(
  layout: PipelineLayout,
  key: keyof PipelineCardFields,
  value: boolean
): PipelineLayout {
  return {
    ...layout,
    cardFields: { ...layout.cardFields, [key]: value },
  };
}

export function renameColumn(
  layout: PipelineLayout,
  columnId: string,
  label: string
): PipelineLayout {
  const next = label.trim() || columnLabel(layout, columnId);
  return withColumns(
    layout,
    layout.columns.map((col) => (col.id === columnId ? { ...col, label: next } : col))
  );
}

export function setColumnHidden(
  layout: PipelineLayout,
  columnId: string,
  hidden: boolean
): PipelineLayout {
  const visibleCount = layout.columns.filter((col) => !col.hidden).length;
  if (hidden && visibleCount <= 1) return layout;
  return withColumns(
    layout,
    layout.columns.map((col) =>
      col.id === columnId ? { ...col, hidden } : col
    )
  );
}

export function moveColumn(
  layout: PipelineLayout,
  columnId: string,
  direction: -1 | 1
): PipelineLayout {
  const index = layout.columns.findIndex((col) => col.id === columnId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= layout.columns.length) {
    return layout;
  }
  const columns = layout.columns.slice();
  const [item] = columns.splice(index, 1);
  columns.splice(nextIndex, 0, item);
  return withColumns(layout, columns);
}

export function addCustomColumn(
  layout: PipelineLayout,
  afterId?: string
): PipelineLayout {
  const column: PipelineColumnConfig = {
    id: newCustomColumnId(),
    label: "New column",
    system: false,
    sections: [],
  };
  const columns = layout.columns.slice();
  const after = afterId
    ? columns.findIndex((col) => col.id === afterId)
    : columns.findIndex((col) => col.id === "closed");
  const insertAt = after >= 0 ? after + (afterId ? 1 : 0) : columns.length;
  columns.splice(insertAt, 0, column);
  return withColumns(layout, columns);
}

export function deleteColumn(
  layout: PipelineLayout,
  columnId: string
): PipelineLayout {
  const col = layout.columns.find((item) => item.id === columnId);
  if (!col || col.system) return layout;
  const columns = layout.columns.filter((item) => item.id !== columnId);
  if (columns.filter((item) => !item.hidden).length === 0) return layout;
  return {
    ...layout,
    columns,
    collapsedIds: layout.collapsedIds.filter((id) => id !== columnId),
  };
}

export function renameSection(
  layout: PipelineLayout,
  columnId: string,
  sectionId: string,
  label: string
): PipelineLayout {
  const next = label.trim();
  return withColumns(
    layout,
    layout.columns.map((col) => {
      if (col.id !== columnId) return col;
      return {
        ...col,
        sections: col.sections.map((section) =>
          section.id === sectionId
            ? { ...section, label: next || section.label }
            : section
        ),
      };
    })
  );
}

export function setSectionHidden(
  layout: PipelineLayout,
  columnId: string,
  sectionId: string,
  hidden: boolean
): PipelineLayout {
  return withColumns(
    layout,
    layout.columns.map((col) => {
      if (col.id !== columnId) return col;
      return {
        ...col,
        sections: col.sections.map((section) =>
          section.id === sectionId ? { ...section, hidden } : section
        ),
      };
    })
  );
}

export function addCustomSection(
  layout: PipelineLayout,
  columnId: string
): PipelineLayout {
  return withColumns(
    layout,
    layout.columns.map((col) => {
      if (col.id !== columnId) return col;
      return {
        ...col,
        sections: [
          ...col.sections,
          {
            id: newCustomSectionId(),
            label: "New section",
            system: false,
          },
        ],
      };
    })
  );
}

export function deleteSection(
  layout: PipelineLayout,
  columnId: string,
  sectionId: string
): PipelineLayout {
  return withColumns(
    layout,
    layout.columns.map((col) => {
      if (col.id !== columnId) return col;
      const target = col.sections.find((section) => section.id === sectionId);
      if (!target) return col;
      if (target.system) {
        return {
          ...col,
          sections: col.sections.map((section) =>
            section.id === sectionId ? { ...section, hidden: true } : section
          ),
        };
      }
      return {
        ...col,
        sections: col.sections.filter((section) => section.id !== sectionId),
      };
    })
  );
}

export function moveSection(
  layout: PipelineLayout,
  columnId: string,
  sectionId: string,
  direction: -1 | 1
): PipelineLayout {
  return withColumns(
    layout,
    layout.columns.map((col) => {
      if (col.id !== columnId) return col;
      const index = col.sections.findIndex((section) => section.id === sectionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= col.sections.length) {
        return col;
      }
      const sections = col.sections.slice();
      const [item] = sections.splice(index, 1);
      sections.splice(nextIndex, 0, item);
      return { ...col, sections };
    })
  );
}

export const CARD_FIELD_OPTIONS: Array<{
  key: keyof PipelineCardFields;
  label: string;
}> = [
  { key: "company", label: "Company" },
  { key: "score", label: "BOSS score" },
  { key: "pill", label: "Status pill" },
  { key: "actions", label: "Quick actions" },
  { key: "appointment", label: "Appointment" },
];
