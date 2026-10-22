/**
 * Writes content/resources/library.public.json: the resources library without
 * sheet, deck or file ids, links or document names, for members' browsers.
 * Run after editing library.json (a test fails if the two drift apart):
 *   npx tsx scripts/build-resources-public.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { slimLibrary } from "../src/lib/resources/slim";

const dir = path.join(process.cwd(), "content/resources");
const full = JSON.parse(readFileSync(path.join(dir, "library.json"), "utf8"));
writeFileSync(path.join(dir, "library.public.json"), `${JSON.stringify(slimLibrary(full), null, 2)}\n`);
console.log("Wrote content/resources/library.public.json");
