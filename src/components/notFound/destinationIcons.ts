import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  Map as MapIcon,
  MessagesSquare,
  Route,
  Settings,
  Target,
  UserPlus,
  Users,
} from "lucide-react";

/** Same icons as the sidebar, keyed by path without the /coach or /admin prefix. */
const ICONS: Record<string, LucideIcon> = {
  "/admin": Users,
  "/admin/roadmap": Route,
  "/community": MessagesSquare,
  "/academy": GraduationCap,
  "/blueprint": MapIcon,
  "/blueprint/coach": MapIcon,
  "/conversations": UserPlus,
  "/clients": Handshake,
  "/community/calendar": CalendarDays,
  "/settings": Settings,
  "/account": Settings,
  "/support": LifeBuoy,
  "/client": LayoutDashboard,
  "/client/playbooks": BookOpen,
  "/client/goals": Target,
  "/client/classroom": GraduationCap,
};

export function destinationIcon(href: string): LucideIcon {
  return ICONS[href] ?? ICONS[href.replace(/^\/(coach|admin)/, "")] ?? ArrowRight;
}
