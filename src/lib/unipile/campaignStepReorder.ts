/** Move an item so it lands at the drop-gap index `to` in the pre-move list. */
export function moveSequenceItem<T>(items: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to > items.length
  ) {
    return items;
  }
  if (to === from + 1) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (!item) return items;
  const dest = from < to ? to - 1 : to;
  next.splice(dest, 0, item);
  return next;
}
