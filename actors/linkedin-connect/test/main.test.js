import { describe, expect, it } from "vitest";
import { parseLinkedInCookies, jitterDelayMs } from "../src/cookies.js";

describe("parseLinkedInCookies", () => {
  it("parses Cookie-Editor-style JSON", () => {
    const cookies = parseLinkedInCookies(
      JSON.stringify([
        {
          name: "li_at",
          value: "abc",
          domain: ".linkedin.com",
          path: "/",
          secure: true,
          httpOnly: true,
        },
        {
          name: "JSESSIONID",
          value: "ajax:1",
          domain: ".linkedin.com",
          path: "/",
        },
      ]),
    );
    expect(cookies.some((c) => c.name === "li_at" && c.value === "abc")).toBe(
      true,
    );
  });

  it("parses header-style string", () => {
    const cookies = parseLinkedInCookies('li_at=xyz; JSESSIONID="ajax:2"');
    expect(cookies.find((c) => c.name === "li_at")?.value).toBe("xyz");
  });

  it("rejects missing li_at", () => {
    expect(() => parseLinkedInCookies("foo=bar")).toThrow(/li_at/);
  });
});

describe("jitterDelayMs", () => {
  it("is within [base, 2*base]", () => {
    for (let i = 0; i < 20; i += 1) {
      const ms = jitterDelayMs(5);
      expect(ms).toBeGreaterThanOrEqual(5000);
      expect(ms).toBeLessThan(10000);
    }
  });
});
