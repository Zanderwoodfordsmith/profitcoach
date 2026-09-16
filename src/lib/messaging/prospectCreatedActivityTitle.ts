import { isPoolImportSource } from "@/lib/prospectSourceKind";

export function prospectCreatedActivityTitle(opts: {
  isClient: boolean;
  prospectSource?: string | null;
}): string {
  if (opts.isClient) return "Became a client";
  if (isPoolImportSource(opts.prospectSource)) return "Imported into pool";
  return "Added as a prospect";
}
