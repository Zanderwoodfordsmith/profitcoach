import { notFound } from "next/navigation";

/** Any link under here with no page shows this area's not-found, inside the app layout. */
export default function MissingPage() {
  notFound();
}
