import {
  coachClientsTabItems,
  getCallsTabItems,
  winClientsTabItems,
} from "./dashboardNavItems";
import type { ToolsHubKey } from "./toolsHubPitch";

export type GuideTab = { href: string; label: string; description?: string };

export function hubTabs(hub: ToolsHubKey, prefix: "/coach" | "/admin"): GuideTab[] {
  const items: (GuideTab & { iconOnly?: boolean; adminPreview?: boolean })[] =
    hub === "get-calls"
      ? getCallsTabItems(prefix)
      : hub === "win-clients"
        ? winClientsTabItems(prefix)
        : coachClientsTabItems(prefix);
  return items.filter(
    (item) => !item.iconOnly && (prefix === "/admin" || !item.adminPreview)
  );
}
