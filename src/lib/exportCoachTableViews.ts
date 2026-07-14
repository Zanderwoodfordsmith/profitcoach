import { csvFilenameStem } from "@/lib/exportCsv";
import type { CoachTableViewsStorage } from "@/lib/admin/coachTableViews";

export function downloadCoachTableViewsJson(storage: CoachTableViewsStorage) {
  const json = JSON.stringify(storage, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${csvFilenameStem("coach-table-views")}.json`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseCoachTableViewsImport(
  raw: string
): CoachTableViewsStorage | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CoachTableViewsStorage>;
    if (
      parsed?.version !== 1 ||
      !Array.isArray(parsed.views) ||
      parsed.views.length === 0 ||
      typeof parsed.activeViewId !== "string"
    ) {
      return null;
    }
    const views = parsed.views.filter(
      (view) =>
        view &&
        typeof view.id === "string" &&
        typeof view.name === "string" &&
        view.settings &&
        typeof view.settings === "object"
    );
    if (views.length === 0) return null;
    const activeViewId = views.some((v) => v.id === parsed.activeViewId)
      ? parsed.activeViewId
      : views[0].id;
    return {
      version: 1,
      views,
      activeViewId,
      autosave: parsed.autosave === true,
      viewOrder: Array.isArray(parsed.viewOrder)
        ? parsed.viewOrder.filter((id): id is string => typeof id === "string")
        : views
            .filter((view) => view.name.trim().toLowerCase() !== "all")
            .map((view) => view.id),
    };
  } catch {
    return null;
  }
}
