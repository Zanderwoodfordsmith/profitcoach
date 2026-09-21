/** Insert a copy of the step at `index` immediately below it. */
export function duplicateCampaignStep<T extends { id?: string; position: number }>(
  steps: readonly T[],
  index: number
): T[] {
  const source = steps[index];
  if (!source) return steps as T[];
  const { id: _id, ...rest } = source;
  const clone = structuredClone(rest) as T;
  const insertAt = index + 1;
  return [...steps.slice(0, insertAt), clone, ...steps.slice(insertAt)].map(
    (step, position) => ({ ...step, position })
  );
}
