import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  capabilitiesForMode,
  capabilityContract,
  loadCapabilities,
  loadIdentity,
  loadRouter,
  parseFrontmatter,
  resolveReference,
} from "./context";
import { AGENT_TOOLS, anthropicToolsForMode, getAgentTool, toolAllowedInMode } from "./tools";

describe("agent context (ICM wiring)", () => {
  it("parses frontmatter scalars and lists", () => {
    const { meta, body } = parseFrontmatter("---\nid: lists\ntools: [a, b ,c]\n---\n# Body\n");
    assert.equal(meta.id, "lists");
    assert.deepEqual(meta.tools, ["a", "b", "c"]);
    assert.equal(body, "# Body");
  });

  it("loads identity and router, and keeps them short", () => {
    const identity = loadIdentity();
    const router = loadRouter();
    assert.ok(identity.includes("# Profit Coach Agent"));
    assert.ok(router.includes("# Router"));
    // ICM: the always-loaded layers stay small.
    assert.ok(identity.split("\n").length < 80, "AGENT.md is getting long");
    assert.ok(router.split("\n").length < 60, "ROUTER.md is getting long");
  });

  it("every capability lists real tools that work in its modes", () => {
    for (const cap of loadCapabilities()) {
      assert.ok(cap.title && cap.summary, `${cap.id} needs a title and summary`);
      for (const name of cap.tools) {
        const tool = getAgentTool(name);
        assert.ok(tool, `${cap.id} lists unknown tool ${name}`);
        for (const mode of cap.modes) {
          assert.ok(toolAllowedInMode(tool!, mode), `${name} is not allowed in ${mode} (${cap.id})`);
        }
      }
    }
  });

  it("every capability's references resolve", () => {
    for (const cap of loadCapabilities()) {
      for (const ref of cap.references) {
        assert.ok(resolveReference(ref), `${cap.id}: reference ${ref} not found`);
      }
      assert.ok(capabilityContract(cap).startsWith(`# Capability: ${cap.title}`));
    }
  });

  it("the router names every capability, and only real ones", () => {
    const router = loadRouter();
    const ids = loadCapabilities().map((cap) => cap.id);
    for (const id of ids) assert.ok(router.includes(`\`${id}\``), `router misses ${id}`);
    const named = [...router.matchAll(/`([a-z]+(?:-[a-z]+)+|lists|campaigns|guide)`/g)].map((m) => m[1]);
    for (const id of named) {
      if (id.includes("_")) continue;
      assert.ok(ids.includes(id), `router names unknown capability ${id}`);
    }
  });

  it("every deferred tool is reachable from a capability in each of its modes", () => {
    for (const mode of ["admin", "coach"] as const) {
      const reachable = new Set(capabilitiesForMode(mode).flatMap((cap) => cap.tools));
      for (const tool of AGENT_TOOLS) {
        if (tool.core || !toolAllowedInMode(tool, mode)) continue;
        assert.ok(reachable.has(tool.name), `${tool.name} cannot be opened in ${mode} mode`);
      }
    }
  });

  it("coach mode cannot see admin-only capabilities or tools", () => {
    const coachCaps = capabilitiesForMode("coach").map((cap) => cap.id);
    assert.ok(!coachCaps.includes("coach-access"));
    const names = anthropicToolsForMode("coach").map((tool) => tool.name);
    for (const adminOnly of ["find_coach", "switch_coach", "set_agent_access"]) {
      assert.ok(!names.includes(adminOnly), `${adminOnly} leaked into coach mode`);
    }
  });

  it("only core tools load up front; the list is stable", () => {
    const first = anthropicToolsForMode("admin");
    const second = anthropicToolsForMode("admin");
    assert.deepEqual(first, second);
    for (const tool of first) {
      const def = getAgentTool(tool.name)!;
      assert.equal(Boolean((tool as { defer_loading?: boolean }).defer_loading), !def.core, tool.name);
    }
  });
});
