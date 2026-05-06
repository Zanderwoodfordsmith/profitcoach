import type { Metadata } from "next";
import { BlogContent } from "./BlogContent";

export const metadata: Metadata = {
  title: "Blog — The Profit Coach",
  description:
    "Insights for owners who want to simplify growth, increase profit, and build a business that works without constant firefighting.",
};

export default function BlogPage() {
  return <BlogContent />;
}
