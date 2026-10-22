/**
 * The resources library as members' browsers see it before they're signed in:
 * titles, one-liners and what kind each block is. No sheet, deck or file ids,
 * links or document names. Full pages come from /api/academy/resources.
 */

type AnyPage = { slug: string; title: string; dek?: string; lesson?: string; updated?: string; blocks: { type: string }[]; children?: AnyPage[] };
type AnyGroup = { title: string; section: string; about?: string; area?: number; pillar?: string; pages: AnyPage[] };

function slimPage(page: AnyPage): AnyPage {
  return {
    slug: page.slug,
    title: page.title,
    ...(page.dek ? { dek: page.dek } : {}),
    ...(page.lesson ? { lesson: page.lesson } : {}),
    ...(page.updated ? { updated: page.updated } : {}),
    blocks: page.blocks.map((b) => ({ type: b.type })),
    ...(page.children?.length ? { children: page.children.map(slimPage) } : {}),
  };
}

export function slimLibrary(library: { groups: AnyGroup[] }): { groups: AnyGroup[] } {
  return { groups: library.groups.map((g) => ({ ...g, pages: g.pages.map(slimPage) })) };
}
