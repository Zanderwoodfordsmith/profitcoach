export type GroupedTableItem<TSection, TRow> =
  | { type: "header"; section: TSection }
  | { type: "row"; section: TSection; row: TRow };

export function buildGroupedTableItems<TSection extends { key: string }, TRow>(
  sections: TSection[],
  collapsedKeys: Set<string>,
  rowsOf: (section: TSection) => TRow[]
): GroupedTableItem<TSection, TRow>[] {
  const items: GroupedTableItem<TSection, TRow>[] = [];
  for (const section of sections) {
    items.push({ type: "header", section });
    if (collapsedKeys.has(section.key)) continue;
    for (const row of rowsOf(section)) {
      items.push({ type: "row", section, row });
    }
  }
  return items;
}

export function toggleCollapsedGroupKey(
  collapsedKeys: Set<string>,
  key: string
): Set<string> {
  const next = new Set(collapsedKeys);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
