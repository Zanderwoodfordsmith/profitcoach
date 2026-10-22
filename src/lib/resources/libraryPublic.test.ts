import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { slimLibrary } from "./slim";

const dir = path.join(process.cwd(), "content/resources");

describe("resources library for browsers", () => {
  it("matches library.json (run scripts/build-resources-public.ts after editing it)", () => {
    const full = JSON.parse(readFileSync(path.join(dir, "library.json"), "utf8"));
    const pub = JSON.parse(readFileSync(path.join(dir, "library.public.json"), "utf8"));
    assert.deepEqual(pub, slimLibrary(full));
  });

  it("holds no ids, links or file names", () => {
    const text = readFileSync(path.join(dir, "library.public.json"), "utf8");
    assert.doesNotMatch(text, /"(id|url|file|src|links|tabGroups)"\s*:/);
    assert.doesNotMatch(text, /docs\.google\.com|drive\.google\.com/);
  });
});
