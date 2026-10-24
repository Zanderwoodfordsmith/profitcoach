import type { Metadata } from "next";
import { NotFoundView } from "@/components/notFound/NotFoundView";

export const metadata: Metadata = {
  title: "Page not found · The Profit Coach",
};

export default function NotFound() {
  return <NotFoundView />;
}
