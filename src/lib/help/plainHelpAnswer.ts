/** Answer text without links or paragraph breaks, for snippets. Shared by the page and the search API. */
export function plainHelpAnswer(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1").replace(/\s*\n\s*/g, " ");
}
