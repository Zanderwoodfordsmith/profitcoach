import type { LucideIcon } from "lucide-react";
import {
  Award,
  AudioLines,
  CalendarRange,
  FileText,
  Gem,
  Handshake,
  IdCard,
  LayoutGrid,
  Linkedin,
  Newspaper,
  PenLine,
  Send,
  Settings2,
  Target,
} from "lucide-react";

/** One icon per blueprint page, shared by the sidebar and the Overview contents. */
const PAGE_ICONS: Record<string, LucideIcon> = {
  command: LayoutGrid,
  story: Award,
  voice: AudioLines,
  profile: IdCard,
  setup: Settings2,
  market: Target,
  linkedin: Linkedin,
  campaigns: Send,
  offer: Gem,
  sales: Handshake,
  ninety: CalendarRange,
  content: Newspaper,
  posts: PenLine,
};

export function PageIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = PAGE_ICONS[slug] ?? FileText;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}
