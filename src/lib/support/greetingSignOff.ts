/**
 * Support chat shows messages without "Hi Bruce," and "Thanks, Zander" (18 Nov):
 * the chat already shows who wrote it. Email adds them back on the way out.
 */

const GREETING_LINE =
  /^(hi|hey|hello|hiya|dear|morning|good morning|good afternoon|afternoon|evening)\b(\s+[a-z][\w'’-]*){0,2}\s*[,!.]?\s*$/i;

const CLOSINGS =
  "thanks|thank you|many thanks|thanks again|cheers|best|best wishes|kind regards|regards|warm regards|all the best|speak soon|talk soon|ta";
const CLOSING_LINE = new RegExp(`^(${CLOSINGS})\\s*[,!.]*\\s*$`, "i");
const CLOSING_WITH_NAME = new RegExp(`^(${CLOSINGS})\\s*[,!.]*\\s+(.+)$`, "i");

function nameMatches(line: string, firstName: string): boolean {
  const cleaned = line
    .replace(/^[-–—~\s]+/, "")
    .replace(/(\s+x+)+\s*$/i, "")
    .replace(/[\s.!,]+$/, "")
    .trim();
  if (!cleaned) return false;
  // "Zander" or "Zander Woodford-Smith"
  const words = cleaned.split(/\s+/);
  return words.length <= 3 && words[0].toLowerCase() === firstName.toLowerCase();
}

/** Body with a lone greeting first line and a name sign-off at the end removed. */
export function stripGreetingAndSignOff(body: string, signerFirstName?: string | null): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;

  const firstLine = lines[start]?.trim() ?? "";
  if (firstLine.length <= 40 && GREETING_LINE.test(firstLine)) start += 1;

  const first = signerFirstName?.trim().split(/\s+/)[0];
  if (first) {
    const last = lines[end - 1]?.trim() ?? "";
    // "Thanks, Zander" on one line
    const oneLine = last.match(CLOSING_WITH_NAME);
    if (oneLine && nameMatches(oneLine[2], first)) {
      end -= 1;
    } else if (nameMatches(last, first)) {
      end -= 1;
      // "Thanks,\nZander"
      const before = lines[end - 1]?.trim() ?? "";
      if (CLOSING_LINE.test(before)) end -= 1;
    }
  }

  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  const cleaned = lines.slice(start, end).join("\n").trim();
  // Never blank a message that was only a greeting or a name.
  return cleaned || body.trim();
}

/** True when the message already opens with "Hi …". */
export function startsWithGreeting(body: string): boolean {
  const firstLine = body.trim().split("\n")[0]?.trim() ?? "";
  return firstLine.length <= 40 && GREETING_LINE.test(firstLine);
}

/** True when the message already ends with the signer's name. */
export function endsWithSignOff(body: string, signerFirstName: string): boolean {
  return stripGreetingAndSignOff(`x\n${body.trim()}`, signerFirstName) !== `x\n${body.trim()}`;
}
