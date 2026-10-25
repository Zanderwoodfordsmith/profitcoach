/** Shape of inventory.json, written by scripts/design-inventory.ts. */

export type PieceKind = "button" | "card" | "header" | "modal" | "empty" | "table" | "field" | "badge";

export type PieceUse = { file: string; line: number; page: string | null };

export type PieceVersion = {
  id: string;
  tag: string;
  className: string;
  text: string;
  count: number;
  uses: PieceUse[];
};

export type PieceFamily = {
  id: string;
  kind: PieceKind;
  name: string;
  count: number;
  versionCount: number;
  versions: PieceVersion[];
};

export type TextStyle = {
  id: string;
  px: number;
  spellings: string[];
  weight: string;
  count: number;
  files: number;
  sample: string;
  variants: { extra: string; count: number }[];
  variantCount: number;
};

export type Inventory = {
  scannedAt: string;
  files: number;
  kinds: { kind: PieceKind; uses: number; families: number; versions: number }[];
  families: PieceFamily[];
  textStyles: TextStyle[];
};

export type Mark = { mark: "fits" | "no" | null; note: string };
