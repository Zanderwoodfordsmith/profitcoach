"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  BookOpen,
  Briefcase,
  FileDown,
  FileSpreadsheet,
  FileText,
  Hexagon,
  Image as ImageIcon,
  PlayCircle,
  Presentation,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { flattenResourcePages, type ResourceBlock, type ResourcePage } from "@/lib/resources/library";
import { RESOURCE_GROUPS } from "@/lib/resources/libraryPublic";

export type Kind = "doc" | "sheet" | "slides" | "file" | "video" | "links";

/** The type filter: show only the decks, or only the sheets, and so on. */
export const KINDS: { kind: Kind; label: string; plural: string }[] = [
  { kind: "doc", label: "Docs", plural: "docs" },
  { kind: "sheet", label: "Sheets", plural: "sheets" },
  { kind: "slides", label: "Slides", plural: "slide decks" },
  { kind: "file", label: "Files", plural: "files" },
  { kind: "video", label: "Videos", plural: "videos" },
  { kind: "links", label: "Reading", plural: "reading lists" },
];

/** Each kind of resource keeps one icon and one colour everywhere: sidebar, overview and page. */
const KIND_STYLE: Record<ResourceBlock["type"], { icon: LucideIcon; ink: string; tile: string }> = {
  doc: { icon: FileText, ink: "text-[#1a8fd4]", tile: "bg-[#eaf3fb] text-[#0c5290]" },
  sheet: { icon: FileSpreadsheet, ink: "text-emerald-600", tile: "bg-emerald-50 text-emerald-700" },
  slides: { icon: Presentation, ink: "text-amber-600", tile: "bg-amber-50 text-amber-700" },
  file: { icon: FileDown, ink: "text-slate-500", tile: "bg-slate-100 text-slate-600" },
  video: { icon: PlayCircle, ink: "text-rose-600", tile: "bg-rose-50 text-rose-700" },
  links: { icon: BookOpen, ink: "text-violet-600", tile: "bg-violet-50 text-violet-700" },
  image: { icon: ImageIcon, ink: "text-[#1a8fd4]", tile: "bg-[#eaf3fb] text-[#0c5290]" },
};

/** The three ways into the library, named the way the app's own navigation names them. */
export const SECTIONS: { title: string; icon: LucideIcon; about: string }[] = [
  {
    title: "Get clients",
    icon: UserPlus,
    about: "Fill your diary: the BOSS Scorecard marketing workshop, its message sequences, newsletter and follow-up.",
  },
  {
    title: "Keep clients",
    icon: Briefcase,
    about: "Onboard each new client and run every session: the masterfile, Sessions 1 to 4, and how to open and close.",
  },
  {
    title: "Profit System",
    icon: Hexagon,
    about: "Tools to use with clients, filed by BOSS area under Vision, Velocity and Value.",
  },
];

export const PILLARS = ["Vision", "Velocity", "Value"] as const;

export function groupsIn(section: string) {
  return RESOURCE_GROUPS.filter((g) => g.section === section);
}

const KIND_NAME: Record<ResourceBlock["type"], string> = {
  doc: "Doc",
  sheet: "Sheet",
  slides: "Slides",
  file: "File",
  video: "Video",
  links: "Reading",
  image: "Image",
};

export const ALL_PAGES = RESOURCE_GROUPS.flatMap((g) => flattenResourcePages(g.pages));

export function hasKind(page: ResourcePage, kind: Kind) {
  return page.blocks.some((b) => b.type === kind);
}

export function kindCount(kind: Kind) {
  return ALL_PAGES.filter((p) => hasKind(p, kind)).length;
}

/** What a page mostly is, from its first block. */
export function PageKindIcon({ page, className = "" }: { page: ResourcePage; className?: string }) {
  const style = KIND_STYLE[page.blocks[0]?.type ?? "doc"];
  return <style.icon className={`${style.ink} ${className}`} aria-hidden />;
}

/** The icon on its tinted square, for overview rows and asset cards. */
export function KindTile({ type, size = "md" }: { type: ResourceBlock["type"]; size?: "sm" | "md" }) {
  const style = KIND_STYLE[type];
  return (
    <span className={`flex shrink-0 items-center justify-center ${style.tile} ${size === "sm" ? "h-9 w-9 rounded-[10px]" : "h-10 w-10 rounded-[12px]"}`}>
      <style.icon className={size === "sm" ? "h-[1.125rem] w-[1.125rem]" : "h-5 w-5"} aria-hidden />
    </span>
  );
}

export function pageKindName(page: ResourcePage) {
  return KIND_NAME[page.blocks[0]?.type ?? "doc"];
}

export function groupOf(page: ResourcePage) {
  return RESOURCE_GROUPS.find((g) => flattenResourcePages(g.pages).some((p) => p.slug === page.slug)) ?? null;
}

/** Plain text per page slug, loaded once on the server so search can look inside pages. */
const SearchTextContext = createContext<Record<string, string>>({});

export function SearchTextProvider({ value, children }: { value: Record<string, string>; children: ReactNode }) {
  return <SearchTextContext.Provider value={value}>{children}</SearchTextContext.Provider>;
}

export function useLibrarySearch(query: string, kind: Kind | null) {
  const searchText = useContext(SearchTextContext);
  const words = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const results = useMemo(() => {
    if (words.length === 0 && !kind) return null;
    return ALL_PAGES.filter((p) => {
      if (kind && !hasKind(p, kind)) return false;
      const hay = `${p.title} ${searchText[p.slug] ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [kind, searchText, words]);
  return { words, results, searchText };
}

/** Short excerpt around the first hit, with the matched words marked. */
export function Snippet({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0) return null;
  const lower = text.toLowerCase();
  const at = Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0));
  if (!Number.isFinite(at)) return null;
  const start = Math.max(0, at - 40);
  const slice = (start > 0 ? "…" : "") + text.slice(start, at + 90).trim() + "…";
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return (
    <>
      {slice.split(pattern).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-[#d8ecfa] px-0.5 text-[#051e36]">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}
