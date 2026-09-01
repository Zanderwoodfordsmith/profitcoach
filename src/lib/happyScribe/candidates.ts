/** Convert academy duration labels to seconds for queue totals and billing estimates. */
export function durationLabelToSeconds(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const text = value.trim().toLowerCase();
  let seconds = 0;
  const hours = text.match(/(\d+(?:\.\d+)?)\s*h/);
  const minutes = text.match(/(\d+(?:\.\d+)?)\s*m/);
  const plainSeconds = text.match(/(\d+(?:\.\d+)?)\s*s/);
  if (hours) seconds += Number(hours[1]) * 3600;
  if (minutes) seconds += Number(minutes[1]) * 60;
  if (plainSeconds) seconds += Number(plainSeconds[1]);
  if (!hours && !minutes && !plainSeconds) {
    const clock = text.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (clock) {
      seconds =
        Number(clock[1]) * (clock[3] ? 3600 : 60) +
        Number(clock[2]) * (clock[3] ? 60 : 1) +
        Number(clock[3] ?? 0);
    } else if (/^\d+(?:\.\d+)?$/.test(text)) {
      seconds = Number(text) * 60;
    }
  }
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : null;
}
