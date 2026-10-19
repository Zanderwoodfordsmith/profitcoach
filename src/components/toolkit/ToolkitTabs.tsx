"use client";

import { usePathname } from "next/navigation";
import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";

/** Sub-tabs inside the Get Clients Toolkit tab. Links lives at /share; the rest at /toolkit?view=. */
export const TOOLKIT_VIEWS = [
  { id: "links", label: "Links" },
  { id: "brochure", label: "Brochure" },
  { id: "social", label: "Social media posts", group: "Social media posts" },
  { id: "linkedin", label: "LinkedIn, email and calls", group: "LinkedIn, email and calls" },
  { id: "print", label: "Print", group: "Print" },
  { id: "brand", label: "Brand graphics" },
] as const;

export type ToolkitView = (typeof TOOLKIT_VIEWS)[number]["id"];
/** Views drawn by ToolkitHub (everything but Links). */
export type ToolkitGraphicsView = Exclude<ToolkitView, "links">;

export function parseToolkitView(raw: string | null): ToolkitGraphicsView {
  const match = TOOLKIT_VIEWS.find((v) => v.id === raw && v.id !== "links");
  return (match?.id as ToolkitGraphicsView | undefined) ?? "brochure";
}

function viewHref(prefix: string, id: ToolkitView): string {
  if (id === "links") return `${prefix}/share`;
  if (id === "brochure") return `${prefix}/toolkit`;
  return `${prefix}/toolkit?view=${id}`;
}

export function ToolkitTabs({ active }: { active: ToolkitView }) {
  const pathname = usePathname() ?? "";
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  return (
    <div className="mb-2 border-b border-slate-200">
      <PageHeaderUnderlineTabs
        placement="content"
        ariaLabel="Toolkit"
        items={TOOLKIT_VIEWS.map((view) => ({
          kind: "link" as const,
          href: viewHref(prefix, view.id),
          label: view.label,
          active: view.id === active,
        }))}
      />
    </div>
  );
}
