import { AcademyCatalogGrid } from "@/components/academy/AcademyCatalogGrid";
import { StickyPageHeader } from "@/components/layout";

type Props = {
  /** Prefix for course card links (e.g. `/coach/academy/classroom`). */
  linkBasePath: string;
};

/** Standalone catalog + header (most in-app usage goes through {@link AcademyCurrentShell}). */
export async function AcademyCatalogHome({ linkBasePath }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="Classroom"
        description={
          <span className="text-lg leading-relaxed text-slate-600">
            Self-paced training aligned with the nine modules on My Compass — Connect, Enroll, and
            Deliver.
          </span>
        }
      />

      <AcademyCatalogGrid linkBasePath={linkBasePath} />
    </div>
  );
}
