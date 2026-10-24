"use client";

import { AvaHalo, type AvaHaloProps } from "@/components/ava/AvaHalo";

/** The design board draws Ava's chosen symbol through here. */
export type MarkId = "haloCore";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- id stays in the API so screens read the same
export function AvaMark({ id, ...props }: AvaHaloProps & { id: MarkId }) {
  return <AvaHalo {...props} />;
}

/** The ring on its own (no centre), for screens that build it up first. */
export function HaloMark(props: AvaHaloProps & { core?: boolean }) {
  return <AvaHalo core={false} {...props} />;
}
