import {
  FileSpreadsheet,
  Globe,
  MapPin,
  Search,
  UserPlus,
} from "lucide-react";

export type PoolImportMode = "search" | "maps" | "google" | "csv" | "one";

export const POOL_IMPORT_OPTIONS: Array<{
  id: PoolImportMode;
  title: string;
  body: string;
  icon: typeof Search;
}> = [
  {
    id: "one",
    title: "Add one person",
    body: "Name plus email, phone, or LinkedIn. LinkedIn is optional.",
    icon: UserPlus,
  },
  {
    id: "search",
    title: "Sales Navigator",
    body: "Open the base search, then import 1st degree or a custom URL.",
    icon: Search,
  },
  {
    id: "maps",
    title: "Google Maps",
    body: "Search a trade in a country or city. We add the business and contacts.",
    icon: MapPin,
  },
  {
    id: "google",
    title: "Google Search",
    body: "Same idea, from Google results rather than Maps. We add the business and a person to contact.",
    icon: Globe,
  },
  {
    id: "csv",
    title: "Upload CSV",
    body: "Choose the list, then match your columns. Name plus email, phone, LinkedIn, or website.",
    icon: FileSpreadsheet,
  },
];
