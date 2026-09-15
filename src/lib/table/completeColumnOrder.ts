/** Insert missing keys at their default relative position instead of appending. */
export function completeColumnOrder<TKey extends string>(
  fromSource: readonly TKey[],
  defaultOrder: readonly TKey[]
): TKey[] {
  const seen = new Set<TKey>();
  const columnOrder: TKey[] = [];
  for (const key of fromSource) {
    if (seen.has(key)) continue;
    seen.add(key);
    columnOrder.push(key);
  }
  for (const key of defaultOrder) {
    if (seen.has(key)) continue;
    const defaultIndex = defaultOrder.indexOf(key);
    let insertAt = 0;
    for (let i = defaultIndex - 1; i >= 0; i -= 1) {
      const prev = defaultOrder[i];
      const pos = columnOrder.indexOf(prev);
      if (pos >= 0) {
        insertAt = pos + 1;
        break;
      }
    }
    columnOrder.splice(insertAt, 0, key);
    seen.add(key);
  }
  return columnOrder;
}
